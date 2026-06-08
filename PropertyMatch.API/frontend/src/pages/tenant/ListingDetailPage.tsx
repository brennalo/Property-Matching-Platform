import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { schedulesApi, scheduleSlotsApi } from '../../api'
import type { MatchedListing, ModeCommuteResult, TransitStep, BookedSlot } from '../../types'
import {
    ArrowLeft, Bed, Bath, MapPin, Clock, ExternalLink,
    CalendarPlus, ChevronLeft, ChevronRight, CheckCircle2, Navigation
} from 'lucide-react'

// ── Google Maps ready state ───────────────────────────────────────────────────
// Script is loaded once by App.tsx (GoogleMapsBootstrap). We just poll the flag.

declare global { interface Window { google: any; __gmapsReady: boolean } }

function useGoogleMaps() {
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

// ── Score helpers ─────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ color, fontWeight: 600 }}>{value.toFixed(0)}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
            </div>
        </div>
    )
}

function ScoreRing({ score }: { score: number }) {
    const r = 36, cx = 44, cy = 44, stroke = 5
    const circ = 2 * Math.PI * r
    const dash = (score / 100) * circ
    const color = score >= 70 ? '#3db8a0' : score >= 40 ? '#e8a045' : '#e05c5c'
    return (
        <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
            <svg width="88" height="88" viewBox="0 0 88 88">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                    transform={`rotate(-90 ${cx} ${cy})`} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.4rem', color, lineHeight: 1 }}>{score.toFixed(0)}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>score</span>
            </div>
        </div>
    )
}

// ── Image gallery ─────────────────────────────────────────────────────────────

