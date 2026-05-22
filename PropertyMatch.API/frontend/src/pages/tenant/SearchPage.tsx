import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { templatesApi, matchApi } from '../../api'
import type { MatchRequest, ResidencyType, TransportMode } from '../../types'
import { Search, MapPin, Clock, Car } from 'lucide-react'

const RESIDENCY_TYPES: ResidencyType[] = ['Landed', 'Condo', 'Apartment', 'Townhouse', 'Studio']
const TRANSPORT_MODES: { value: TransportMode; label: string; icon: string }[] = [
  { value: 'Driving', label: 'Drive', icon: '🚗' },
  { value: 'Transit', label: 'Transit', icon: '🚇' },
  { value: 'Walking', label: 'Walk', icon: '🚶' },
  { value: 'Bicycling', label: 'Cycle', icon: '🚲' },
]

export default function SearchPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    rooms: '',
    toilets: '',
    residencyType: '' as ResidencyType | '',
    priceMin: '',
    priceMax: '',
    workplaceAddress: '',
    workplaceLat: '',
    workplaceLng: '',
    transportMode: 'Driving' as TransportMode,
    maxCommuteMinutes: '45',
    lifestyleTemplateId: '',
  })

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll().then(r => r.data)
  })

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const geocodeWorkplace = async () => {
    if (!form.workplaceAddress) return
    // Use browser geolocation as fallback, or call Google Geocoding API
    // For now, prompt user to enter lat/lng manually or use Maps picker
    setError('Enter coordinates manually or use the map picker below')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const lat = parseFloat(form.workplaceLat)
    const lng = parseFloat(form.workplaceLng)

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid workplace coordinates (lat/lng).')
      return
    }

    const req: MatchRequest = {
      workplaceAddress: form.workplaceAddress,
      workplaceLat: lat,
      workplaceLng: lng,
      transportMode: form.transportMode,
      maxCommuteMinutes: parseInt(form.maxCommuteMinutes),
    }

    if (form.rooms)           req.rooms = parseInt(form.rooms)
    if (form.toilets)         req.toilets = parseInt(form.toilets)
    if (form.residencyType)   req.residencyType = form.residencyType
    if (form.priceMin)        req.priceMin = parseFloat(form.priceMin)
    if (form.priceMax)        req.priceMax = parseFloat(form.priceMax)
    if (form.lifestyleTemplateId) req.lifestyleTemplateId = form.lifestyleTemplateId

    setLoading(true)
    try {
      const { data } = await matchApi.search(req)
      // Store results in sessionStorage for ResultsPage
      sessionStorage.setItem('matchResults', JSON.stringify(data))
      sessionStorage.setItem('matchReq', JSON.stringify(req))
      navigate('/results')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Find Your Home</h1>
      <p className="page-sub">We'll match properties to your lifestyle, commute, and preferences</p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Property basics ─────────────────────────────────────────── */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '1rem', color: 'var(--text-muted)' }}>
              🏠 Property Requirements
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Bedrooms</label>
                <select className="select" value={form.rooms} onChange={e => update('rooms', e.target.value)}>
                  <option value="">Any</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Bathrooms</label>
                <select className="select" value={form.toilets} onChange={e => update('toilets', e.target.value)}>
                  <option value="">Any</option>
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}+</option>)}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Property Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => update('residencyType', '')}
                  className={`btn btn-sm ${!form.residencyType ? 'btn-primary' : 'btn-outline'}`}>
                  Any
                </button>
                {RESIDENCY_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => update('residencyType', t)}
                    className={`btn btn-sm ${form.residencyType === t ? 'btn-primary' : 'btn-outline'}`}>
                    {t}
                  </button>
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

          {/* ── Commute ─────────────────────────────────────────────────── */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: '1rem', color: 'var(--text-muted)' }}>
              <Car size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Commute Preferences
            </h3>

            <div className="form-group">
              <label className="form-label">Workplace Address</label>
              <input className="input" value={form.workplaceAddress} required
                onChange={e => update('workplaceAddress', e.target.value)}
                placeholder="e.g. Petronas Twin Towers, KLCC" />
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Latitude <span style={{color:'var(--text-dim)'}}>*</span></label>
                <input className="input" type="number" step="any" value={form.workplaceLat} required
                  onChange={e => update('workplaceLat', e.target.value)} placeholder="e.g. 3.1578" />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude <span style={{color:'var(--text-dim)'}}>*</span></label>
                <input className="input" type="number" step="any" value={form.workplaceLng} required
                  onChange={e => update('workplaceLng', e.target.value)} placeholder="e.g. 101.7116" />
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 6 }}>
              💡 Tip: Right-click on Google Maps → "What's here?" to get coordinates.
            </p>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Transport Mode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TRANSPORT_MODES.map(m => (
                  <button key={m.value} type="button"
                    onClick={() => update('transportMode', m.value)}
                    className={`btn btn-sm ${form.transportMode === m.value ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>

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

          {/* ── Lifestyle ────────────────────────────────────────────────── */}
          <div className="card">
            <h3 style={{ marginBottom: 4, fontSize: '1rem', color: 'var(--text-muted)' }}>
              ✨ Lifestyle Template
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: 14 }}>
              Choose a template to score properties based on nearby places that match your lifestyle.
              <a href="/lifestyle" style={{ marginLeft: 6 }}>Manage templates →</a>
            </p>
            <select className="select" value={form.lifestyleTemplateId}
              onChange={e => update('lifestyleTemplateId', e.target.value)}>
              <option value="">No lifestyle filter</option>
              {templates?.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.placeTypes.join(', ')})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? <><span className="spinner" /> Finding matches…</> : <><Search size={16} /> Search Properties</>}
          </button>
        </div>
      </form>
    </div>
  )
}
