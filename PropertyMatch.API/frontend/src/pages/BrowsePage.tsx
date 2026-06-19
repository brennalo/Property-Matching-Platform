import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BedDouble, Bath, MapPin, Building2 } from 'lucide-react'
import { browseApi } from '../api'

// Declare window.google to satisfy TypeScript (loaded at runtime via script tag)
declare global {
    interface Window {
        google: any
        __gmapsReady: boolean
    }
}

function useMapsReady() {
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

function pinColour(count: number): string {
    if (count >= 50) return '#e85555'
    if (count >= 6) return '#e8a045'
    return '#4caf50'
}

function countLabel(count: number): string {
    if (count >= 50) return `${count} viewings (hot 🔴)`
    if (count >= 6) return `${count} viewings`
    return `${count} viewing${count !== 1 ? 's' : ''}`
}

const RESIDENCY_TYPES = ['Condo', 'Landed', 'Studio', 'Apartment', 'Townhouse', 'MasterRoom', 'CommonRoom']

export default function BrowsePage() {
    const navigate = useNavigate()
    const mapsReady = useMapsReady()
    const mapRef = useRef<HTMLDivElement>(null)
    const markersRef = useRef<any[]>([]);
    const gMapRef = useRef<any[]>([]);

    const { data: listings = [], isLoading } = useQuery({
        queryKey: ['browse-listings'],
        queryFn: () => browseApi.getListings().then((r: any) => r.data),
    })

    const [filter, setFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')

    const filtered = listings.filter((l: any) => {
        const matchText = l.name.toLowerCase().includes(filter.toLowerCase()) ||
            l.address.toLowerCase().includes(filter.toLowerCase())
        const matchType = !typeFilter || l.residencyType === typeFilter
        return matchText && matchType
    })

    // Init map once Maps API is ready
    useEffect(() => {
        if (!mapsReady || !mapRef.current) return
        gMapRef.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: 3.147, lng: 101.697 },
            zoom: 11,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#1c1b19' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#b0aa9f' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1b19' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2e2d2b' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111110' }] },
            ],
        })
    }, [mapsReady])

    // Place/refresh markers whenever listings load
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
                    <div style="background:#1c1b19;color:#e8e4de;padding:10px 12px;border-radius:8px;font-size:0.85rem;min-width:160px;">
                        <strong>${l.name}</strong><br/>
                        RM ${l.price.toLocaleString()}/mo<br/>
                        <span style="color:#b0aa9f;font-size:0.75rem;">${countLabel(l.viewingCount)}</span>
                    </div>`,
            })

            marker.addListener('click', () => {
                info.open(gMapRef.current!, marker)
                setTimeout(() => navigate(`/listing/${l.id}`), 700)
            })

            markersRef.current.push(marker)
        })
    }, [listings, mapsReady])

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            {/* Header */}
            <div style={{
                background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
                padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
                <Building2 size={20} color="var(--accent)" />
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>PropertyMatch</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Browse Listings</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <a href="/login" className="btn btn-outline btn-sm">Login</a>
                    <a href="/register" className="btn btn-primary btn-sm">Sign Up</a>
                </div>
            </div>

            {/* Map */}
            <div style={{ position: 'relative' }}>
                <div ref={mapRef} style={{ width: '100%', height: 420 }} />
                {!mapsReady && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.9rem',
                    }}>
                        Loading map…
                    </div>
                )}
                {/* Legend */}
                <div style={{
                    position: 'absolute', bottom: 16, left: 16,
                    background: 'rgba(28,27,25,0.92)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-muted)',
                }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Viewing Activity</div>
                    {([
                        ['#4caf50', '1–5 viewings'],
                        ['#e8a045', '6–49 viewings'],
                        ['#e85555', '50+ viewings'],
                    ] as const).map(([colour, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: colour, display: 'inline-block' }} />
                            {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div style={{ padding: '20px 24px 0', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="input" style={{ width: 280 }}
                    placeholder="Search by name or address…"
                    value={filter} onChange={e => setFilter(e.target.value)}
                />
                <select
                    className="input" style={{ width: 180 }}
                    value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                >
                    <option value="">All Types</option>
                    {RESIDENCY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {filtered.length} listing{filtered.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Cards grid */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner" /></div>
            ) : (
                <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {filtered.map((l: any) => (
                        <div
                            key={l.id}
                            className="card"
                            style={{ cursor: 'pointer', overflow: 'hidden' }}
                            onClick={() => navigate(`/listing/${l.id}`)}
                        >
                            {l.images[0] ? (
                                <img
                                    src={l.images[0]} alt={l.name}
                                    style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                                />
                            ) : (
                                <div style={{
                                    width: '100%', height: 180,
                                    background: 'var(--bg-hover)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-muted)', fontSize: '0.85rem',
                                }}>
                                    No image
                                </div>
                            )}
                            <div style={{ padding: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {l.name}
                                    </span>
                                    <span className="badge badge-grey" style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                                        {l.residencyType}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={11} />{l.address}
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BedDouble size={12} />{l.rooms} bed</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Bath size={12} />{l.toilets} bath</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent)' }}>
                                        RM {l.price.toLocaleString()}
                                        <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>/mo</span>
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        by {l.agentName}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}