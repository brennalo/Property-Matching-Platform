import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, RotateCcw, Save, AlertTriangle, CheckCircle } from 'lucide-react'
import api, { scoringConfigApi } from '../../api'
import { ScoringConfigRequest } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEIGHT_LABELS = [
    {
        key: 'weightNumeric' as const,
        label: 'Numeric Match',
        description: 'Rooms, toilets, property type, price range',
        color: '#6366f1',
    },
    {
        key: 'weightCommute' as const,
        label: 'Commute Score',
        description: 'Travel time to workplace via chosen transport modes',
        color: 'var(--accent)',
    },
    {
        key: 'weightLifestyle' as const,
        label: 'Lifestyle Score',
        description: 'Nearby amenities matching tenant lifestyle template',
        color: '#ec4899',
    },
]

const RADIUS_OPTIONS = [200, 400, 600, 800, 1000, 1500, 2000]

const DEFAULTS: ScoringConfigRequest = {
    weightNumeric: 0.4,
    weightCommute: 0.3,
    weightLifestyle: 0.3,
    lifestyleRadiusMeters: 800,
}

function pct(v: number) {
    return Math.round(v * 100)
}

// ── Weight Slider ─────────────────────────────────────────────────────────────

function WeightSlider({
    label,
    description,
    color,
    value,
    onChange,
}: {
    label: string
    description: string
    color: string
    value: number
    onChange: (v: number) => void
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{label}</span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>{description}</p>
                </div>
                <span style={{
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    color,
                    minWidth: 52,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                }}>
                    {pct(value)}%
                </span>
            </div>

            {/* Track */}
            <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--border)' }}>
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    borderRadius: 3,
                    width: `${pct(value)}%`,
                    background: color,
                    transition: 'width 0.15s ease',
                }} />
            </div>

            <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct(value)}
                onChange={e => onChange(Number(e.target.value) / 100)}
                style={{
                    width: '100%',
                    accentColor: color,
                    cursor: 'pointer',
                    marginTop: -2,
                }}
            />
        </div>
    )
}

// ── Weight Sum Indicator ──────────────────────────────────────────────────────

