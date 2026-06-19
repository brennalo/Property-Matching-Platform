import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { templatesApi, matchApi, searchHistoryApi } from '../../api'
import type { MatchRequest, ResidencyType, TransportMode } from '../../types'
import { Search, Clock, Car, MapPin, CheckCircle2 } from 'lucide-react'

declare global {
    interface Window { google: any; __gmapsReady: boolean }
}

const RESIDENCY_TYPES: ResidencyType[] = ['Landed', 'Condo', 'Apartment', 'Townhouse', 'Studio']
const TRANSPORT_MODES: { value: TransportMode; label: string; icon: string }[] = [
    { value: 'Driving', label: 'Drive', icon: '🚗' },
    { value: 'Transit', label: 'Transit', icon: '🚇' },
    { value: 'Walking', label: 'Walk', icon: '🚶' },
    { value: 'Bicycling', label: 'Cycle', icon: '🚲' },
]

// Poll window.__gmapsReady — App.tsx bootstrap sets this once the script loads
function useGoogleMapsReady() {
    const [ready, setReady] = useState(!!window.__gmapsReady)
    useEffect(() => {
        if (window.__gmapsReady) return
        const iv = setInterval(() => {
            if (window.__gmapsReady) { clearInterval(iv); setReady(true) }
        }, 150)
        return () => clearInterval(iv)
    }, [])
    return ready
}

function reverseGeocode(lat: number, lng: number): Promise<string> {
    return new Promise(resolve => {
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
            resolve(status === 'OK' && results[0] ? results[0].formatted_address : '')
        })
    })
}

// ── Map picker modal ──────────────────────────────────────────────────────────

interface MapPickerProps {
    initialLat?: number; initialLng?: number; initialAddress?: string
    onConfirm: (lat: number, lng: number, address: string) => void
    onClose: () => void
}

