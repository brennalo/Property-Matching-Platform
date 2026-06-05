import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { schedulesApi } from '../../api'
import type { MatchedListing, ModeCommuteResult, TransportMode, ViewingSchedule } from '../../types'
import {
    ArrowLeft, Bed, Bath, MapPin, Clock, ExternalLink,
    CalendarPlus, ChevronLeft, ChevronRight, CheckCircle2, Navigation
} from 'lucide-react'

// ── Google Maps loader ────────────────────────────────────────────────────────

declare global {
    interface Window {
        google: any
        initGoogleMapsDetail: () => void
    }
}

function useGoogleMaps(apiKey: string) {
    const [ready, setReady] = useState(!!window.google?.maps)
    useEffect(() => {
        if (window.google?.maps) { setReady(true); return }
        if (document.getElementById('gmap-script-detail')) return
        window.initGoogleMapsDetail = () => setReady(true)
        const s = document.createElement('script')
        s.id = 'gmap-script-detail'
        s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=initGoogleMapsDetail`
        s.async = true
        document.head.appendChild(s)
    }, [apiKey])
    return ready
}

// ── Score components ───────────────────────────────────────────────────────────

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
    if (urls.length === 0) {
        return (
            <div style={{ height: 320, background: 'var(--bg-input)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>🏠</div>
        )
    }
    return (
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
            <img src={urls[idx]} alt={name} style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block' }} />
            {urls.length > 1 && (
                <>
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
                            <div key={i} onClick={() => setIdx(i)}
                                style={{ width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'background 0.2s' }} />
                        ))}
                    </div>
                </>
            )}
            {urls.length > 1 && (
                <div style={{ display: 'flex', gap: 6, padding: '8px 0 0' }}>
                    {urls.map((u, i) => (
                        <img key={i} src={u} alt="" onClick={() => setIdx(i)}
                            style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: i === idx ? '2px solid var(--accent)' : '2px solid transparent', opacity: i === idx ? 1 : 0.65, transition: 'all 0.15s' }} />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Route map — real Google Maps canvas with decoded polyline ─────────────────

const MODE_COLORS: Record<string, string> = {
    Driving: '#4285F4',
    Transit: '#0F9D58',
    Walking: '#F4B400',
    Bicycling: '#DB4437',
}
const MODE_ICONS: Record<string, string> = {
    Driving: '🚗', Transit: '🚇', Walking: '🚶', Bicycling: '🚲',
}

function RouteMap({
    listingLat, listingLng,
    workplaceLat, workplaceLng,
    commuteRoutes,
    mapsReady,
}: {
    listingLat: number; listingLng: number
    workplaceLat: number; workplaceLng: number
    commuteRoutes: ModeCommuteResult[]
    mapsReady: boolean
}) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstance = useRef<any>(null)
    const polylineRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const [activeMode, setActiveMode] = useState<string>(commuteRoutes[0]?.mode ?? 'Driving')

    // Initialise map
    useEffect(() => {
        if (!mapsReady || !mapRef.current || mapInstance.current) return
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: listingLat, lng: listingLng },
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
        })
    }, [mapsReady])

    // Draw route whenever active mode changes
    useEffect(() => {
        if (!mapsReady || !mapInstance.current) return
        const map = mapInstance.current

        // Clear previous polyline and markers
        polylineRef.current?.setMap(null)
        markersRef.current.forEach(m => m.setMap(null))
        markersRef.current = []

        const route = commuteRoutes.find(r => r.mode === activeMode)
        const color = MODE_COLORS[activeMode] ?? '#4285F4'

        // Origin marker (listing) — home icon
        const listingMarker = new window.google.maps.Marker({
            position: { lat: listingLat, lng: listingLng },
            map,
            title: 'Property',
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
            },
            label: { text: '🏠', fontSize: '16px' },
            zIndex: 10,
        })

        // Destination marker (workplace)
        const workplaceMarker = new window.google.maps.Marker({
            position: { lat: workplaceLat, lng: workplaceLng },
            map,
            title: 'Workplace',
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#e05c5c',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
            },
            label: { text: '💼', fontSize: '16px' },
            zIndex: 10,
        })
        markersRef.current = [listingMarker, workplaceMarker]

        if (route?.encodedPolyline) {
            // Decode using Google Maps geometry library
            const path = window.google.maps.geometry.encoding.decodePath(route.encodedPolyline)

            polylineRef.current = new window.google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.85,
                strokeWeight: 5,
                map,
            })

            // Fit map to the polyline bounds
            const bounds = new window.google.maps.LatLngBounds()
            path.forEach((pt: any) => bounds.extend(pt))
            map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
        } else {
            // No polyline available — just fit the two points
            const bounds = new window.google.maps.LatLngBounds()
            bounds.extend({ lat: listingLat, lng: listingLng })
            bounds.extend({ lat: workplaceLat, lng: workplaceLng })
            map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })

            // Draw a dashed straight line as fallback
            polylineRef.current = new window.google.maps.Polyline({
                path: [
                    { lat: listingLat, lng: listingLng },
                    { lat: workplaceLat, lng: workplaceLng },
                ],
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0,
                icons: [{
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 4 },
                    offset: '0', repeat: '20px',
                }],
                map,
            })
        }
    }, [mapsReady, activeMode, commuteRoutes])

    const activeRoute = commuteRoutes.find(r => r.mode === activeMode)

    return (
        <div>
            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {commuteRoutes.map(r => (
                    <button key={r.mode} type="button"
                        onClick={() => setActiveMode(r.mode)}
                        className={`btn btn-sm ${activeMode === r.mode ? 'btn-primary' : 'btn-outline'}`}
                        style={{ gap: 4 }}>
                        {MODE_ICONS[r.mode] ?? '🚶'} {r.mode}
                        <span style={{ fontWeight: 400, fontSize: '0.75rem', opacity: 0.85 }}>
                            · {r.durationMinutes} min
                        </span>
                    </button>
                ))}
            </div>

            {/* Map canvas */}
            {mapsReady ? (
                <div ref={mapRef}
                    style={{ width: '100%', height: 360, borderRadius: 12, border: '1px solid var(--border)' }} />
            ) : (
                <div style={{ height: 360, background: 'var(--bg-input)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <span className="spinner" style={{ marginRight: 8 }} /> Loading map…
                </div>
            )}

            {/* Route summary bar */}
            {activeRoute && (
                <div style={{
                    marginTop: 10, padding: '10px 14px', background: 'var(--bg-input)',
                    borderRadius: 8, display: 'flex', gap: 20, fontSize: '0.83rem', color: 'var(--text-muted)'
                }}>
                    <span>
                        <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        <strong style={{ color: 'var(--text)' }}>{activeRoute.durationMinutes} min</strong>
                    </span>
                    <span>
                        <Navigation size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        <strong style={{ color: 'var(--text)' }}>{activeRoute.distanceKm} km</strong>
                    </span>
                    <span style={{ marginLeft: 'auto' }}>
                        {MODE_ICONS[activeRoute.mode]} {activeRoute.mode}
                        {!activeRoute.encodedPolyline && (
                            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                (approximate straight-line)
                            </span>
                        )}
                    </span>
                </div>
            )}
        </div>
    )
}

// ── Calendar picker ───────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarPicker({ selectedDate, onSelect, bookedDates }: {
    selectedDate: string
    onSelect: (date: string) => void
    bookedDates: string[]
}) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())

    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

    const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1)
    const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1)

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{MONTHS[viewMonth]} {viewYear}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, padding: '2px 0' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {cells.map((day, i) => {
                    if (!day) return <div key={i} />
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const cellDate = new Date(viewYear, viewMonth, day)
                    const isPast = cellDate < today
                    const isBooked = bookedDates.includes(dateStr)
                    const isSel = selectedDate === dateStr
                    const isToday = cellDate.getTime() === today.getTime()

                    let bg = 'transparent', color = 'var(--text)', cursor = 'pointer', title = ''
                    if (isPast) { color = 'var(--text-dim)'; cursor = 'not-allowed' }
                    if (isBooked) { bg = 'var(--red-dim)'; color = 'var(--red)'; cursor = 'not-allowed'; title = 'Unavailable' }
                    if (isSel) { bg = 'var(--accent)'; color = '#0f0f0e' }
                    if (isToday && !isSel) { color = 'var(--accent)' }

                    return (
                        <div key={i} title={title}
                            onClick={() => { if (!isPast && !isBooked) onSelect(dateStr) }}
                            style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 6, fontSize: '0.82rem', fontWeight: isToday ? 700 : 400, background: bg, color, cursor, border: isToday && !isSel ? '1px solid var(--accent)' : '1px solid transparent', transition: 'all 0.1s', position: 'relative' }}>
                            {day}
                            {isBooked && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--red)' }} />}
                        </div>
                    )
                })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />Unavailable
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />Selected
                </span>
            </div>
        </div>
    )
}

// ── Schedule modal ─────────────────────────────────────────────────────────────

function ScheduleModal({ result, onClose }: { result: MatchedListing; onClose: () => void }) {
    const listing = result.listing
    const [date, setDate] = useState('')
    const [time, setTime] = useState('10:00')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    // Fetch booked dates for this listing (best-effort via tenant's own schedules)
    const { data: mySchedules = [] } = useQuery<ViewingSchedule[]>({
        queryKey: ['my-schedules'],
        queryFn: () => schedulesApi.getMine().then(r => r.data),
    })
    const bookedDates = mySchedules
        .filter(s => s.listingId === listing.id && s.status !== 'Cancelled')
        .map(s => s.scheduledAt.split('T')[0])

    const handleBook = async () => {
        if (!date) return
        setLoading(true); setError('')
        try {
            await schedulesApi.create(listing.id, new Date(`${date}T${time}:00`))
            setSuccess(true)
        } catch (e: any) {
            setError(e.response?.data?.message ?? 'Booking failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <h2 style={{ fontSize: '1.1rem' }}>Schedule a Viewing</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>{listing.name}</p>

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
                        <div style={{ marginBottom: 16 }}>
                            <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>Pick a Date</label>
                            <CalendarPicker selectedDate={date} onSelect={setDate} bookedDates={bookedDates} />
                        </div>
                        {date && (
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Preferred Time</label>
                                <input className="input" type="time" value={time} min="08:00" max="20:00"
                                    onChange={e => setTime(e.target.value)} />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>Viewing times: 8:00 AM – 8:00 PM</p>
                            </div>
                        )}
                        {date && (
                            <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                                📅 {new Date(`${date}T${time}`).toLocaleString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                        {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</p>}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleBook} disabled={!date || loading}>
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

    const googleApiKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY ?? ''
    const mapsReady = useGoogleMaps(googleApiKey)

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
    const formatPrice = (p: number) => `RM ${p.toLocaleString()}/mo`
    const isScraped = !!listing.sourceUrl
    const hasRoutes = result.commuteRoutes.length > 0 && workplaceLat && workplaceLng

    return (
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate('/results')}>
                <ArrowLeft size={14} /> Back to Results
            </button>

            <ImageGallery urls={listing.imageUrls} name={listing.name} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, marginTop: 24, alignItems: 'start' }}>

                {/* ── Left column ─────────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Header */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <h1 style={{ fontSize: '1.6rem', fontFamily: 'DM Serif Display, serif', marginBottom: 4 }}>{listing.name}</h1>
                                {listing.sourcePlatform && (
                                    <span className="badge badge-grey" style={{ marginBottom: 8, display: 'inline-block' }}>{listing.sourcePlatform}</span>
                                )}
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
                            {result.commuteMinutes && (
                                <span className="badge badge-grey"><Clock size={12} /> {result.commuteMinutes} min best commute</span>
                            )}
                        </div>

                        <div style={{ color: 'var(--accent)', fontFamily: 'DM Serif Display, serif', fontSize: '2rem', marginTop: 12 }}>
                            {formatPrice(listing.price)}
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

                    {/* Lifestyle counts */}
                    {Object.keys(result.lifestyleCounts).length > 0 && (
                        <div className="card">
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Nearby Places (within 800m)</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {Object.entries(result.lifestyleCounts).map(([type, count]) => (
                                    <span key={type} className="badge badge-grey" style={{ fontSize: '0.78rem' }}>{type}: {count}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Route map — real Google Maps with polylines */}
                    {hasRoutes && (
                        <div className="card">
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>🗺️ Commute Route</h3>
                            <RouteMap
                                listingLat={listing.lat}
                                listingLng={listing.lng}
                                workplaceLat={workplaceLat!}
                                workplaceLng={workplaceLng!}
                                commuteRoutes={result.commuteRoutes}
                                mapsReady={mapsReady}
                            />
                        </div>
                    )}

                    {/* Fallback: no route data */}
                    {!hasRoutes && (
                        <div className="card">
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 10 }}>📍 Location</h3>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`}
                                target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                                <MapPin size={14} /> Open in Google Maps
                            </a>
                        </div>
                    )}
                </div>

                {/* ── Right column — sticky CTA ─────────────────────────── */}
                <div style={{ position: 'sticky', top: 80 }}>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Interested in this property?</h3>

                        {isScraped ? (
                            <>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    This listing is sourced from {listing.sourcePlatform}. Contact the agent via the original platform.
                                </p>
                                <a href={listing.sourceUrl!} target="_blank" rel="noopener noreferrer"
                                    className="btn btn-outline w-full" style={{ justifyContent: 'center' }}>
                                    <ExternalLink size={14} /> View on {listing.sourcePlatform}
                                </a>
                            </>
                        ) : (
                            <>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Book a viewing slot with the agent. You'll receive a confirmation once they approve.
                                </p>
                                <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }}
                                    onClick={() => setShowSchedule(true)}>
                                    <CalendarPlus size={14} /> Schedule a Viewing
                                </button>
                            </>
                        )}

                        <div className="divider" />

                        {/* Quick stats */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                            {[
                                ['Listed by', listing.agentName],
                                ['Property type', listing.residencyType],
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

                        {/* Per-mode commute table */}
                        {result.commuteRoutes.length > 0 && (
                            <>
                                <div className="divider" />
                                <p style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Commute by mode</p>
                                {result.commuteRoutes.map(r => (
                                    <div key={r.mode} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>{MODE_ICONS[r.mode]} {r.mode}</span>
                                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                                            {r.durationMinutes} min · {r.distanceKm} km
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {showSchedule && <ScheduleModal result={result} onClose={() => setShowSchedule(false)} />}
        </div>
    )
}