function WeightSumBar({ numeric, commute, lifestyle }: { numeric: number; commute: number; lifestyle: number }) {
    const total = numeric + commute + lifestyle
    const ok = Math.abs(total - 1.0) < 0.001

    return (
        <div style={{
            background: 'var(--bg)',
            border: `1px solid ${ok ? 'var(--border)' : '#f59e0b'}`,
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    Weight distribution
                </span>
                <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: ok ? 'var(--accent)' : '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}>
                    {ok
                        ? <><CheckCircle size={13} /> Total: 100%</>
                        : <><AlertTriangle size={13} /> Total: {Math.round(total * 100)}% — must equal 100%</>
                    }
                </span>
            </div>

            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1 }}>
                <div style={{ flex: pct(numeric), background: '#6366f1', transition: 'flex 0.2s ease' }} />
                <div style={{ flex: pct(commute), background: 'var(--accent)', transition: 'flex 0.2s ease' }} />
                <div style={{ flex: pct(lifestyle), background: '#ec4899', transition: 'flex 0.2s ease' }} />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
                {[
                    { label: 'Numeric', value: numeric, color: '#6366f1' },
                    { label: 'Commute', value: commute, color: 'var(--accent)' },
                    { label: 'Lifestyle', value: lifestyle, color: '#ec4899' },
                ].map(s => (
                    <span key={s.label} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                        {s.label}: <strong style={{ color: 'var(--text)' }}>{pct(s.value)}%</strong>
                    </span>
                ))}
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScoringConfigPage() {
    const qc = useQueryClient()
    const [form, setForm] = useState<ScoringConfigRequest>(DEFAULTS)
    const [saved, setSaved] = useState(false)

    const { data, isLoading } = useQuery({
        queryKey: ['scoring-config'],
        queryFn: () => scoringConfigApi.get().then(r => r.data),
    })

    useEffect(() => {
        if (data) setForm({
            weightNumeric: data.weightNumeric,
            weightCommute: data.weightCommute,
            weightLifestyle: data.weightLifestyle,
            lifestyleRadiusMeters: data.lifestyleRadiusMeters,
        })
    }, [data])

    const saveMut = useMutation({
        mutationFn: () => scoringConfigApi.update(form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['scoring-config'] })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        },
    })

    const update = (key: keyof ScoringConfigRequest, value: number) => {
        setForm(f => ({ ...f, [key]: value }))
        setSaved(false)
    }

    const reset = () => {
        setForm(DEFAULTS)
        setSaved(false)
    }

    const total = form.weightNumeric + form.weightCommute + form.weightLifestyle
    const weightsValid = Math.abs(total - 1.0) < 0.001

    if (isLoading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <span className="spinner" />
        </div>
    )

    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--accent) 0%, #2d8a76 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Settings size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 className="page-title" style={{ margin: 0 }}>Scoring Config</h1>
                        <p className="page-sub" style={{ margin: 0 }}>Tune how listings are ranked for tenants</p>
                    </div>
                </div>

                <button
                    className="btn btn-outline btn-sm"
                    onClick={reset}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <RotateCcw size={13} /> Reset defaults
                </button>
            </div>

            {/* Score Weights */}
            <div className="card" style={{ marginBottom: 20 }}>
                <h2 style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: 20,
                }}>
                    Score Weights
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {WEIGHT_LABELS.map(w => (
                        <WeightSlider
                            key={w.key}
                            label={w.label}
                            description={w.description}
                            color={w.color}
                            value={form[w.key]}
                            onChange={v => update(w.key, v)}
                        />
                    ))}
                </div>

                <div style={{ marginTop: 24 }}>
                    <WeightSumBar
                        numeric={form.weightNumeric}
                        commute={form.weightCommute}
                        lifestyle={form.weightLifestyle}
                    />
                </div>
            </div>

            {/* Lifestyle Radius */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h2 style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: 4,
                }}>
                    Lifestyle Places Search Radius
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 20 }}>
                    How far from a listing to search for nearby places (gyms, cafes, parks, etc.)
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {RADIUS_OPTIONS.map(r => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => update('lifestyleRadiusMeters', r)}
                            className={`btn btn-sm ${form.lifestyleRadiusMeters === r ? 'btn-primary' : 'btn-outline'}`}
                        >
                            {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                        </button>
                    ))}
                </div>

                {/* Visual scale */}
                <div style={{ marginTop: 16, position: 'relative' }}>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }} />
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: 4,
                        borderRadius: 2,
                        background: 'var(--accent)',
                        width: `${(form.lifestyleRadiusMeters / 2000) * 100}%`,
                        transition: 'width 0.2s ease',
                    }} />
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        fontSize: '0.72rem',
                        color: 'var(--text-dim)',
                    }}>
                        <span>200 m</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            Current: {form.lifestyleRadiusMeters >= 1000
                                ? `${form.lifestyleRadiusMeters / 1000} km`
                                : `${form.lifestyleRadiusMeters} m`}
                        </span>
                        <span>2 km</span>
                    </div>
                </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                {saved && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={14} /> Saved
                    </span>
                )}
                {saveMut.isError && (
                    <span style={{ fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={14} /> Save failed
                    </span>
                )}
                <button
                    className="btn btn-primary"
                    onClick={() => saveMut.mutate()}
                    disabled={!weightsValid || saveMut.isPending}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}
                >
                    {saveMut.isPending
                        ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</>
                        : <><Save size={14} /> Save changes</>
                    }
                </button>
            </div>

            {!weightsValid && (
                <p style={{ textAlign: 'right', fontSize: '0.78rem', color: '#f59e0b', marginTop: 8 }}>
                    Adjust weights until they sum to exactly 100% before saving.
                </p>
            )}
        </div>
    )
}