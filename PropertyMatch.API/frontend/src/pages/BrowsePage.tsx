import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BedDouble, ArrowLeft, Bath, MapPin, Building2, Search, Clock, Car, CheckCircle2, ChevronDown, X } from 'lucide-react'
import { browseApi, templatesApi, matchApi, searchHistoryApi } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import type { MatchRequest, ResidencyType, TransportMode } from '../types'
import { MLY_PLACE_TYPE } from '../types/placeTypes'

declare global {
    interface Window { google: any; __gmapsReady: boolean }
}

function useMapsReady() {
    const [ready, setReady] = useState(!!window.__gmapsReady)
    useEffect(() => {
        if (window.__gmapsReady) return
        const iv = setInterval(() => { if (window.__gmapsReady) { clearInterval(iv); setReady(true) } }, 150)
        return () => clearInterval(iv)
    }, [])
    return ready
}

function pinColour(count: number): string {
    if (count >= 50) return '#dc2626'
    if (count >= 6) return '#2563eb'
    return '#16a34a'
}
function countLabel(count: number): string {
    if (count >= 50) return `${count} viewings (hot 🔥)`
    if (count >= 6) return `${count} viewings`
    return `${count} viewing${count !== 1 ? 's' : ''}`
}

const RESIDENCY_TYPES: ResidencyType[] = ['Landed', 'Condo', 'Apartment', 'Townhouse', 'Studio', 'MasterRoom', 'SharedRoom']
const TRANSPORT_MODES: { value: TransportMode; label: string; icon: string }[] = [
    { value: 'Driving', label: 'Drive', icon: '🚗' },
    { value: 'Transit', label: 'Transit', icon: '🚇' },
    { value: 'Walking', label: 'Walk', icon: '🚶' },
    { value: 'Bicycling', label: 'Cycle', icon: '🚲' },
]

function reverseGeocode(lat: number, lng: number): Promise<string> {
    return new Promise(resolve => {
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
            resolve(status === 'OK' && results[0] ? results[0].formatted_address : '')
        })
    })
}