function ImageGallery({ urls, name }: { urls: string[]; name: string }) {
    const [idx, setIdx] = useState(0)
    if (!urls.length) return (
        <div style={{ height: 320, background: 'var(--bg-input)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>🏠</div>
    )
    return (
        <div style={{ borderRadius: 14, overflow: 'hidden', background: '#000' }}>
            <div style={{ position: 'relative' }}>
                <img src={urls[idx]} alt={name} style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block' }} />
                {urls.length > 1 && (<>
                    <button onClick={() => setIdx(i => (i - 1 + urls.length) % urls.length)}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={() => setIdx(i => (i + 1) % urls.length)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                        <ChevronRight size={18} />
                    </button>
                    <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                        {urls.map((_, i) => (
                            <div key={i} onClick={() => setIdx(i)} style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                        ))}
                    </div>
                </>)}
            </div>
            {urls.length > 1 && (
                <div style={{ display: 'flex', gap: 6, padding: 8, background: 'rgba(0,0,0,0.8)' }}>
                    {urls.map((u, i) => (
                        <img key={i} src={u} alt="" onClick={() => setIdx(i)}
                            style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: i === idx ? '2px solid var(--accent)' : '2px solid transparent', opacity: i === idx ? 1 : 0.6, transition: 'all 0.15s' }} />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Transit itinerary ─────────────────────────────────────────────────────────
// Styled like the Google Maps transit view in the screenshot

// Merge consecutive WALK steps into one (Google Routes sometimes splits them)
function mergeWalkSteps(steps: TransitStep[]): TransitStep[] {
    const merged: TransitStep[] = []
    for (const step of steps) {
        const prev = merged[merged.length - 1]
        if (step.type === 'WALK' && prev?.type === 'WALK') {
            // Accumulate duration and distance
            merged[merged.length - 1] = {
                ...prev,
                durationMinutes: prev.durationMinutes + step.durationMinutes,
                distanceKm: Math.round((prev.distanceKm + step.distanceKm) * 1000) / 1000,
                polylineEncoded: null, // combined polyline not worth merging
            }
        } else {
            merged.push(step)
        }
    }
    return merged
}

function TransitItinerary({ steps: rawSteps }: { steps: TransitStep[] }) {
    const steps = mergeWalkSteps(rawSteps)
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map((step, i) => {
                const isTransit = step.type === 'TRANSIT'
                const lineColor = step.lineColor ? `#${step.lineColor.replace('#', '')}` : '#4285F4'
                const textColor = step.lineTextColor ? `#${step.lineTextColor.replace('#', '')}` : '#fff'
                const isLast = i === steps.length - 1

                return (
                    <div key={i} style={{ display: 'flex', gap: 0 }}>
                        {/* Timeline column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
                            {/* Circle node */}
                            <div style={{
                                width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                                background: isTransit ? lineColor : 'var(--border-hi)',
                                border: '2px solid var(--bg-card)',
                                zIndex: 1, marginTop: i === 0 ? 4 : 0,
                            }} />
                            {/* Connector line — colored for transit, dotted for walk */}
                            {!isLast && (
                                <div style={{
                                    flex: 1, width: 3, minHeight: 40,
                                    background: isTransit ? lineColor : 'transparent',
                                    borderLeft: isTransit ? 'none' : '3px dotted var(--border-hi)',
                                    marginLeft: isTransit ? 0 : -0.5,
                                }} />
                            )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, paddingLeft: 12, paddingBottom: isLast ? 0 : 4 }}>
                            {isTransit ? (
                                <div style={{ marginBottom: 8 }}>
                                    {/* Departure stop */}
                                    {step.departureStop && (
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>
                                            {step.departureStop}
                                        </div>
                                    )}

                                    {/* Line chip + direction — like the coloured pill in Google Maps */}
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        background: 'var(--bg-input)', borderRadius: 8,
                                        padding: '8px 12px', marginBottom: 6,
                                        border: `1px solid ${lineColor}30`
                                    }}>
                                        {/* Coloured line badge */}
                                        <span style={{
                                            background: lineColor, color: textColor,
                                            padding: '2px 8px', borderRadius: 4,
                                            fontSize: '0.78rem', fontWeight: 700, letterSpacing: 0.5,
                                            flexShrink: 0,
                                        }}>
                                            {step.vehicleIcon ?? '🚌'} {step.lineName ?? '—'}
                                        </span>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {step.headSign && (
                                                <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                                                    {step.headSign}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                                {step.durationMinutes} min
                                                {step.numStops != null ? ` · ${step.numStops} stop${step.numStops === 1 ? '' : 's'}` : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Arrival stop */}
                                    {step.arrivalStop && (
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                                            {step.arrivalStop}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Walk step — compact */
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                    <span>🚶 Walk</span>
                                    <span style={{ color: 'var(--text-dim)' }}>
                                        {step.durationMinutes > 0 ? `${step.durationMinutes} min` : 'About 1 min'}
                                        {step.distanceKm > 0 ? ` · ${(step.distanceKm * 1000).toFixed(0)} m` : ''}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ── Lifestyle places map ─────────────────────────────────────────────────────
// Uses the Maps JS PlacesService to search nearby and plot markers for each
// lifestyle category — no backend changes needed.

const CATEGORY_COLORS: Record<string, string> = {
    cafe: '#8B4513', gym: '#1565C0', restaurant: '#E65100',
    supermarket: '#2E7D32', pharmacy: '#6A1B9A', hospital: '#C62828',
    park: '#388E3C', school: '#F57F17', library: '#4527A0',
    shopping_mall: '#AD1457', night_club: '#283593', bar: '#4E342E',
    convenience_store: '#00695C', movie_theater: '#6D4C41',
    laundry: '#0277BD', atm: '#558B2F',
}

const CATEGORY_LABELS: Record<string, string> = {
    cafe: 'Café', gym: 'Gym', restaurant: 'Restaurant',
    supermarket: 'Supermarket', pharmacy: 'Pharmacy', hospital: 'Hospital',
    park: 'Park', school: 'School', library: 'Library',
    shopping_mall: 'Mall', night_club: 'Nightclub', bar: 'Bar',
    convenience_store: 'Convenience', movie_theater: 'Cinema',
    laundry: 'Laundry', atm: 'ATM',
}

interface PlaceResult { lat: number; lng: number; name: string; type: string }

function LifestyleMapCard({ listingLat, listingLng, lifestyleCounts, mapsReady }: {
    listingLat: number; listingLng: number
    lifestyleCounts: Record<string, number>
    mapsReady: boolean
}) {
    const mapDivRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const [places, setPlaces] = useState<PlaceResult[]>([])
    const [loading, setLoading] = useState(false)
    const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(Object.keys(lifestyleCounts)))
    const [searched, setSearched] = useState(false)

    // Init map once ready
    useEffect(() => {
        if (!mapsReady || !mapDivRef.current || mapRef.current) return
        mapRef.current = new window.google.maps.Map(mapDivRef.current, {
            center: { lat: listingLat, lng: listingLng },
            zoom: 15,
            mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        })
        // Property marker
        new window.google.maps.Marker({
            position: { lat: listingLat, lng: listingLng },
            map: mapRef.current,
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10, fillColor: '#e8a045', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2,
            },
            label: { text: '🏠', fontSize: '16px' },
            title: 'This property',
            zIndex: 100,
        })
        // 800m radius circle
        new window.google.maps.Circle({
            map: mapRef.current,
            center: { lat: listingLat, lng: listingLng },
            radius: 800,
            strokeColor: '#e8a045', strokeOpacity: 0.4, strokeWeight: 1,
            fillColor: '#e8a045', fillOpacity: 0.04,
        })
    }, [mapsReady])

    // Search nearby using PlacesService (legacy but still works with Places API enabled)
    // Places API (New) searchNearby requires billing and specific setup — use legacy for reliability
    const searchPlaces = useCallback(() => {
        if (!mapsReady || !mapRef.current || searched) return
        setLoading(true)
        setSearched(true)
        // Trigger resize after div becomes visible (display:none → block)
        setTimeout(() => window.google.maps.event.trigger(mapRef.current, 'resize'), 50)

        const allPlaces: PlaceResult[] = []
        const categories = Object.keys(lifestyleCounts)
        const service = new window.google.maps.places.PlacesService(mapRef.current)
        let pending = categories.length

        const done = () => {
            pending -= 1
            if (pending === 0) {
                setPlaces([...allPlaces])
                setLoading(false)
            }
        }

        categories.forEach(type => {
            service.nearbySearch({
                location: { lat: listingLat, lng: listingLng },
                radius: 800,
                type,
            }, (results: any[], status: string) => {
                if (results && status === window.google.maps.places.PlacesServiceStatus.OK) {
                    results.slice(0, 10).forEach((r: any) => {
                        allPlaces.push({
                            lat: r.geometry.location.lat(),
                            lng: r.geometry.location.lng(),
                            name: r.name ?? type,
                            type,
                        })
                    })
                }
                done()
            })
        })

        if (categories.length === 0) {
            setPlaces([])
            setLoading(false)
        }
    }, [mapsReady, searched, lifestyleCounts, listingLat, listingLng])

    // Draw/redraw markers when places or active filter changes
    useEffect(() => {
        if (!mapRef.current || places.length === 0) return

        // Clear old markers
        markersRef.current.forEach(m => m.setMap(null))
        markersRef.current = []

        places.filter(p => activeTypes.has(p.type)).forEach(p => {
            const color = CATEGORY_COLORS[p.type] ?? '#555'
            const marker = new window.google.maps.Marker({
                position: { lat: p.lat, lng: p.lng },
                map: mapRef.current,
                title: p.name,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 7, fillColor: color, fillOpacity: 0.9,
                    strokeColor: '#fff', strokeWeight: 1.5,
                },
                zIndex: 50,
            })
            // Info window on click
            const iw = new window.google.maps.InfoWindow({
                content: `<div style="font-family:sans-serif;font-size:13px;padding:2px 4px"><strong>${p.name}</strong><br/><span style="color:#666">${CATEGORY_LABELS[p.type] ?? p.type}</span></div>`,
            })
            marker.addListener('click', () => iw.open(mapRef.current, marker))
            markersRef.current.push(marker)
        })
    }, [places, activeTypes])

    const toggleType = (type: string) => {
        setActiveTypes(prev => {
            const next = new Set(prev)
            if (next.has(type)) next.delete(type)
            else next.add(type)
            return next
        })
    }

    const categories = Object.entries(lifestyleCounts)

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Nearby Places (within 800m)</h3>
                {!searched && mapsReady && (
                    <button className="btn btn-outline btn-sm" onClick={searchPlaces} disabled={loading}>
                        {loading ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Searching…</> : '🗺️ Show on map'}
                    </button>
                )}
            </div>

            {/* Category count chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: searched ? 12 : 0 }}>
                {categories.map(([type, count]) => {
                    const color = CATEGORY_COLORS[type] ?? '#888'
                    const label = CATEGORY_LABELS[type] ?? type
                    const isActive = activeTypes.has(type)
                    return (
                        <button key={type} type="button"
                            onClick={() => searched && toggleType(type)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '4px 10px', borderRadius: 99,
                                fontSize: '0.75rem', cursor: searched ? 'pointer' : 'default',
                                border: `1.5px solid ${isActive ? color : 'var(--border)'}`,
                                background: isActive ? `${color}18` : 'transparent',
                                color: isActive ? color : 'var(--text-dim)',
                                transition: 'all 0.15s',
                            }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? color : 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
                            {label} <span style={{ fontWeight: 700 }}>{count}</span>
                        </button>
                    )
                })}
            </div>

            {/* Map div always mounted so mapRef initialises — hidden until searched */}
            <div ref={mapDivRef}
                style={{
                    width: '100%', height: 320, borderRadius: 10,
                    border: '1px solid var(--border)', marginTop: 4,
                    display: searched ? 'block' : 'none',
                }} />

            {searched && !loading && places.length === 0 && (
                <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 8 }}>
                    No places found nearby for these categories.
                </p>
            )}
            {searched && !loading && places.length > 0 && (
                <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 8 }}>
                    Click any marker for its name. Toggle categories above to show/hide.
                </p>
            )}
        </div>
    )
}

// ── Route map ─────────────────────────────────────────────────────────────────

const MODE_COLORS: Record<string, string> = {
    Driving: '#4285F4', Transit: '#0F9D58', Walking: '#F4B400', Bicycling: '#DB4437',
}
const MODE_ICONS: Record<string, string> = {
    Driving: '🚗', Transit: '🚇', Walking: '🚶', Bicycling: '🚲',
}

function RouteMap({
    listingLat, listingLng, workplaceLat, workplaceLng,
    commuteRoutes, mapsReady,
}: {
    listingLat: number; listingLng: number
    workplaceLat: number; workplaceLng: number
    commuteRoutes: ModeCommuteResult[]
    mapsReady: boolean
}) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstance = useRef<any>(null)
    const polylineRef = useRef<any[]>([])   // array — transit draws per-step lines
    const markersRef = useRef<any[]>([])
    const [activeMode, setActiveMode] = useState<string>(commuteRoutes[0]?.mode ?? 'Driving')
    const [showItinerary, setShowItinerary] = useState(false)

    // Init map once
    useEffect(() => {
        if (!mapsReady || !mapRef.current || mapInstance.current) return
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: listingLat, lng: listingLng },
            zoom: 13,
            mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
        })
    }, [mapsReady])

    // Redraw when mode changes
    useEffect(() => {
        if (!mapsReady || !mapInstance.current) return
        const map = mapInstance.current

        // Clear previous overlays
        polylineRef.current.forEach(p => p.setMap(null))
        polylineRef.current = []
        markersRef.current.forEach(m => m.setMap(null))
        markersRef.current = []

        const route = commuteRoutes.find(r => r.mode === activeMode)
        const color = MODE_COLORS[activeMode] ?? '#4285F4'
        const bounds = new window.google.maps.LatLngBounds()

        // Origin marker (property)
        const mHome = new window.google.maps.Marker({
            position: { lat: listingLat, lng: listingLng }, map,
            icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
            label: { text: '🏠', fontSize: '16px' }, zIndex: 10,
        })
        // Destination marker (workplace)
        const mWork = new window.google.maps.Marker({
            position: { lat: workplaceLat, lng: workplaceLng }, map,
            icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#e05c5c', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
            label: { text: '💼', fontSize: '16px' }, zIndex: 10,
        })
        markersRef.current = [mHome, mWork]
        bounds.extend({ lat: listingLat, lng: listingLng })
        bounds.extend({ lat: workplaceLat, lng: workplaceLng })

        if (route?.transitSteps?.length) {
            // Transit mode: draw each step with its own colour
            for (const step of route.transitSteps) {
                if (!step.polylineEncoded) continue
                const segColor = step.type === 'TRANSIT' && step.lineColor
                    ? `#${step.lineColor.replace('#', '')}`
                    : step.type === 'TRANSIT' ? color : '#9e9b95'

                const path = window.google.maps.geometry.encoding.decodePath(step.polylineEncoded)
                path.forEach((pt: any) => bounds.extend(pt))

                if (step.type === 'WALK') {
                    // Dotted for walk segments
                    polylineRef.current.push(new window.google.maps.Polyline({
                        path, geodesic: true, strokeOpacity: 0,
                        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 }, offset: '0', repeat: '15px' }],
                        strokeColor: segColor, map,
                    }))
                } else {
                    polylineRef.current.push(new window.google.maps.Polyline({
                        path, geodesic: true, strokeColor: segColor, strokeOpacity: 0.9, strokeWeight: 5, map,
                    }))
                }
            }
        } else if (route?.encodedPolyline) {
            // Non-transit or transit without step data: single overview polyline
            const path = window.google.maps.geometry.encoding.decodePath(route.encodedPolyline)
            path.forEach((pt: any) => bounds.extend(pt))
            polylineRef.current.push(new window.google.maps.Polyline({
                path, geodesic: true, strokeColor: color, strokeOpacity: 0.85, strokeWeight: 5, map,
            }))
        } else {
            // Fallback straight dashed line
            polylineRef.current.push(new window.google.maps.Polyline({
                path: [{ lat: listingLat, lng: listingLng }, { lat: workplaceLat, lng: workplaceLng }],
                geodesic: true, strokeOpacity: 0,
                icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 4 }, offset: '0', repeat: '20px' }],
                strokeColor: color, map,
            }))
        }

        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
    }, [mapsReady, activeMode, commuteRoutes])

    const activeRoute = commuteRoutes.find(r => r.mode === activeMode)
    const hasTransitSteps = activeRoute?.transitSteps && activeRoute.transitSteps.length > 0

    return (
        <div>
            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {commuteRoutes.map(r => (
                    <button key={r.mode} type="button"
                        onClick={() => { setActiveMode(r.mode); setShowItinerary(false) }}
                        className={`btn btn-sm ${activeMode === r.mode ? 'btn-primary' : 'btn-outline'}`}>
                        {MODE_ICONS[r.mode]} {r.mode}
                        <span style={{ fontWeight: 400, fontSize: '0.75rem', opacity: 0.85 }}>· {r.durationMinutes} min</span>
                    </button>
                ))}
            </div>

            {/* Map canvas */}
            {mapsReady ? (
                <div ref={mapRef} style={{ width: '100%', height: 360, borderRadius: 12, border: '1px solid var(--border)' }} />
            ) : (
                <div style={{ height: 360, background: 'var(--bg-input)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <span className="spinner" style={{ marginRight: 8 }} /> Loading map…
                </div>
            )}

            {/* Route summary bar */}
            {activeRoute && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, display: 'flex', gap: 16, fontSize: '0.83rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span><Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /><strong style={{ color: 'var(--text)' }}>{activeRoute.durationMinutes} min</strong></span>
                    <span><Navigation size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /><strong style={{ color: 'var(--text)' }}>{activeRoute.distanceKm} km</strong></span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {MODE_ICONS[activeRoute.mode]} {activeRoute.mode}
                        {hasTransitSteps && (
                            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                                onClick={() => setShowItinerary(v => !v)}>
                                {showItinerary ? 'Hide steps' : 'Show steps'}
                            </button>
                        )}
                        {!activeRoute.encodedPolyline && !hasTransitSteps && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(approximate)</span>
                        )}
                    </span>
                </div>
            )}

            {/* Transit itinerary panel */}
            {showItinerary && hasTransitSteps && (
                <div style={{
                    marginTop: 12, padding: '16px 18px',
                    background: 'var(--bg-input)', borderRadius: 12,
                    border: '1px solid var(--border)',
                }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                        Transit Itinerary
                    </p>
                    <TransitItinerary steps={activeRoute!.transitSteps!} />
                </div>
            )}
        </div>
    )
}