function MapPickerModal({ initialLat, initialLng, initialAddress, onConfirm, onClose }: MapPickerProps) {
    const mapDivRef = useRef<HTMLDivElement>(null)
    const markerRef = useRef<any>(null)
    const [pickedLat, setPickedLat] = useState<number | null>(initialLat ?? null)
    const [pickedLng, setPickedLng] = useState<number | null>(initialLng ?? null)
    const [address, setAddress] = useState(initialAddress ?? '')
    const [geocoding, setGeocoding] = useState(false)

    useEffect(() => {
        if (!mapDivRef.current) return
        const center = initialLat && initialLng
            ? { lat: initialLat, lng: initialLng }
            : { lat: 3.1478, lng: 101.6953 }

        const map = new window.google.maps.Map(mapDivRef.current, {
            center, zoom: 14,
            mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
            gestureHandling: 'greedy',
        })
        if (initialLat && initialLng) {
            markerRef.current = new window.google.maps.Marker({ position: center, map })
        }
        map.addListener('click', async (e: any) => {
            const lat: number = e.latLng.lat()
            const lng: number = e.latLng.lng()
            setPickedLat(lat); setPickedLng(lng); setGeocoding(true); setAddress('')
            if (markerRef.current) markerRef.current.setMap(null)
            markerRef.current = new window.google.maps.Marker({ position: { lat, lng }, map })
            const addr = await reverseGeocode(lat, lng)
            setAddress(addr); setGeocoding(false)
        })
        setTimeout(() => window.google.maps.event.trigger(map, 'resize'), 60)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 640, width: '100%' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h2 style={{ fontSize: '1.1rem' }}>📍 Pin your Workplace</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Click anywhere on the map to drop a pin — the address fills in automatically.
                </p>
                <div ref={mapDivRef}
                    style={{ width: '100%', height: 380, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)' }} />
                <div style={{ marginTop: 12, minHeight: 42, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, fontSize: '0.83rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {geocoding
                        ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Fetching address…</>
                        : address
                            ? <><MapPin size={13} style={{ flexShrink: 0 }} />{address}</>
                            : <span style={{ color: 'var(--text-dim)' }}>No pin placed yet — click the map</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary"
                        disabled={pickedLat == null || pickedLng == null || geocoding}
                        onClick={() => { if (pickedLat != null && pickedLng != null) onConfirm(pickedLat, pickedLng, address) }}>
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
    const mapsReady = useGoogleMapsReady()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showMap, setShowMap] = useState(false)

    // Address is UNCONTROLLED — Google Places Autocomplete writes to the DOM directly.
    // We only track confirmed coordinates in React state.
    const addressInputRef = useRef<HTMLInputElement>(null)
    const autocompleteRef = useRef<any>(null)
    const [workplace, setWorkplace] = useState<{
        address: string; lat: number | null; lng: number | null
    }>({ address: '', lat: null, lng: null })

    const [form, setForm] = useState({
        rooms: '', toilets: '',
        residencyType: '' as ResidencyType | '',
        priceMin: '', priceMax: '',
        transportModes: ['Driving'] as TransportMode[],
        maxCommuteMinutes: '45',
        lifestyleTemplateId: '',
    })
    const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

    // Wire Autocomplete once — only when Maps is confirmed ready
    useEffect(() => {
        if (!mapsReady || !addressInputRef.current || autocompleteRef.current) return
        const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
            componentRestrictions: { country: 'my' },
            fields: ['formatted_address', 'geometry'],
        })
        autocompleteRef.current = ac
        ac.addListener('place_changed', () => {
            const place = ac.getPlace()
            if (!place?.geometry?.location) return
            setWorkplace({
                address: place.formatted_address ?? addressInputRef.current?.value ?? '',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
            })
        })
    }, [mapsReady])

    const handleMapConfirm = useCallback((lat: number, lng: number, addr: string) => {
        setWorkplace({ address: addr, lat, lng })
        if (addressInputRef.current) addressInputRef.current.value = addr
        setShowMap(false)
    }, [])

    const handleAddressType = () => {
        // Clear coords when user types manually — must re-pick from dropdown
        setWorkplace(w => w.lat != null ? { ...w, lat: null, lng: null } : w)
    }

    const toggleMode = (mode: TransportMode) => {
        setForm(f => {
            const has = f.transportModes.includes(mode)
            if (has && f.transportModes.length === 1) return f
            return { ...f, transportModes: has ? f.transportModes.filter(m => m !== mode) : [...f.transportModes, mode] }
        })
    }

    const { data: templates } = useQuery({
        queryKey: ['templates'],
        queryFn: () => templatesApi.getAll().then(r => r.data),
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('')
        if (workplace.lat == null || workplace.lng == null) {
            setError('Please select your workplace — choose from the autocomplete dropdown or click Map to pin it.')
            return
        }
        const req: MatchRequest = {
            workplaceAddress: workplace.address || addressInputRef.current?.value || '',
            workplaceLat: workplace.lat,
            workplaceLng: workplace.lng,
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
            searchHistoryApi.save(JSON.stringify(req)).catch(() => { }); //IGNORE ERRORS HERE
            navigate('/results')
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Search failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const coordsSet = workplace.lat != null && workplace.lng != null

    return (
        <div>
            <h1 className="page-title">Find Your Home</h1>
            <p className="page-sub">We'll match properties to your lifestyle, commute, and preferences</p>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Property basics */}
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

                    {/* Commute */}
                    <div className="card">
                        <h3 style={{ marginBottom: 16, fontSize: '1rem', color: 'var(--text-muted)' }}>
                            <Car size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Commute Preferences
                        </h3>

                        <div className="form-group">
                            <label className="form-label">Workplace Address</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    {/* UNCONTROLLED — no value= prop. Google Places owns this input's value. */}
                                    <input
                                        ref={addressInputRef}
                                        className="input"
                                        type="text"
                                        autoComplete="off"
                                        placeholder={mapsReady ? 'Start typing your workplace…' : 'Loading maps…'}
                                        onInput={handleAddressType}
                                        style={{ paddingRight: coordsSet ? 34 : undefined }}
                                    />
                                    {coordsSet && (
                                        <CheckCircle2 size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', pointerEvents: 'none' }} />
                                    )}
                                </div>
                                <button type="button" className="btn btn-outline" onClick={() => setShowMap(true)} style={{ flexShrink: 0 }}>
                                    <MapPin size={14} /> Map
                                </button>
                            </div>
                            {coordsSet ? (
                                <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 5 }}>
                                    ✓ Location confirmed · {workplace.lat!.toFixed(5)}, {workplace.lng!.toFixed(5)}
                                </p>
                            ) : (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 5 }}>
                                    Select from the dropdown after typing, or click <strong>Map</strong> to pin manually.
                                </p>
                            )}
                        </div>

                        <div className="form-group" style={{ marginTop: 14 }}>
                            <label className="form-label">
                                Transport Mode
                                <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 6, fontSize: '0.78rem' }}>(select all — best commute wins)</span>
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {TRANSPORT_MODES.map(m => {
                                    const active = form.transportModes.includes(m.value)
                                    return (
                                        <button key={m.value} type="button" onClick={() => toggleMode(m.value)}
                                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ flex: 1, position: 'relative' }}>
                                            {m.icon} {m.label}
                                            {active && <span style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#0f0f0e' }}>✓</span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: 14 }}>
                            <label className="form-label">
                                <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Max Bearable Commute: <strong style={{ color: 'var(--accent)' }}>{form.maxCommuteMinutes} min</strong>
                            </label>
                            <input type="range" min={10} max={120} step={5} value={form.maxCommuteMinutes}
                                onChange={e => update('maxCommuteMinutes', e.target.value)}
                                style={{ width: '100%', accentColor: 'var(--accent)' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                <span>10 min</span><span>120 min</span>
                            </div>
                        </div>
                    </div>

                    {/* Lifestyle */}
                    <div className="card">
                        <h3 style={{ marginBottom: 4, fontSize: '1rem', color: 'var(--text-muted)' }}>✨ Lifestyle Template</h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 14 }}>
                            Score properties based on nearby places.{' '}
                            <a href="/lifestyle">Manage templates →</a>
                        </p>
                        <select className="select" value={form.lifestyleTemplateId} onChange={e => update('lifestyleTemplateId', e.target.value)}>
                            <option value="">No lifestyle filter</option>
                            {templates?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.placeTypes.join(', ')})</option>)}
                        </select>
                    </div>

                    {error && (
                        <div style={{ padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                        {loading ? <><span className="spinner" /> Finding matches…</> : <><Search size={16} /> Search Properties</>}
                    </button>
                </div>
            </form>

            {showMap && (
                mapsReady
                    ? <MapPickerModal
                        initialLat={workplace.lat ?? undefined}
                        initialLng={workplace.lng ?? undefined}
                        initialAddress={addressInputRef.current?.value ?? ''}
                        onConfirm={handleMapConfirm}
                        onClose={() => setShowMap(false)}
                    />
                    : <div className="modal-overlay" onClick={() => setShowMap(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <p>Google Maps is still loading — please wait a moment.</p>
                            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setShowMap(false)}>Close</button>
                        </div>
                    </div>
            )}
        </div>
    )
}
