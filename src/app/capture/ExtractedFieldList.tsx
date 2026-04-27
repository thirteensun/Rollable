'use client'

import { useState } from 'react'
import {
  FIELD_REGISTRY,
  getEffectiveOptions,
  type EntityKey,
  type FieldDef,
  type FieldOptions,
} from '@/lib/entity-fields'

// Renders the non-null registry fields of an extracted record on the capture
// confirm card. Tap a row to edit inline. Edits flow back via onChange.
//
// Visual language matches the rest of the capture screen — soft pill rows,
// muted labels, single-line where possible. Identity fields (full_name on
// contacts, name on companies/deals) are not shown here because the parent
// pill already displays them.

interface Props {
  entity:        EntityKey
  record:        Record<string, any>
  visibleKeys:   string[]
  fieldOptions?: FieldOptions
  onChange:      (next: Record<string, any>) => void
}

const IDENTITY_KEYS: Record<EntityKey, string> = {
  contacts:  'full_name',
  companies: 'name',
  deals:     'name',
}

export default function ExtractedFieldList({
  entity,
  record,
  visibleKeys,
  fieldOptions,
  onChange,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null)

  // Resolve the rows to render: registry fields where the org has them visible,
  // the record has a non-null value, and the field isn't the identity key.
  const identity = IDENTITY_KEYS[entity]
  const rows = FIELD_REGISTRY[entity].filter(f => {
    if (f.key === identity) return false
    if (!visibleKeys.includes(f.key)) return false
    const v = record[f.key]
    return v !== null && v !== undefined && v !== ''
  })

  if (rows.length === 0) return null

  const handleCommit = (key: string, value: any) => {
    onChange({ ...record, [key]: value })
    setEditingKey(null)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      marginTop: '8px',
      paddingLeft: '32px',
      paddingRight: '4px',
    }}>
      {rows.map(field => {
        const isEditing = editingKey === field.key
        const value = record[field.key]
        return (
          <div key={field.key}
            style={{
              display: 'flex',
              alignItems: isEditing ? 'flex-start' : 'center',
              gap: '8px',
              padding: '6px 0',
              borderBottom: '0.5px solid rgba(0,0,0,0.05)',
              fontSize: '13px',
            }}
          >
            <span style={{
              color: '#9b9890',
              minWidth: '88px',
              flexShrink: 0,
              paddingTop: isEditing ? '6px' : 0,
            }}>{field.label}</span>

            {isEditing ? (
              <FieldEditor
                entity={entity}
                field={field}
                value={value}
                fieldOptions={fieldOptions}
                onCommit={(v) => handleCommit(field.key, v)}
                onCancel={() => setEditingKey(null)}
              />
            ) : (
              <button
                onClick={() => setEditingKey(field.key)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  color: '#1a1a18',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >{formatValue(field, value)}</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Display formatting ─────────────────────────────────────────────────────

function formatValue(field: FieldDef, value: any): string {
  if (value === null || value === undefined || value === '') return ''
  if (field.type === 'enum') {
    const label = field.optionLabels?.[value]
    return label ?? String(value).replace(/_/g, ' ')
  }
  if (field.type === 'tags' && Array.isArray(value)) {
    return value.join(', ')
  }
  if (field.type === 'currency' && typeof value === 'number') {
    return value.toLocaleString()
  }
  if (field.type === 'percent' && typeof value === 'number') {
    return `${value}%`
  }
  return String(value)
}

// ─── Inline editors ─────────────────────────────────────────────────────────

interface EditorProps {
  entity:        EntityKey
  field:         FieldDef
  value:         any
  fieldOptions?: FieldOptions
  onCommit:      (v: any) => void
  onCancel:      () => void
}

function FieldEditor({ entity, field, value, fieldOptions, onCommit, onCancel }: EditorProps) {
  const [draft, setDraft] = useState(() => {
    if (field.type === 'tags' && Array.isArray(value)) return value.join(', ')
    return value == null ? '' : String(value)
  })

  const commit = () => {
    let parsed: any = draft
    if (field.type === 'currency' || field.type === 'number' || field.type === 'percent') {
      const n = Number(draft.replace(/[^0-9.-]/g, ''))
      parsed = Number.isFinite(n) ? n : null
    } else if (field.type === 'tags') {
      parsed = draft.split(',').map(s => s.trim()).filter(Boolean)
    } else if (draft === '') {
      parsed = null
    }
    onCommit(parsed)
  }

  // Enum → select
  if (field.type === 'enum') {
    const options = getEffectiveOptions(entity, field, fieldOptions)
    return (
      <select
        autoFocus
        value={String(value ?? '')}
        onChange={(e) => onCommit(e.target.value || null)}
        onBlur={onCancel}
        style={editorStyle}
      >
        <option value="">—</option>
        {options.map(o => (
          <option key={o} value={o}>
            {field.optionLabels?.[o] ?? o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    )
  }

  // Date / datetime → native picker
  if (field.type === 'date' || field.type === 'datetime') {
    return (
      <input
        autoFocus
        type={field.type === 'date' ? 'date' : 'datetime-local'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onCancel()
        }}
        style={editorStyle}
      />
    )
  }

  // Longtext → textarea
  if (field.type === 'longtext') {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
          if (e.key === 'Escape') onCancel()
        }}
        rows={3}
        style={{ ...editorStyle, resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
      />
    )
  }

  // Default text-style input
  const inputType =
    field.type === 'email' ? 'email' :
    field.type === 'phone' ? 'tel' :
    field.type === 'url'   ? 'url' :
    (field.type === 'currency' || field.type === 'number' || field.type === 'percent') ? 'text' :
    'text'

  return (
    <input
      autoFocus
      type={inputType}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onCancel()
      }}
      style={editorStyle}
    />
  )
}

const editorStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '13px',
  fontFamily: 'inherit',
  color: '#1a1a18',
  background: 'white',
  border: '0.5px solid rgba(0,0,0,0.15)',
  borderRadius: '8px',
  padding: '6px 8px',
  outline: 'none',
}