// ── Map picker modal ────────────────────────────────────────────────────────
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
        const center = initialLat && initialLng ? { lat: initialLat, lng: initialLng } : { lat: 3.1478, lng: 101.6953 }
        const map = new window.google.maps.Map(mapDivRef.current, {
            center, zoom: 14, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'greedy',
        })
        if (initialLat && initialLng) markerRef.current = new window.google.maps.Marker({ position: center, map })
        map.addListener('click', async (e: any) => {
            const lat: number = e.latLng.lat(); const lng: number = e.latLng.lng()
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
                <div ref={mapDivRef} style={{ width: '100%', height: 380, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)' }} />
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

export default function BrowsePage() {
    const navigate = useNavigate()
    const mapsReady = useMapsReady()
    const { user } = useAuth()
    const authModal = useAuthModal()
    const isTenant = user?.role === 'Tenant'

    const mapRef = useRef<HTMLDivElement>(null)
    const markersRef = useRef<any[]>([])
    const gMapRef = useRef<any>(null)

    const { data: listings = [], isLoading } = useQuery({
        queryKey: ['browse-listings'],
        queryFn: () => browseApi.getListings().then((r: any) => r.data),
    })

    const [filter, setFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [basicFilters, setBasicFilters] = useState<{ rooms?: number; toilets?: number; priceMin?: number; priceMax?: number; residencyTypes?: ResidencyType[]; areas?: string[] } | null>(null)

    const filtered = listings.filter((l: any) => {
        const matchText = l.name.toLowerCase().includes(filter.toLowerCase()) || l.address.toLowerCase().includes(filter.toLowerCase())
        const matchType = !typeFilter || l.residencyType === typeFilter
        if (!matchText || !matchType) return false
        if (basicFilters) {
            if (basicFilters.rooms && l.rooms < basicFilters.rooms) return false
            if (basicFilters.toilets && l.toilets < basicFilters.toilets) return false
            if (basicFilters.priceMin && l.price < basicFilters.priceMin) return false
            if (basicFilters.priceMax && l.price > basicFilters.priceMax) return false
            if (basicFilters.residencyTypes?.length && !basicFilters.residencyTypes.includes(l.residencyType)) return false
            if (basicFilters.areas?.length) {
                const addrLower = l.address.toLowerCase()
                const matched = basicFilters.areas.some(a => addrLower.includes(a.toLowerCase()))
                if (!matched) return false
            }
        }
        return true
    })

    // ── Expandable advanced search panel ────────────────────────────────────
    const [panelOpen, setPanelOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showMapPicker, setShowMapPicker] = useState(false)

    const addressInputRef = useRef<HTMLInputElement>(null)
    const autocompleteRef = useRef<any>(null)
    const [workplace, setWorkplace] = useState<{ address: string; lat: number | null; lng: number | null }>({ address: '', lat: null, lng: null })

    const [form, setForm] = useState({
        rooms: '', toilets: '',
        residencyTypes: [] as ResidencyType[],
        priceMin: '', priceMax: '',
        transportModes: ['Driving'] as TransportMode[],
        maxCommuteMinutes: '45',
        lifestyleTemplateId: '',
        areas: [] as string[],
    })
    const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
    const [areaInput, setAreaInput] = useState('')
    const [areaSuggestions, setAreaSuggestions] = useState<string[]>([])

    const { data: templates } = useQuery({
        queryKey: ['templates'],
        queryFn: () => templatesApi.getAll().then(r => r.data),
        enabled: isTenant,
    })

    useEffect(() => {
        if (!panelOpen) {
            autocompleteRef.current = null
            return
        }
        if (!mapsReady || !addressInputRef.current || !isTenant) return
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
    }, [panelOpen, mapsReady, isTenant])

    const handleMapConfirm = useCallback((lat: number, lng: number, addr: string) => {
        setWorkplace({ address: addr, lat, lng })
        if (addressInputRef.current) addressInputRef.current.value = addr
        setShowMapPicker(false)
    }, [])

    const handleAddressType = () => setWorkplace(w => w.lat != null ? { ...w, lat: null, lng: null } : w)

    const toggleMode = (mode: TransportMode) => {
        setForm(f => {
            const has = f.transportModes.includes(mode)
            if (has && f.transportModes.length === 1) return f
            return { ...f, transportModes: has ? f.transportModes.filter(m => m !== mode) : [...f.transportModes, mode] }
        })
    }

    const addArea = (area: string) => {
        const trimmed = area.trim()
        if (!trimmed) return
        if (form.areas.some(a => a.toLowerCase() === trimmed.toLowerCase())) return
        update('areas', [...form.areas, trimmed])
        setAreaInput('')
        setAreaSuggestions([])
    }

    const removeArea = (area: string) => update('areas', form.areas.filter(a => a !== area))

    const onAreaInputChange = (val: string) => {
        setAreaInput(val)
        if (!val.trim()) { setAreaSuggestions([]); return }
        const lower = val.toLowerCase()
        setAreaSuggestions(MLY_PLACE_TYPE.filter(a => a.toLowerCase().includes(lower) && !form.areas.includes(a)).slice(0, 6))
    }

    const coordsSet = workplace.lat != null && workplace.lng != null

    // ── Outside-click closes panel ───────────────────────────────────────────
    // FIX: two extra guards:
    //   1. Google Places (.pac-container) is appended to <body> outside the panel ref — bail if click target is inside it.
    //   2. Area suggestion buttons unmount before this fires, so document.contains() returns false for a legitimate
    //      in-panel click — bail if the node has already been detached from the document.
    const panelWrapRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!panelOpen) return
        function onClick(e: MouseEvent) {
            if (showMapPicker) return
            // Guard 1: Google Places dropdown lives outside the panel in <body>
            if ((e.target as Element)?.closest?.('.pac-container')) return
            // Guard 2: area-suggestion buttons unmount (DOM detached) before this runs
            if (!document.contains(e.target as Node)) return
            if (panelWrapRef.current && !panelWrapRef.current.contains(e.target as Node)) setPanelOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [panelOpen, showMapPicker])

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !isTenant) {
            setBasicFilters({
                rooms: form.rooms ? parseInt(form.rooms) : undefined,
                toilets: form.toilets ? parseInt(form.toilets) : undefined,
                priceMin: form.priceMin ? parseFloat(form.priceMin) : undefined,
                priceMax: form.priceMax ? parseFloat(form.priceMax) : undefined,
                residencyTypes: form.residencyTypes.length ? form.residencyTypes : undefined,
                areas: form.areas.length ? form.areas : undefined,
            })
            setPanelOpen(false)
            document.getElementById('browse-results')?.scrollIntoView({ behavior: 'smooth' })
            return
        }

        setError('')
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
        if (form.residencyTypes.length > 0) req.residencyTypes = form.residencyTypes
        if (form.priceMin) req.priceMin = parseFloat(form.priceMin)
        if (form.priceMax) req.priceMax = parseFloat(form.priceMax)
        if (form.lifestyleTemplateId) req.lifestyleTemplateId = form.lifestyleTemplateId
        if (form.areas.length > 0) req.areas = form.areas

        setLoading(true)
        try {
            const { data } = await matchApi.search(req)
            sessionStorage.setItem('matchResults', JSON.stringify(data))
            sessionStorage.setItem('matchReq', JSON.stringify(req))
            searchHistoryApi.save(JSON.stringify(req)).catch(() => { })
            navigate('/results')
        } catch (err: any) {
            setError(err.response?.data?.message ?? 'Search failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Init map once Maps API is ready
    useEffect(() => {
        if (!mapsReady || !mapRef.current) return
        gMapRef.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: 3.147, lng: 101.697 },
            zoom: 11,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#eef2f7' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbe9fb' }] },
                { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e3e8ef' }] },
            ],
        })
    }, [mapsReady])

    useEffect(() => {
        if (!gMapRef.current || listings.length === 0) return
        markersRef.current.forEach(m => m.setMap(null))
        markersRef.current = []
        listings.forEach((l: any) => {
            const marker = new window.google.maps.Marker({
                position: { lat: l.lat, lng: l.lng },
                map: gMapRef.current!,
                title: l.name,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: pinColour(l.viewingCount),
                    fillOpacity: 0.9,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
            })
            const info = new window.google.maps.InfoWindow({
                content: `
                    <div style="background:#fff;color:#16202c;padding:10px 12px;border-radius:8px;font-size:0.85rem;min-width:160px;">
                        <strong>${l.name}</strong><br/>
                        RM ${l.price.toLocaleString()}/mo<br/>
                        <span style="color:#64748b;font-size:0.75rem;">${countLabel(l.viewingCount)}</span>
                    </div>`,
            })
            marker.addListener('click', () => {
                info.open(gMapRef.current!, marker)
                setTimeout(() => navigate(`/listing/${l.id}`, { state: { from: 'browse' } }), 700)
            })
            markersRef.current.push(marker)
        })
    }, [listings, mapsReady])

    const searchSummary = coordsSet
        ? `${workplace.address.slice(0, 28)}${workplace.address.length > 28 ? '…' : ''} · ${form.maxCommuteMinutes} min commute`
        : 'Add commute, price & lifestyle preferences for personalized match scores'

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Hero + expandable search bar */}
            <div className="browse-hero">
                <h1>Find your next home</h1>
                <p>Search by commute time, budget, and the lifestyle that fits you — not just rooms and price.</p>

                <div className="search-bar-wrap" ref={panelWrapRef}>
                    <div className="search-bar-shell" onClick={() => setPanelOpen(o => !o)} role="button">
                        <Search size={18} color="var(--primary)" />
                        <span className="search-bar-segment" style={{ textAlign: 'left' }}>{searchSummary}</span>
                        <ChevronDown size={16} color="var(--text-dim)" style={{ transform: panelOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
                        <button type="button" className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setPanelOpen(o => !o) }}>
                            Search
                        </button>
                    </div>

                    {panelOpen && (
                        <div className="search-panel" onClick={e => e.stopPropagation()}>
                            {!user && (
                                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--primary-dim)', color: 'var(--primary)', fontSize: '0.85rem', marginBottom: 16 }}>
                                    Browsing as a guest — you can filter listings freely. Sign in to unlock commute-based match scoring and lifestyle templates.
                                </div>
                            )}
                            <form onSubmit={handleSearchSubmit}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Property basics */}
                                    <div>
                                        <h3 style={{ marginBottom: 16, fontSize: '0.95rem', color: 'var(--text-muted)' }}>🏠 Property Requirements</h3>
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
                                                <button type="button" onClick={() => update('residencyTypes', [])}
                                                    className={`btn btn-sm ${form.residencyTypes.length === 0 ? 'btn-primary' : 'btn-outline'}`}>Any</button>
                                                {RESIDENCY_TYPES.map(t => (
                                                    <button key={t} type="button"
                                                        onClick={() => { const cur = form.residencyTypes; update('residencyTypes', cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]) }}
                                                        className={`btn btn-sm ${form.residencyTypes.includes(t) ? 'btn-primary' : 'btn-outline'}`}>
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="form-grid" style={{ marginTop: 14 }}>
                                            <div className="form-group">
                                                <label className="form-label">Min Price (RM/mo)</label>
                                                <input className="input" type="number" min={0} value={form.priceMin} onChange={e => update('priceMin', e.target.value)} placeholder="e.g. 1500" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Max Price (RM/mo)</label>
                                                <input className="input" type="number" min={0} value={form.priceMax} onChange={e => update('priceMax', e.target.value)} placeholder="e.g. 3500" />
                                            </div>
                                        </div>

                                        {/* Property Area */}
                                        <div className="form-group" style={{ marginTop: 14 }}>
                                            <label className="form-label">Property Area <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 6 }}>— multi-select or type your own</span></label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    className="input"
                                                    placeholder="Type area (e.g. Cheras, Mont Kiara…)"
                                                    value={areaInput}
                                                    onChange={e => onAreaInputChange(e.target.value)}
                                                    onKeyDown={e => {
                                                        if ((e.key === 'Enter' || e.key === ',') && areaInput.trim()) {
                                                            e.preventDefault()
                                                            addArea(areaInput)
                                                        }
                                                    }}
                                                />
                                                {areaSuggestions.length > 0 && (
                                                    <div style={{
                                                        position: 'absolute', top: '100%', left: 0, right: 0,
                                                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                                                        zIndex: 300, maxHeight: 200, overflowY: 'auto',
                                                    }}>
                                                        {areaSuggestions.map(s => (
                                                            <button key={s} type="button"
                                                                onMouseDown={e => { e.preventDefault(); addArea(s) }}
                                                                style={{
                                                                    display: 'block', width: '100%', textAlign: 'left',
                                                                    padding: '8px 14px', border: 'none', background: 'none',
                                                                    cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)',
                                                                }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-dim)')}
                                                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                                            >{s}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {form.areas.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                                    {form.areas.map(a => (
                                                        <span key={a} style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            background: 'var(--primary-dim)', color: 'var(--primary)',
                                                            borderRadius: '999px', padding: '3px 10px', fontSize: '0.8rem', fontWeight: 600,
                                                        }}>
                                                            {a}
                                                            <button type="button" onClick={() => removeArea(a)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '0 0 0 2px', lineHeight: 1 }}>
                                                                <X size={11} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => update('areas', [])}>Clear all</button>
                                                </div>
                                            )}
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Press Enter or comma to add. Select from suggestions or type any custom area.</p>
                                        </div>
                                    </div>

                                    <div className="divider" style={{ margin: 0 }} />

                                    {/* Commute — gated for guests */}
                                    <div
                                        className={!isTenant ? 'gated-overlay' : undefined}
                                        onClick={!isTenant ? () => authModal.open({ intentMessage: 'Sign in as a tenant to use commute-based matching.' }) : undefined}
                                    >
                                        <h3 style={{ marginBottom: 16, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                                            <Car size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Commute Preferences
                                        </h3>
                                        <div className="form-group">
                                            <label className="form-label">Workplace Address</label>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <input ref={addressInputRef} className="input" type="text" autoComplete="off"
                                                        placeholder={mapsReady ? 'Start typing your workplace…' : 'Loading maps…'}
                                                        onInput={handleAddressType}
                                                        style={{ paddingRight: coordsSet ? 34 : undefined }} />
                                                    {coordsSet && <CheckCircle2 size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />}
                                                </div>
                                                <button type="button" className="btn btn-outline" onClick={() => setShowMapPicker(true)} style={{ flexShrink: 0 }}>
                                                    <MapPin size={14} /> Map
                                                </button>
                                            </div>
                                            {coordsSet ? (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 5 }}>✓ Location confirmed · {workplace.lat!.toFixed(5)}, {workplace.lng!.toFixed(5)}</p>
                                            ) : (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 5 }}>Select from the dropdown after typing, or click <strong>Map</strong> to pin manually.</p>
                                            )}
                                        </div>
                                        <div className="form-group" style={{ marginTop: 14 }}>
                                            <label className="form-label">Transport Mode <span style={{ fontWeight: 400, color: 'var(--text-dim)', marginLeft: 6, fontSize: '0.78rem' }}>(select all — best commute wins)</span></label>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {TRANSPORT_MODES.map(m => {
                                                    const active = form.transportModes.includes(m.value)
                                                    return (
                                                        <button key={m.value} type="button" onClick={() => toggleMode(m.value)}
                                                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>
                                                            {m.icon} {m.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ marginTop: 14 }}>
                                            <label className="form-label">
                                                <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                                Max Bearable Commute: <strong style={{ color: 'var(--primary)' }}>{form.maxCommuteMinutes} min</strong>
                                            </label>
                                            <input type="range" min={10} max={120} step={5} value={form.maxCommuteMinutes}
                                                onChange={e => update('maxCommuteMinutes', e.target.value)} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                        </div>
                                    </div>

                                    <div className="divider" style={{ margin: 0 }} />

                                    {/* Lifestyle template — gated */}
                                    <div
                                        className={!isTenant ? 'gated-overlay' : undefined}
                                        onClick={!isTenant ? () => authModal.open({ intentMessage: 'Sign in as a tenant to create and apply lifestyle templates.' }) : undefined}
                                    >
                                        <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: 'var(--text-muted)' }}>✨ Lifestyle Template</h3>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 10 }}>
                                            Score properties based on nearby places. {isTenant && <a href="/lifestyle">Manage templates →</a>}
                                        </p>
                                        <select className="select" value={form.lifestyleTemplateId} onChange={e => update('lifestyleTemplateId', e.target.value)} disabled={!isTenant}>
                                            <option value="">No lifestyle filter</option>
                                            {templates?.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.placeTypes.join(', ')})</option>)}
                                        </select>
                                    </div>

                                    {error && (
                                        <div style={{ padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: '0.875rem' }}>{error}</div>
                                    )}

                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button type="button" className="btn btn-ghost" onClick={() => setPanelOpen(false)}>Close</button>
                                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                                            {loading ? <><span className="spinner" /> Finding matches…</> : <><Search size={16} /> {isTenant ? 'Search Properties' : 'Search Listings'}</>}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            {showMapPicker && (
                mapsReady
                    ? <MapPickerModal
                        initialLat={workplace.lat ?? undefined}
                        initialLng={workplace.lng ?? undefined}
                        initialAddress={addressInputRef.current?.value ?? ''}
                        onConfirm={handleMapConfirm}
                        onClose={() => setShowMapPicker(false)}
                    />
                    : <div className="modal-overlay" onClick={() => setShowMapPicker(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <p>Google Maps is still loading — please wait a moment.</p>
                            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setShowMapPicker(false)}>Close</button>
                        </div>
                    </div>
            )}

            {/* Map */}
            <div style={{ position: 'relative', marginTop: 24 }}>
                <div ref={mapRef} style={{ width: '100%', height: 380 }} />
                {!mapsReady && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Loading map…
                    </div>
                )}
                <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(255,255,255,0.95)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-muted)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Viewing Activity</div>
                    {([
                        ['#16a34a', '1–5 viewings'],
                        ['#2563eb', '6–49 viewings'],
                        ['#dc2626', '50+ viewings'],
                    ] as const).map(([colour, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: colour, display: 'inline-block' }} />
                            {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div id="browse-results" style={{ padding: '20px 24px 0', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="input" style={{ width: 280 }} placeholder="Search by name or address…" value={filter} onChange={e => setFilter(e.target.value)} />
                <select className="input" style={{ width: 180 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    <option value="">All Types</option>
                    {RESIDENCY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</span>
                {basicFilters && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setBasicFilters(null)}>✕ Clear search filters</button>
                )}
            </div>

            {/* Cards grid */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner" /></div>
            ) : (
                <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {filtered.map((l: any) => (
                        <div key={l.id} className="listing-card" onClick={() => navigate(`/listing/${l.id}`, { state: { from: 'browse' } })}>
                            {l.images[0] ? (
                                <img src={l.images[0]} alt={l.name} className="listing-card-img" style={{ objectFit: 'cover' }} />
                            ) : (
                                <div className="listing-card-img"><Building2 size={28} /></div>
                            )}
                            <div className="listing-card-body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                                    <span className="listing-card-name" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                                    <span className="badge badge-grey" style={{ fontSize: '0.72rem', flexShrink: 0 }}>{l.residencyType}</span>
                                </div>
                                <div className="listing-card-meta" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={11} />{l.address}
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BedDouble size={12} />{l.rooms} bed</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Bath size={12} />{l.toilets} bath</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="listing-card-price">RM {l.price.toLocaleString()}<span style={{ fontSize: '0.75rem', fontWeight: 400 }}>/mo</span></span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>by {l.agentName}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}