// ── Calendar picker — time-slot aware ─────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Available hour options
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => {
    const h = i + 8  // 8am–8pm
    return { value: `${String(h).padStart(2, '0')}:00`, label: h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM` }
})

function CalendarPicker({
    selectedDate, selectedTime,
    onSelectDate, onSelectTime,
    bookedSlots,
}: {
    selectedDate: string
    selectedTime: string
    onSelectDate: (d: string) => void
    onSelectTime: (t: string) => void
    bookedSlots: BookedSlot[]
}) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())

    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

    // Build a set of booked datetime strings — ISO date+time
    const safeSlots = Array.isArray(bookedSlots) ? bookedSlots : []
    const bookedSet = new Set(
        safeSlots.map(s => {
            const d = new Date(s.scheduledAt)
            // Normalise to local HH:00 so we can compare
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`
        })
    )

    // Which times are taken for the selected date?
    const takenTimesForDate = selectedDate
        ? HOUR_OPTIONS.filter(h => bookedSet.has(`${selectedDate}T${h.value}`))
        : []

    const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1)
    const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1)

    return (
        <div>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{MONTHS[viewMonth]} {viewYear}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                {WEEK.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>{d}</div>)}
            </div>

            {/* Date cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {cells.map((day, i) => {
                    if (!day) return <div key={i} />
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const cellDate = new Date(viewYear, viewMonth, day)
                    const isPast = cellDate < today
                    const isSel = selectedDate === dateStr
                    const isToday = cellDate.getTime() === today.getTime()

                    // Count how many slots are booked on this day
                    const bookedCount = HOUR_OPTIONS.filter(h => bookedSet.has(`${dateStr}T${h.value}`)).length
                    const fullyBooked = bookedCount >= HOUR_OPTIONS.length

                    let bg = 'transparent', color = 'var(--text)', cursor = 'pointer'
                    if (isPast) { color = 'var(--text-dim)'; cursor = 'not-allowed' }
                    if (fullyBooked && !isPast) { bg = 'var(--red-dim)'; color = 'var(--red)'; cursor = 'not-allowed' }
                    if (isSel) { bg = 'var(--accent)'; color = '#0f0f0e' }
                    if (isToday && !isSel) { color = 'var(--accent)' }

                    return (
                        <div key={i} title={fullyBooked ? 'Fully booked' : undefined}
                            onClick={() => { if (!isPast && !fullyBooked) onSelectDate(dateStr) }}
                            style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 6, fontSize: '0.82rem', fontWeight: isToday ? 700 : 400, background: bg, color, cursor, border: isToday && !isSel ? '1px solid var(--accent)' : '1px solid transparent', position: 'relative' }}>
                            {day}
                            {/* Dot indicator for partial bookings */}
                            {bookedCount > 0 && !fullyBooked && !isSel && (
                                <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                            )}
                            {fullyBooked && (
                                <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--red)' }} />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />Partially booked
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />Fully booked
                </span>
            </div>

            {/* Time slot picker — only shown once a date is selected */}
            {selectedDate && (
                <div style={{ marginTop: 16 }}>
                    <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>Pick a Time Slot</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {HOUR_OPTIONS.map(h => {
                            const isTaken = bookedSet.has(`${selectedDate}T${h.value}`)
                            const isActive = selectedTime === h.value
                            return (
                                <button key={h.value} type="button"
                                    disabled={isTaken}
                                    onClick={() => onSelectTime(h.value)}
                                    className={`btn btn-sm ${isActive ? 'btn-primary' : isTaken ? '' : 'btn-outline'}`}
                                    style={{
                                        justifyContent: 'center', fontSize: '0.75rem',
                                        background: isTaken ? 'var(--red-dim)' : undefined,
                                        color: isTaken ? 'var(--red)' : undefined,
                                        border: isTaken ? '1px solid var(--red-dim)' : undefined,
                                        cursor: isTaken ? 'not-allowed' : 'pointer',
                                        opacity: isTaken ? 0.7 : 1,
                                        textDecoration: isTaken ? 'line-through' : 'none',
                                    }}>
                                    {h.label}
                                </button>
                            )
                        })}
                    </div>
                    {takenTimesForDate.length > 0 && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 8 }}>
                            Strikethrough slots are already booked by other tenants.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Schedule modal ─────────────────────────────────────────────────────────────

function ScheduleModal({ listingId, listingName, onClose }: {
    listingId: string; listingName: string; onClose: () => void
}) {
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    // Fetch all booked slots for this listing (public endpoint)
    const { data: bookedSlotsRaw } = useQuery({
        queryKey: ['booked-slots', listingId],
        queryFn: (): Promise<BookedSlot[]> => scheduleSlotsApi.getBookedSlots(listingId).then(r => r.data as BookedSlot[]),
        staleTime: 30_000,
    })
    const bookedSlots: BookedSlot[] = Array.isArray(bookedSlotsRaw) ? bookedSlotsRaw : []

    const handleBook = async () => {
        if (!date || !time) return
        setLoading(true); setError('')
        try {
            await schedulesApi.create(listingId, new Date(`${date}T${time}:00`))
            setSuccess(true)
        } catch (e: any) {
            setError(e.response?.data?.message ?? 'Booking failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 520, width: '100%' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h2 style={{ fontSize: '1.1rem' }}>Schedule a Viewing</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>{listingName}</p>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <CheckCircle2 size={48} style={{ color: 'var(--accent)', marginBottom: 12 }} />
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>Viewing Scheduled!</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            {new Date(`${date}T${time}`).toLocaleString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 8 }}>The agent will confirm shortly.</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
                    </div>
                ) : (
                    <>
                        <CalendarPicker
                            selectedDate={date}
                            selectedTime={time}
                            onSelectDate={d => { setDate(d); setTime('') }}
                            onSelectTime={setTime}
                            bookedSlots={bookedSlots}
                        />

                        {date && time && (
                            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                                📅 {new Date(`${date}T${time}`).toLocaleString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}

                        {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: 10 }}>{error}</p>}

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleBook} disabled={!date || !time || loading}>
                                {loading ? <span className="spinner" /> : <><CalendarPlus size={14} /> Confirm Booking</>}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ListingDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()

    const [result, setResult] = useState<MatchedListing | null>(null)
    const [workplaceLat, setWorkplaceLat] = useState<number | null>(null)
    const [workplaceLng, setWorkplaceLng] = useState<number | null>(null)
    const [showSchedule, setShowSchedule] = useState(false)

    const mapsReady = useGoogleMaps()

    useEffect(() => {
        const raw = sessionStorage.getItem('matchResults')
        const reqRaw = sessionStorage.getItem('matchReq')
        if (!raw || !id) { navigate('/results'); return }

        const results: MatchedListing[] = JSON.parse(raw)
        const found = results.find(r => r.listing.id === id)
        if (!found) { navigate('/results'); return }
        setResult(found)

        if (reqRaw) {
            const req = JSON.parse(reqRaw)
            setWorkplaceLat(req.workplaceLat ?? null)
            setWorkplaceLng(req.workplaceLng ?? null)
        }
    }, [id])

    if (!result) return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner" /></div>

    const { listing } = result
    const isScraped = !!listing.sourceUrl
    const hasRoutes = result.commuteRoutes.length > 0 && workplaceLat && workplaceLng

    return (
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate('/results')}>
                <ArrowLeft size={14} /> Back to Results
            </button>

            <ImageGallery urls={listing.imageUrls} name={listing.name} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, marginTop: 24, alignItems: 'start' }}>

                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Header */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <h1 style={{ fontSize: '1.6rem', fontFamily: 'DM Serif Display, serif', marginBottom: 4 }}>{listing.name}</h1>
                                {listing.sourcePlatform && <span className="badge badge-grey" style={{ marginBottom: 8, display: 'inline-block' }}>{listing.sourcePlatform}</span>}
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={14} /> {listing.address}
                                </p>
                            </div>
                            <ScoreRing score={result.totalScore} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                            <span className="badge badge-grey"><Bed size={12} /> {listing.rooms} bed</span>
                            <span className="badge badge-grey"><Bath size={12} /> {listing.toilets} bath</span>
                            <span className="badge badge-grey">{listing.residencyType}</span>
                            {result.commuteMinutes && <span className="badge badge-grey"><Clock size={12} /> {result.commuteMinutes} min</span>}
                        </div>
                        <div style={{ color: 'var(--accent)', fontFamily: 'DM Serif Display, serif', fontSize: '2rem', marginTop: 12 }}>
                            RM {listing.price.toLocaleString()}/mo
                        </div>
                    </div>

                    {/* Score breakdown */}
                    <div className="card">
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>Match Score Breakdown</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <ScoreBar label="Numeric match (40%)" value={result.numericScore} color="#3db8a0" />
                            <ScoreBar label="Commute score (30%)" value={result.commuteScore} color="#e8a045" />
                            <ScoreBar label="Lifestyle score (30%)" value={result.lifestyleScore} color="#a78bfa" />
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                <ScoreBar label="Overall score" value={result.totalScore} color="var(--text)" />
                            </div>
                        </div>
                    </div>

                    {/* Lifestyle counts + nearby places map */}
                    {Object.keys(result.lifestyleCounts).length > 0 && (
                        <LifestyleMapCard
                            listingLat={listing.lat}
                            listingLng={listing.lng}
                            lifestyleCounts={result.lifestyleCounts}
                            mapsReady={mapsReady}
                        />
                    )}

                    {/* Route map */}
                    {hasRoutes && (
                        <div className="card">
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>🗺️ Commute Route</h3>
                            <RouteMap
                                listingLat={listing.lat} listingLng={listing.lng}
                                workplaceLat={workplaceLat!} workplaceLng={workplaceLng!}
                                commuteRoutes={result.commuteRoutes}
                                mapsReady={mapsReady}
                            />
                        </div>
                    )}
                </div>

                {/* Right sticky column */}
                <div style={{ position: 'sticky', top: 80 }}>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Interested?</h3>
                        {isScraped ? (
                            <>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Sourced from {listing.sourcePlatform}. Contact the agent via the original platform.
                                </p>
                                <a href={listing.sourceUrl!} target="_blank" rel="noopener noreferrer"
                                    className="btn btn-outline w-full" style={{ justifyContent: 'center' }}>
                                    <ExternalLink size={14} /> View on {listing.sourcePlatform}
                                </a>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Book a viewing with the agent.</p>
                                <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }}
                                    onClick={() => setShowSchedule(true)}>
                                    <CalendarPlus size={14} /> Schedule a Viewing
                                </button>
                            </>
                        )}

                        <div className="divider" />

                        {/* Quick facts */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                            {[
                                ['Listed by', listing.agentName],
                                ['Type', listing.residencyType],
                                ['Bedrooms', String(listing.rooms)],
                                ['Bathrooms', String(listing.toilets)],
                                ...(result.commuteMinutes ? [['Best commute', `${result.commuteMinutes} min`]] : []),
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{k}</span>
                                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</span>
                                </div>
                            ))}
                        </div>

                        {result.commuteRoutes.length > 0 && (
                            <>
                                <div className="divider" />
                                <p style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Commute by mode</p>
                                {result.commuteRoutes.map(r => (
                                    <div key={r.mode} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>{MODE_ICONS[r.mode]} {r.mode}</span>
                                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{r.durationMinutes} min · {r.distanceKm} km</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {showSchedule && (
                <ScheduleModal
                    listingId={listing.id}
                    listingName={listing.name}
                    onClose={() => setShowSchedule(false)}
                />
            )}
        </div>
    )
}
