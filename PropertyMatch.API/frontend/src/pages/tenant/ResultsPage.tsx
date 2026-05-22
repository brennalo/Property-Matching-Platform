import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { schedulesApi } from '../../api'
import type { MatchedListing } from '../../types'
import { ArrowLeft, Clock, Bed, Bath, MapPin, ExternalLink, CalendarPlus } from 'lucide-react'

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-label">
        <span>{label}</span>
        <span style={{ color }}>{value.toFixed(0)}</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 26, cx = 32, cy = 32, stroke = 4
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#3db8a0' : score >= 40 ? '#e8a045' : '#e05c5c'

  return (
    <div className="score-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
      </svg>
      <div className="score-ring-label" style={{ color }}>{score.toFixed(0)}</div>
    </div>
  )
}

function ScheduleModal({ listing, onClose }: {
  listing: MatchedListing['listing']
  onClose: () => void
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleBook = async () => {
    if (!date) return
    setLoading(true); setError('')
    try {
      const dt = new Date(`${date}T${time}:00`)
      await schedulesApi.create(listing.id, dt)
      setSuccess(true)
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Booking failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 6 }}>Schedule Viewing</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>
          {listing.name}
        </p>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <p>Viewing scheduled! The agent will confirm shortly.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="input" type="date" value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="input" type="time" value={time}
                  onChange={e => setTime(e.target.value)} />
              </div>
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: 8 }}>{error}</p>}
            <div className="flex gap-3 mt-4">
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBook} disabled={!date || loading}>
                {loading ? <span className="spinner" /> : 'Confirm Booking'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const navigate = useNavigate()
  const [results, setResults] = useState<MatchedListing[]>([])
  const [selected, setSelected] = useState<MatchedListing | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<MatchedListing['listing'] | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('matchResults')
    if (!raw) { navigate('/search'); return }
    setResults(JSON.parse(raw))
  }, [])

  const formatPrice = (p: number) => `RM ${p.toLocaleString()}/mo`

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/search')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Matched Properties</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {results.length} results · ranked by lifestyle fit
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <p>No properties matched your criteria. Try broadening your search.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map((r, i) => (
              <div key={`${r.listing.id}-${i}`}
                className="card"
                onClick={() => setSelected(r)}
                style={{
                  cursor: 'pointer',
                  borderColor: selected?.listing.id === r.listing.id ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.15s'
                }}>
                <div className="flex gap-4 items-center">
                  {/* Rank badge */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? 'var(--accent)' : 'var(--bg-input)',
                    color: i === 0 ? '#0f0f0e' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.8rem'
                  }}>
                    {i + 1}
                  </div>

                  {/* Image */}
                  {r.listing.imageUrls[0] ? (
                    <img src={r.listing.imageUrls[0]} alt={r.listing.name}
                      style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 80, height: 60, background: 'var(--bg-input)', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      🏠
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{r.listing.name}</span>
                      {r.listing.sourcePlatform && (
                        <span className="badge badge-grey" style={{ fontSize: '0.7rem' }}>
                          {r.listing.sourcePlatform}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span><Bed size={12} style={{ verticalAlign: 'middle' }} /> {r.listing.rooms}</span>
                      <span><Bath size={12} style={{ verticalAlign: 'middle' }} /> {r.listing.toilets}</span>
                      <span><MapPin size={12} style={{ verticalAlign: 'middle' }} /> {r.listing.address.split(',').slice(-2).join(',').trim()}</span>
                      {r.commuteMinutes && (
                        <span><Clock size={12} style={{ verticalAlign: 'middle' }} /> {r.commuteMinutes} min</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--accent)', fontFamily: 'DM Serif Display, serif', fontSize: '1rem', marginTop: 4 }}>
                      {formatPrice(r.listing.price)}
                    </div>
                  </div>

                  {/* Score ring */}
                  <ScoreRing score={r.totalScore} />
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card" style={{ position: 'sticky', top: 80 }}>
              <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}
                onClick={() => setSelected(null)}>✕ Close</button>

              {selected.listing.imageUrls[0] ? (
                <img src={selected.listing.imageUrls[0]} alt={selected.listing.name}
                  style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }} />
              ) : (
                <div style={{ height: 120, background: 'var(--bg-input)', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🏠</div>
              )}

              <h2 style={{ fontSize: '1.2rem', marginBottom: 4 }}>{selected.listing.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>
                <MapPin size={12} style={{ verticalAlign: 'middle' }} /> {selected.listing.address}
              </p>

              <div className="flex gap-3 mb-4">
                <span className="badge badge-grey"><Bed size={12} /> {selected.listing.rooms} bed</span>
                <span className="badge badge-grey"><Bath size={12} /> {selected.listing.toilets} bath</span>
                <span className="badge badge-grey">{selected.listing.residencyType}</span>
              </div>

              <div style={{ color: 'var(--accent)', fontFamily: 'DM Serif Display, serif', fontSize: '1.5rem', marginBottom: 16 }}>
                {formatPrice(selected.listing.price)}
              </div>

              <div className="divider" />

              {/* Score breakdown */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: 500, marginBottom: 10, fontSize: '0.85rem' }}>Score Breakdown</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ScoreBar label="Numeric match (40%)" value={selected.numericScore} color="#3db8a0" />
                  <ScoreBar label="Commute score (30%)" value={selected.commuteScore} color="#e8a045" />
                  <ScoreBar label="Lifestyle score (30%)" value={selected.lifestyleScore} color="#a78bfa" />
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                    <ScoreBar label="Overall score" value={selected.totalScore} color="var(--text)" />
                  </div>
                </div>
              </div>

              {/* Lifestyle counts */}
              {Object.keys(selected.lifestyleCounts).length > 0 && (
                <>
                  <div className="divider" />
                  <p style={{ fontWeight: 500, marginBottom: 10, fontSize: '0.85rem' }}>Nearby Places (within 800m)</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(selected.lifestyleCounts).map(([type, count]) => (
                      <span key={type} className="badge badge-grey" style={{ fontSize: '0.75rem' }}>
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {selected.commuteMinutes && (
                <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} style={{ verticalAlign: 'middle' }} />{' '}
                  Estimated commute: <strong>{selected.commuteMinutes} minutes</strong>
                </p>
              )}

              <div className="divider" />

              {/* CTA */}
              {selected.listing.sourceUrl ? (
                <a href={selected.listing.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="btn btn-outline w-full" style={{ justifyContent: 'center' }}>
                  <ExternalLink size={14} /> Contact via {selected.listing.sourcePlatform}
                </a>
              ) : (
                <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }}
                  onClick={() => setScheduleTarget(selected.listing)}>
                  <CalendarPlus size={14} /> Schedule Viewing
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {scheduleTarget && (
        <ScheduleModal listing={scheduleTarget} onClose={() => setScheduleTarget(null)} />
      )}
    </div>
  )
}
