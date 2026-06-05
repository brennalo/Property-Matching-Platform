import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { templatesApi, matchApi } from '../../api'
import type { MatchRequest, ResidencyType, TransportMode } from '../../types'
import { Search, Clock, Car, MapPin, CheckCircle2 } from 'lucide-react'

declare global {
    interface Window {
        google: any
        initGoogleMapsSearch: () => void
    }
}

const RESIDENCY_TYPES: ResidencyType[] = ['Landed', 'Condo', 'Apartment', 'Townhouse', 'Studio']
const TRANSPORT_MODES: { value: TransportMode; label: string; icon: string }[] = [
    { value: 'Driving', label: 'Drive', icon: '🚗' },
    { value: 'Transit', label: 'Transit', icon: '🚇' },
    { value: 'Walking', label: 'Walk', icon: '🚶' },
    { value: 'Bicycling', label: 'Cycle', icon: '🚲' },
]

// ── Google Maps loader ────────────────────────────────────────────────────────
// Reuses the same script tag as ListingDetailPage (id: gmap-script-detail).
// Falls back to its own tag if the detail page hasn't loaded first.

function useGoogleMapsScript() {
    const [ready, setReady] = useState(!!window.google?.maps?.places)

    useEffect(() => {
        if (window.google?.maps?.places) { setReady(true); return }

        const onReady = () => setReady(true)

        // If another script is already in flight, piggyback on it
        const existing = document.getElementById('gmap-script-detail') as HTMLScriptElement | null
        if (existing) {
            // Poll until google is available (the callback belongs to another component)
            const iv = setInterval(() => {
                if (window.google?.maps?.places) { clearInterval(iv); setReady(true) }
            }, 100)
            return () => clearInterval(iv)
        }

        // No script yet — inject our own (includes geometry + places)
        if (document.getElementById('gmap-script-search')) return
        window.initGoogleMapsSearch = onReady
        const script = document.createElement('script')
        script.id = 'gmap-script-search'
        const apiKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY ?? ''
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=initGoogleMapsSearch`
        script.async = true
        document.head.appendChild(script)
    }, [])

    return ready
}

// ── Reverse geocoder helper ───────────────────────────────────────────────────

function reverseGeocode(lat: number, lng: number): Promise<string> {
    return new Promise(resolve => {
        if (!window.google?.maps) { resolve(''); return }
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
            if (status === 'OK' && results[0]) resolve(results[0].formatted_address)
            else resolve('')
        })
    })
}

// ── Map picker modal ──────────────────────────────────────────────────────────

function MapPickerModal({
    initialLat, initialLng, initialAddress,
    onConfirm, onClose,
}: {
    initialLat?: number
    initialLng?: number
    initialAddress?: string
    onConfirm: (lat: number, lng: number, address: string) => void
    onClose: () => void
}) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstance = useRef<any>(null)
    const markerRef = useRef<any>(null)

    const [pickedLat, setPickedLat] = useState<number | null>(initialLat ?? null)
    const [pickedLng, setPickedLng] = useState<number | null>(initialLng ?? null)
    const [pickedAddress, setPickedAddress] = useState(initialAddress ?? '')
    const [geocoding, setGeocoding] = useState(false)

    useEffect(() => {
        if (!mapRef.current || !window.google) return

        const center = initialLat && initialLng
            ? { lat: initialLat, lng: initialLng }
            : { lat: 3.1478, lng: 101.6953 } // KL default

        const map = new window.google.maps.Map(mapRef.current, {
            center, zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
        })
        mapInstance.current = map

        // Drop initial marker if coords already set
        if (initialLat && initialLng) {
            markerRef.current = new window.google.maps.Marker({ position: center, map })
        }

        map.addListener('click', async (e: any) => {
            const lat = e.latLng.lat()
            const lng = e.latLng.lng()

            setPickedLat(lat)
            setPickedLng(lng)
            setGeocoding(true)

            // Move / create marker
            if (markerRef.current) markerRef.current.setMap(null)
            markerRef.current = new window.google.maps.Marker({ position: { lat, lng }, map })

            // Reverse geocode to get address string
            const addr = await reverseGeocode(lat, lng)
            setPickedAddress(addr)
            setGeocoding(false)
        })
    }, [])

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 640, width: '100%' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h2 style={{ fontSize: '1.1rem' }}>📍 Pin your Workplace</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Click anywhere on the map to drop a pin. The address will fill in automatically.
                </p>

                <div ref={mapRef}
                    style={{ width: '100%', height: 380, borderRadius: 10, border: '1px solid var(--border)' }} />

                {/* Live address preview */}
                <div style={{ marginTop: 12, minHeight: 40, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, fontSize: '0.83rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {geocoding ? (
                        <><span className="spinner" style={{ width: 14, height: 14 }} /> Fetching address…</>
                    ) : pickedAddress ? (
                        <><MapPin size={13} style={{ flexShrink: 0 }} /> {pickedAddress}</>
                    ) : (
                        <span style={{ color: 'var(--text-dim)' }}>No location selected yet</span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary"
                        disabled={!pickedLat || !pickedLng || geocoding}
                        onClick={() => {
                            if (pickedLat != null && pickedLng != null)
                                onConfirm(pickedLat, pickedLng, pickedAddress)
                        }}>
                        Confirm Location
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Search page ───────────────────────────────────────────────────────────────

export default function SearchPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showMapPicker, setShowMap] = useState(false)

    const addressInputRef = useRef<HTMLInputElement>(null)
    const autocompleteRef = useRef<any>(null)

    const mapsReady = useGoogleMapsScript()

    const [form, setForm] = useState({
        rooms: '',
        toilets: '',
        residencyType: '' as ResidencyType | '',
        priceMin: '',
        priceMax: '',
        workplaceAddress: '',
        workplaceLat: null as number | null,
        workplaceLng: null as number | null,
        transportModes: ['Driving'] as TransportMode[],
        maxCommuteMinutes: '45',
        lifestyleTemplateId: '',
    })

    const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

    // Wire up Places Autocomplete once Maps is ready
    useEffect(() => {
        if (!mapsReady || !addressInputRef.current || autocompleteRef.current) return
        const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
            componentRestrictions: { country: 'my' },
            fields: ['formatted_address', 'geometry'],
        })
        autocompleteRef.current = ac
        ac.addListener('place_changed', () => {
            const place = ac.getPlace()
            if (!place.geometry) return
            setForm(f => ({
                ...f,
                workplaceAddress: place.formatted_address ?? f.workplaceAddress,
                workplaceLat: place.geometry.location.lat(),
                workplaceLng: place.geometry.location.lng(),
            }))
        })
    }, [mapsReady])

    // Called when map picker confirms a pin
    const handleMapConfirm = useCallback((lat: number, lng: number, address: string) => {
        setForm(f => ({
            ...f,
            workplaceLat: lat,
            workplaceLng: lng,
            workplaceAddress: address || f.workplaceAddress,
        }))
        // Also push the resolved address back into the autocomplete input
        if (addressInputRef.current && address) {
            addressInputRef.current.value = address
        }
        setShowMap(false)
    }, [])

    const toggleMode = (mode: TransportMode) => {
        setForm(f => {
            const has = f.transportModes.includes(mode)
            if (has && f.transportModes.length === 1) return f // at least one required
            return {
                ...f,
                transportModes: has
                    ? f.transportModes.filter(m => m !== mode)
                    : [...f.transportModes, mode],
            }
        })
    }

    const { data: templates } = useQuery({
        queryKey: ['templates'],
        queryFn: () => templatesApi.getAll().then(r => r.data),
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (form.workplaceLat == null || form.workplaceLng == null) {
            setError('Please pick your workplace — use the autocomplete or the map picker.')
            return
        }

        const req: MatchRequest = {
            workplaceAddress: form.workplaceAddress,
            workplaceLat: form.workplaceLat,
            workplaceLng: form.workplaceLng,
            transportModes: form.transportModes,
            maxCommuteMinutes: parseInt(form.maxCommuteMinutes),
        }
        if (form.rooms) req.rooms = parseInt(form.rooms)
        if (form.toilets) req.toilets = parseInt(form.toilets)
        if (form.residencyType) req.residencyType = form.residencyType
        if (form.priceMin) req.priceMin = parseFloat(form.priceMin)
        if (form.priceMax) req.priceMax = parseFloat(form.priceMax)
        if (form.lifestyleTemplateId) req.lifestyleTemplateId = form.lifestyleTemplateId

        setLoading(true)
        try {
            const { data } = await matchApi.search(req)
            sessionStorage.setItem('matchResults', JSON.stringify(data))
            sessionStorage.setItem('matchReq', JSON.stringify(req))
            navigate('/results')
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Search failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const coordsSet = form.workplaceLat != null && form.workplaceLng != null

    return (
        <div>
            <h1 className="page-title">Find Your Home</h1>
            <p className="page-sub">We'll match properties to your lifestyle, commute, and preferences</p>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* ── Property basics ─────────────────────────────────── */}
                    <div className="card">
                        <h3 style={{ marginBottom: 16, fontSize: '1rem', color: 'var(--text-muted)' }}>🏠 Property Requirements</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Bedrooms</label>
                                <select className="select" value={form.rooms} onChange={e => update('rooms', e.target.value)}>
                                    <option value="">Any</option>
                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bathrooms</label>
                                <select className="select" value={form.toilets} onChange={e => update('toilets', e.target.value)}>
                                    <option value="">Any</option>
                                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: 14 }}>
                            <label className="form-label">Property Type</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" onClick={() => update('residencyType', '')}
                                    className={`btn btn-sm ${!form.residencyType ? 'btn-primary' : 'btn-outline'}`}>Any</button>
                                {RESIDENCY_TYPES.map(t => (
                                    <button key={t} type="button" onClick={() => update('residencyType', t)}
                                        className={`btn btn-sm ${form.residencyType === t ? 'btn-primary' : 'btn-outline'}`}>{t}</button>
                                ))}
                            </div>
                        </div>

                        <div className="form-grid" style={{ marginTop: 14 }}>
                            <div className="form-group">
                                <label className="form-label">Min Price (RM/mo)</label>
                                <input className="input" type="number" min={0} value={form.priceMin}
                                    onChange={e => update('priceMin', e.target.value)} placeholder="e.g. 1500" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Max Price (RM/mo)</label>
                                <input className="input" type="number" min={0} value={form.priceMax}
                                    onChange={e => update('priceMax', e.target.value)} placeholder="e.g. 3500" />
                            </div>
                        </div>
                    </div>

                    {/* ── Commute ─────────────────────────────────────────── */}
                    <div className="card">
                        <h3 style={{ marginBottom: 16, fontSize: '1rem', color: 'var(--text-muted)' }}>
                            <Car size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            Commute Preferences
                        </h3>

                        {/* Address input + map button */}
                        <div className="form-group">
                            <label className="form-label">Workplace Address</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        ref={addressInputRef}
                                        className="input"
                                        value={form.workplaceAddress}
                                        required
                                        onChange={e => {
                                            update('workplaceAddress', e.target.value)
                                            // Clear coords — user is typing fresh, autocomplete will re-set them
                                            update('workplaceLat', null)
                                            update('workplaceLng', null)
                                        }}
                                        placeholder={mapsReady ? 'Start typing to search…' : 'e.g. Menara Maxis, KLCC'}
                                        style={{ paddingRight: coordsSet ? 34 : undefined }}
                                    />
                                    {coordsSet && (
                                        <CheckCircle2 size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', pointerEvents: 'none' }} />
                                    )}
                                </div>
                                <button type="button" className="btn btn-outline"
                                    onClick={() => setShowMap(true)}
                                    title="Pin on map"
                                    style={{ flexShrink: 0, gap: 4 }}>
                                    <MapPin size={14} /> Map
                                </button>
                            </div>

                            {coordsSet ? (
                                <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 5 }}>
                                    ✓ Pinned · {form.workplaceLat!.toFixed(5)}, {form.workplaceLng!.toFixed(5)}
                                </p>
                            ) : (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 5 }}>
                                    Pick from the autocomplete dropdown, or click <strong>Map</strong> to pin your workplace manually.
                                </p>
                            )}
                        </div>

                        {/* Transport mode — multi-select */}
                        <div className="form-group" style={{ marginTop: 14 }}>
                            <label className="form-label">
                                Transport Mode
                                <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 6, fontSize: '0.78rem' }}>
                                    (select all that apply — best commute wins)
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {TRANSPORT_MODES.map(m => {
                                    const active = form.transportModes.includes(m.value)
                                    return (
                                        <button key={m.value} type="button"
                                            onClick={() => toggleMode(m.value)}
                                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ flex: 1, position: 'relative' }}>
                                            {m.icon} {m.label}
                                            {active && (
                                                <span style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#0f0f0e' }}>✓</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Max commute slider */}
                        <div className="form-group" style={{ marginTop: 14 }}>
                            <label className="form-label">
                                <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Max Bearable Commute: <strong style={{ color: 'var(--accent)' }}>{form.maxCommuteMinutes} min</strong>
                            </label>
                            <input type="range" min={10} max={120} step={5}
                                value={form.maxCommuteMinutes}
                                onChange={e => update('maxCommuteMinutes', e.target.value)}
                                style={{ width: '100%', accentColor: 'var(--accent)' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                <span>10 min</span><span>120 min</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Lifestyle ────────────────────────────────────────── */}
                    <div className="card">
                        <h3 style={{ marginBottom: 4, fontSize: '1rem', color: 'var(--text-muted)' }}>✨ Lifestyle Template</h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 14 }}>
                            Score properties based on nearby places that match your lifestyle.
                            <a href="/lifestyle" style={{ marginLeft: 6 }}>Manage templates →</a>
                        </p>
                        <select className="select" value={form.lifestyleTemplateId}
                            onChange={e => update('lifestyleTemplateId', e.target.value)}>
                            <option value="">No lifestyle filter</option>
                            {templates?.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.placeTypes.join(', ')})</option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <div style={{ padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-lg"
                        disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                        {loading
                            ? <><span className="spinner" /> Finding matches…</>
                            : <><Search size={16} /> Search Properties</>}
                    </button>
                </div>
            </form>

            {/* Map picker modal */}
            {showMapPicker && mapsReady && (
                <MapPickerModal
                    initialLat={form.workplaceLat ?? undefined}
                    initialLng={form.workplaceLng ?? undefined}
                    initialAddress={form.workplaceAddress}
                    onConfirm={handleMapConfirm}
                    onClose={() => setShowMap(false)}
                />
            )}

            {showMapPicker && !mapsReady && (
                <div className="modal-overlay" onClick={() => setShowMap(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <p>Google Maps is still loading — please wait a moment and try again.</p>
                        <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setShowMap(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    )
}
