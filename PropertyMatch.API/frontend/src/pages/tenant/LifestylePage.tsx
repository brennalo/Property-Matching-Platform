import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { templatesApi } from '../../api'
import { PLACE_TYPE_OPTIONS } from '../../types'
import type { LifestyleTemplate } from '../../types'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'

function TemplateForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: LifestyleTemplate
  onSave: (name: string, types: string[]) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.placeTypes ?? []))

  const toggle = (v: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <h3 style={{ marginBottom: 16 }}>{initial ? 'Edit Template' : 'New Template'}</h3>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Template Name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)}
          placeholder='e.g. "City Girl", "Fitness Junkie"' />
      </div>

      <div className="form-group">
        <label className="form-label">Place Types (select all that matter to you)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {PLACE_TYPE_OPTIONS.map(opt => {
            const on = selected.has(opt.value)
            return (
              <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 99,
                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'rgba(232,160,69,0.12)' : 'var(--bg-input)',
                  color: on ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'inherit',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                {on && <Check size={12} />}
                {opt.emoji} {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!name || selected.size === 0 || loading}
          onClick={() => onSave(name, Array.from(selected))}>
          {loading ? <span className="spinner" /> : <><Check size={14} /> Save Template</>}
        </button>
      </div>
    </div>
  )
}

export default function LifestylePage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LifestyleTemplate | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: ({ name, types }: { name: string; types: string[] }) =>
      templatesApi.create(name, types),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setShowForm(false)
      showToast('Template created!')
    },
    onError: () => showToast('Failed to create template', 'error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, name, types }: { id: string; name: string; types: string[] }) =>
      templatesApi.update(id, name, types),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setEditing(null)
      showToast('Template updated!')
    },
    onError: () => showToast('Failed to update template', 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      showToast('Template deleted')
    },
    onError: () => showToast('Failed to delete', 'error'),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Lifestyle Templates</h1>
          <p className="page-sub">Define what matters to you — we'll score properties by nearby places</p>
        </div>
        {!showForm && !editing && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={15} /> New Template
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <TemplateForm
            onSave={(name, types) => createMut.mutate({ name, types })}
            onCancel={() => setShowForm(false)}
            loading={createMut.isPending}
          />
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ marginBottom: 20 }}>
          <TemplateForm
            initial={editing}
            onSave={(name, types) => updateMut.mutate({ id: editing.id, name, types })}
            onCancel={() => setEditing(null)}
            loading={updateMut.isPending}
          />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
      ) : templates.length === 0 && !showForm ? (
        <div className="empty-state">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>✨</div>
          <p style={{ fontWeight: 500, marginBottom: 6 }}>No templates yet</p>
          <p>Create a template to start matching properties to your lifestyle</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
            <Plus size={15} /> Create First Template
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-3 mb-2">
                  <h3 style={{ fontSize: '1.05rem' }}>{t.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {t.placeTypes.length} categories
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {t.placeTypes.map(pt => {
                    const opt = PLACE_TYPE_OPTIONS.find(o => o.value === pt)
                    return (
                      <span key={pt} className="badge badge-amber" style={{ fontSize: '0.75rem' }}>
                        {opt?.emoji} {opt?.label ?? pt}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(t); setShowForm(false) }}>
                  <Pencil size={13} />
                </button>
                <button className="btn btn-danger btn-sm"
                  disabled={deleteMut.isPending}
                  onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteMut.mutate(t.id) }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
