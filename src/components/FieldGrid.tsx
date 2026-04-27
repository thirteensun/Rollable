'use client'

import { useState, useEffect } from 'react'
import {
  type EntityKey,
  type FieldDef,
  type FieldSection,
  type FieldOptions,
  getVisibleFieldDefs,
  groupBySection,
  getEffectiveOptions,
  SECTION_LABELS,
} from '@/lib/entity-fields'

interface FieldGridProps {
  entity:        EntityKey
  values:        Record<string, any>
  visibleFields: string[]
  /** Org-level enum subset overrides per field. Falls back to registry defaults. */
  fieldOptions?: FieldOptions
  editing?:      boolean
  onChange?:     (key: string, value: any) => void
  /** When true, in read mode also hide rows whose value is empty.
   *  Hidden fields (not in visibleFields) are always hidden regardless. */
  hideEmpty?:    boolean
  /** Hide section headers (used for compact contexts) */
  flat?:         boolean
}

export default function FieldGrid({
  entity,
  values,
  visibleFields,
  fieldOptions,
  editing = false,
  onChange,
  hideEmpty = false,
  flat = false,
}: FieldGridProps) {
  const visible = getVisibleFieldDefs(entity, visibleFields)
  const grouped = groupBySection(visible)
  const sections: FieldSection[] = ['core', 'financial', 'meta']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: flat ? 0 : 18 }}>
      {sections.map(section => {
        const fields = grouped[section]
        if (fields.length === 0) return null

        const renderable = editing
          ? fields
          : hideEmpty
            ? fields.filter(f => !isEmpty(values[f.key]))
            : fields

        if (renderable.length === 0) return null

        return (
          <div key={section}>
            {!flat && (
              <p style={{
                fontSize: 11, color: '#9b9890',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                margin: '0 0 10px',
              }}>
                {SECTION_LABELS[section]}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: editing ? 10 : 8 }}>
              {renderable.map(field => (
                editing ? (
                  <FieldInput
                    key={field.key}
                    entity={entity}
                    field={field}
                    value={values[field.key]}
                    fieldOptions={fieldOptions}
                    onChange={v => onChange?.(field.key, v)}
                  />
                ) : (
                  <FieldRow
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                  />
                )
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Read-mode row ───────────────────────────────────────────────────────────

function FieldRow({ field, value }: { field: FieldDef; value: any }) {
  const isLong = field.type === 'longtext'
  const display = formatValue(field, value)
  const href = linkFor(field, value)

  if (isLong) {
    if (!value) return null
    return (
      <div>
        <p style={{ fontSize: 12, color: '#9b9890', margin: '0 0 4px' }}>{field.label}</p>
        <p style={{ fontSize: 13, color: '#1a1a18', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {display}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#6b6960', flexShrink: 0 }}>{field.label}</span>
      {href ? (
        <a href={href}
           target={field.type === 'url' ? '_blank' : undefined}
           rel={field.type === 'url' ? 'noreferrer' : undefined}
           style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', textDecoration: 'none', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display}
        </a>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 500, color: value ? '#1a1a18' : '#c8c5be', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display}
        </span>
      )}
    </div>
  )
}

// ─── Edit-mode input ─────────────────────────────────────────────────────────

function FieldInput({
  entity, field, value, fieldOptions, onChange,
}: {
  entity: EntityKey
  field: FieldDef
  value: any
  fieldOptions?: FieldOptions
  onChange: (v: any) => void
}) {
  const [local, setLocal] = useState<any>(value ?? '')
  useEffect(() => { setLocal(value ?? '') }, [value])

  const commit = (v: any) => { setLocal(v); onChange(v === '' ? null : v) }

  const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#9b9890', fontWeight: 500 }

  if (field.type === 'enum') {
    const options = getEffectiveOptions(entity, field, fieldOptions)
    return (
      <div style={wrapStyle}>
        <label style={labelStyle}>{field.label}</label>
        <select
          value={local || ''}
          onChange={e => commit(e.target.value)}
          style={inputStyle}
        >
          <option value="">—</option>
          {options.map(opt => (
            <option key={opt} value={opt}>
              {field.optionLabels?.[opt] ?? prettify(opt)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'longtext') {
    return (
      <div style={wrapStyle}>
        <label style={labelStyle}>{field.label}</label>
        <textarea
          value={local}
          onChange={e => commit(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
    )
  }

  if (field.type === 'date') {
    return (
      <div style={wrapStyle}>
        <label style={labelStyle}>{field.label}</label>
        <input type="date" value={local || ''} onChange={e => commit(e.target.value)} style={inputStyle} />
      </div>
    )
  }

  if (field.type === 'datetime') {
    const v = local ? toLocalDatetime(local) : ''
    return (
      <div style={wrapStyle}>
        <label style={labelStyle}>{field.label}</label>
        <input type="datetime-local" value={v} onChange={e => commit(e.target.value ? new Date(e.target.value).toISOString() : '')} style={inputStyle} />
      </div>
    )
  }

  if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
    return (
      <div style={wrapStyle}>
        <label style={labelStyle}>{field.label}</label>
        <input
          type="number"
          value={local ?? ''}
          onChange={e => commit(e.target.value === '' ? '' : Number(e.target.value))}
          style={inputStyle}
        />
      </div>
    )
  }

  if (field.type === 'tags') {
    const arr = Array.isArray(local) ? local : []
    return (
      <div style={wrapStyle}>
        <label style={labelStyle}>{field.label}</label>
        <input
          type="text"
          placeholder="comma, separated, tags"
          value={arr.join(', ')}
          onChange={e => commit(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          style={inputStyle}
        />
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      <label style={labelStyle}>{field.label}</label>
      <input
        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
        value={local}
        onChange={e => commit(e.target.value)}
        style={inputStyle}
      />
    </div>
  )
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function isEmpty(v: any): boolean {
  if (v == null) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

function prettify(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(field: FieldDef, value: any): string {
  if (isEmpty(value)) return '—'
  switch (field.type) {
    case 'enum':
      return field.optionLabels?.[value] ?? prettify(String(value))
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
      }).format(Number(value))
    case 'percent':
      return `${Number(value)}%`
    case 'number':
      return new Intl.NumberFormat('en-US').format(Number(value))
    case 'date':
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    case 'datetime':
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    case 'tags':
      return Array.isArray(value) ? value.join(', ') : String(value)
    default:
      return String(value)
  }
}

function linkFor(field: FieldDef, value: any): string | undefined {
  if (isEmpty(value)) return undefined
  if (field.type === 'email') return `mailto:${value}`
  if (field.type === 'phone') return `tel:${value}`
  if (field.type === 'url')   return String(value).startsWith('http') ? value : `https://${value}`
  return undefined
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '0.5px solid rgba(0,0,0,0.12)', fontSize: 14,
  color: '#1a1a18', background: '#f5f4f0', outline: 'none', boxSizing: 'border-box',
}