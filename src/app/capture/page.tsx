'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { FIELD_REGISTRY, type EntityKey, type FieldOptions } from '@/lib/entity-fields'
import ExtractedFieldList from './ExtractedFieldList'

// Build sets of valid registry column names per entity, for filtering
// extracted records to only DB-known columns before insert/update.
const REGISTRY_KEYS: Record<EntityKey, Set<string>> = {
  contacts:  new Set(FIELD_REGISTRY.contacts.map(f => f.key)),
  companies: new Set(FIELD_REGISTRY.companies.map(f => f.key)),
  deals:     new Set(FIELD_REGISTRY.deals.map(f => f.key)),
}

// Pick only registry-defined keys from a record, dropping helpers like
// company_name (which is used to link, not to store) and any null/empty values.
// Identity columns (full_name on contacts, name on companies/deals) are also
// dropped here because the save path sets them explicitly.
function pickRegistryFields(
  entity: EntityKey,
  record: Record<string, any>,
  exclude: string[] = [],
): Record<string, any> {
  const out: Record<string, any> = {}
  const skip = new Set([...exclude])
  for (const [k, v] of Object.entries(record)) {
    if (!REGISTRY_KEYS[entity].has(k)) continue
    if (skip.has(k)) continue
    if (v === null || v === undefined || v === '') continue
    out[k] = v
  }
  return out
}

// Display-item model for the confirm card. Each item is a togglable pill;
// entity items also get an editable field list. Tasks/notes still come from
// Haiku's creates[] because there's no extracted.tasks[] equivalent.
type DisplayItem =
  | { kind: 'entity'; entityType: 'contact' | 'company' | 'deal'; recordIndex: number; label: string; selectionKey: string }
  | { kind: 'create'; createType: 'task' | 'note'; createIndex: number; label: string; selectionKey: string }

function buildDisplayItems(aiResult: AIResult): DisplayItem[] {
  const items: DisplayItem[] = []
  const ex = aiResult.extracted

  // Modern path: derive entity pills from extracted[]
  if (ex) {
    ex.contacts.forEach((c, i) => {
      if (!c?.full_name) return
      items.push({
        kind: 'entity', entityType: 'contact', recordIndex: i,
        label: `Contact — ${c.full_name}`,
        selectionKey: `contact:${i}`,
      })
    })
    ex.companies.forEach((co, i) => {
      if (!co?.name) return
      items.push({
        kind: 'entity', entityType: 'company', recordIndex: i,
        label: `Company — ${co.name}`,
        selectionKey: `company:${i}`,
      })
    })
    ex.deals.forEach((d, i) => {
      if (!d?.name) return
      items.push({
        kind: 'entity', entityType: 'deal', recordIndex: i,
        label: `Deal — ${d.name}`,
        selectionKey: `deal:${i}`,
      })
    })
  } else {
    // Legacy fallback: build entity pills from creates[] with synthetic indices
    // so the existing /api/capture deploy keeps working mid-rollout. No inline
    // field editor is shown for these (no extracted records to edit).
    let cIdx = 0, coIdx = 0, dIdx = 0
    aiResult.creates.forEach((c) => {
      if (c.type === 'contact')      items.push({ kind: 'entity', entityType: 'contact', recordIndex: cIdx++,  label: c.label, selectionKey: `contact:${cIdx - 1}` })
      else if (c.type === 'company') items.push({ kind: 'entity', entityType: 'company', recordIndex: coIdx++, label: c.label, selectionKey: `company:${coIdx - 1}` })
      else if (c.type === 'deal')    items.push({ kind: 'entity', entityType: 'deal',    recordIndex: dIdx++,  label: c.label, selectionKey: `deal:${dIdx - 1}` })
    })
  }

  // Tasks and notes from Haiku's creates[] — no extracted parallel for these
  let tIdx = 0, nIdx = 0
  aiResult.creates.forEach((c) => {
    if (c.type === 'task') items.push({ kind: 'create', createType: 'task', createIndex: tIdx++, label: c.label, selectionKey: `task:${tIdx - 1}` })
    else if (c.type === 'note') items.push({ kind: 'create', createType: 'note', createIndex: nIdx++, label: c.label, selectionKey: `note:${nIdx - 1}` })
  })
  return items
}

// Map entity type → registry plural key
const ENTITY_PLURAL: Record<'contact' | 'company' | 'deal', EntityKey> = {
  contact: 'contacts',
  company: 'companies',
  deal:    'deals',
}

type Mode = 'choose' | 'image_processing' | 'image_confirm' | 'assistant' | 'sheet_processing' | 'sheet_confirm'

interface ExtractedRecord {
  [k: string]: any
}

interface AIResult {
  summary: string
  contact_name?: string
  contacts?: { full_name: string; role?: string; company_name?: string; email?: string; phone?: string }[]
  company_name?: string
  deal_name?: string
  deal_value?: number
  follow_up_date?: string
  event_type: string
  creates: { label: string; type: 'contact' | 'company' | 'deal' | 'task' | 'note' }[]
  // Registry-keyed fields, populated by /api/capture (server-side coerced)
  extracted?: {
    contacts:  ExtractedRecord[]
    companies: ExtractedRecord[]
    deals:     ExtractedRecord[]
  }
  // Org config — sent so the client can render extracted fields
  config?: {
    visibleFields: { contacts: string[]; companies: string[]; deals: string[] }
    fieldOptions:  FieldOptions
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SheetContact {
  full_name: string
  role?: string | null
  email?: string | null
  phone?: string | null
  company_name?: string | null
  // Plus any registry-keyed enrichments from the org's visible_fields
  [k: string]: any
}

interface SheetCompany {
  name: string
  website?: string | null
  industry?: string | null
  // Plus any registry-keyed enrichments
  [k: string]: any
}

interface SheetDeal {
  name: string
  company_name?: string | null
  contact_name?: string | null
  value?: number | null
  stage?: string | null
  expected_close_date?: string | null
  currency?: string | null
  [k: string]: any
}

interface SheetResult {
  contacts: SheetContact[]
  companies: SheetCompany[]
  deals: SheetDeal[]
  skipped: number
  notes: string
}

interface PendingAction {
  message: string
  summary: string
  creates: { type: string; label: string }[]
}

const pillColors: Record<string, { bg: string; color: string }> = {
  contact: { bg: '#E6F1FB', color: '#185FA5' },
  deal:    { bg: '#E1F5EE', color: '#0F6E56' },
  task:    { bg: '#FAEEDA', color: '#854F0B' },
  note:    { bg: '#EEEDFE', color: '#534AB7' },
  company: { bg: '#FCEBEB', color: '#A32D2D' },
}

export default function CapturePage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const [displayedSummary, setDisplayedSummary] = useState('')
  const [visibleCreates, setVisibleCreates] = useState(0)
  // Selection keys: 'contact:0' | 'company:1' | 'deal:0' | 'task:0' | 'note:0'
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sheetInputRef = useRef<HTMLInputElement>(null)
  const [sheetResult, setSheetResult] = useState<SheetResult | null>(null)
  const [sheetSaving, setSheetSaving] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<number[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([])
  const [selectedDeals, setSelectedDeals] = useState<number[]>([])
  const [sheetStep, setSheetStep] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const isListeningRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking, pendingAction])

  useEffect(() => {
    if (mode !== 'image_processing') { setProcessingStep(0); return }
    const interval = setInterval(() => {
      setProcessingStep(prev => { if (prev >= 4) { clearInterval(interval); return prev } return prev + 1 })
    }, 600)
    return () => clearInterval(interval)
  }, [mode])

  useEffect(() => {
    if (mode !== 'image_confirm' || !aiResult?.summary) { setDisplayedSummary(''); return }
    setDisplayedSummary('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayedSummary(aiResult.summary.slice(0, i))
      if (i >= aiResult.summary.length) clearInterval(interval)
    }, 18)
    return () => clearInterval(interval)
  }, [mode, aiResult])

  useEffect(() => {
    if (mode !== 'image_confirm' || !aiResult) { setVisibleCreates(0); return }
    const items = buildDisplayItems(aiResult)
    if (items.length === 0) { setVisibleCreates(0); return }
    setVisibleCreates(0)
    let i = 0
    const interval = setInterval(() => {
      i++
      setVisibleCreates(i)
      if (i >= items.length) clearInterval(interval)
    }, 150)
    return () => clearInterval(interval)
  }, [mode, aiResult])

  const compressImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        const MAX = 1280
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = url
    })
  }

  const handleImageSelect = async (file: File) => {
    setMode('image_processing')
    try {
      const { base64, mimeType } = await compressImage(file)
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      })
      if (!response.ok) throw new Error('AI processing failed')
      const result = await response.json()
      setAiResult(result)
      const items = buildDisplayItems(result)
      setSelectedItems(new Set(items.map(it => it.selectionKey)))
      setMode('image_confirm')
    } catch {
      setMode('choose')
      alert('Something went wrong. Please try again.')
    }
  }

  const handleImageSave = async () => {
    if (!aiResult) return
    setSaving(true)
    const shouldCreateContact = Array.from(selectedItems).some(k => k.startsWith('contact:'))
    const shouldCreateDeal    = Array.from(selectedItems).some(k => k.startsWith('deal:'))
    const shouldCreateTask    = Array.from(selectedItems).some(k => k.startsWith('task:'))
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: membership } = await supabase
      .from('organisation_members').select('org_id')
      .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle()
    const org_id = membership?.org_id || null

    // Resolve extracted records — prefer server-coerced shape, fall back to
    // legacy flat envelope if /api/capture is on an older deploy.
    const fullExtracted = aiResult.extracted ?? {
      contacts:  aiResult.contacts?.length
        ? aiResult.contacts
        : (aiResult.contact_name ? [{ full_name: aiResult.contact_name }] : []),
      companies: aiResult.company_name ? [{ name: aiResult.company_name }] : [],
      deals:     aiResult.deal_name
        ? [{ name: aiResult.deal_name, value: aiResult.deal_value ?? null }]
        : [],
    }

    // Filter to only the records whose pill is toggled on
    const extracted = {
      contacts:  fullExtracted.contacts .filter((_, i) => selectedItems.has(`contact:${i}`)),
      companies: fullExtracted.companies.filter((_, i) => selectedItems.has(`company:${i}`)),
      deals:     fullExtracted.deals    .filter((_, i) => selectedItems.has(`deal:${i}`)),
    }

    try {
      // ─── Companies ────────────────────────────────────────────────────────
      // Build a name → id map of all extracted companies (used to link contacts/deals)
      const companyMap: Record<string, string> = {}
      for (const co of extracted.companies) {
        if (!co?.name) continue
        const { data: existing } = await supabase
          .from('companies').select('id')
          .eq('user_id', user.id).ilike('name', co.name).maybeSingle()
        if (existing) {
          companyMap[co.name.toLowerCase()] = existing.id
          // Update with any new enrichments (only fields not already populated would be nicer,
          // but we trust coerced output from server)
          const enrich = pickRegistryFields('companies', co, ['name'])
          if (Object.keys(enrich).length > 0) {
            await supabase.from('companies').update(enrich).eq('id', existing.id)
          }
        } else {
          const insert = { user_id: user.id, org_id, name: co.name, ...pickRegistryFields('companies', co, ['name']) }
          const { data: newCo } = await supabase.from('companies').insert(insert).select('id').maybeSingle()
          if (newCo) companyMap[co.name.toLowerCase()] = newCo.id
        }
      }

      // Primary company id (first extracted) — used as fallback link
      const primaryCompanyName = extracted.companies[0]?.name
      const primaryCompanyId   = primaryCompanyName ? companyMap[primaryCompanyName.toLowerCase()] : null

      // ─── Contacts ─────────────────────────────────────────────────────────
      let primaryContactId: string | null = null
      const contactsToCreate = shouldCreateContact ? extracted.contacts : []

      for (const c of contactsToCreate) {
        if (!c?.full_name) continue

        // Per-contact company link: if the contact specifies its own company_name
        // and we haven't already mapped it, look it up / create it.
        let contactCompanyId: string | null = primaryCompanyId
        if (c.company_name && c.company_name !== primaryCompanyName) {
          const lookup = c.company_name.toLowerCase()
          if (companyMap[lookup]) {
            contactCompanyId = companyMap[lookup]
          } else {
            const { data: existingCo } = await supabase
              .from('companies').select('id')
              .eq('user_id', user.id).ilike('name', c.company_name).maybeSingle()
            if (existingCo) {
              contactCompanyId = existingCo.id
              companyMap[lookup] = existingCo.id
            } else {
              const { data: newCo } = await supabase.from('companies')
                .insert({ user_id: user.id, name: c.company_name, org_id })
                .select('id').maybeSingle()
              if (newCo) {
                contactCompanyId = newCo.id
                companyMap[lookup] = newCo.id
              }
            }
          }
        }

        const enrich = pickRegistryFields('contacts', c, ['full_name'])

        const { data: existing } = await supabase
          .from('contacts').select('id')
          .eq('user_id', user.id).ilike('full_name', c.full_name).maybeSingle()

        if (existing) {
          await supabase.from('contacts').update({
            last_contacted_at: new Date().toISOString(),
            company_id: contactCompanyId || undefined,
            ...enrich,
          }).eq('id', existing.id)
          if (!primaryContactId) primaryContactId = existing.id
        } else {
          const { data: newContact } = await supabase.from('contacts').insert({
            user_id: user.id, org_id,
            full_name: c.full_name,
            company_id: contactCompanyId,
            last_contacted_at: new Date().toISOString(),
            ...enrich,
          }).select('id').maybeSingle()
          if (!primaryContactId) primaryContactId = newContact?.id ?? null
        }
      }

      // ─── Deal ─────────────────────────────────────────────────────────────
      let dealId: string | null = null
      if (shouldCreateDeal && extracted.deals[0]?.name) {
        const d = extracted.deals[0]
        const enrich = pickRegistryFields('deals', d, ['name', 'stage'])
        const { data: newDeal } = await supabase.from('deals').insert({
          user_id: user.id, org_id,
          company_id: primaryCompanyId,
          name: d.name,
          stage: 'lead',
          last_activity_at: new Date().toISOString(),
          ...enrich,
        }).select('id').maybeSingle()
        dealId = newDeal?.id ?? null
        if (dealId && primaryContactId) {
          await supabase.from('deal_contacts')
            .upsert({ deal_id: dealId, contact_id: primaryContactId }, { onConflict: 'deal_id,contact_id' })
        }
      }

      // ─── Event log ────────────────────────────────────────────────────────
      await supabase.from('events').insert({
        user_id: user.id, org_id,
        deal_id: dealId, contact_id: primaryContactId, company_id: primaryCompanyId,
        type: aiResult.event_type || 'meeting',
        summary: aiResult.summary,
        ai_confidence: 0.9,
        metadata: { raw_ai_result: aiResult },
      })

      // ─── Follow-up task ───────────────────────────────────────────────────
      if (shouldCreateTask && aiResult.follow_up_date) {
        const followUpName =
          extracted.contacts[0]?.full_name ??
          extracted.companies[0]?.name ??
          'contact'
        await supabase.from('tasks').insert({
          user_id: user.id, org_id,
          deal_id: dealId, contact_id: primaryContactId,
          title: `Follow up with ${followUpName}`,
          due_date: new Date(aiResult.follow_up_date).toISOString(),
          ai_generated: true,
        })
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Failed to save.')
      setSaving(false)
    }
  }

  const executeMessage = async (text: string) => {
    setIsThinking(true)
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: conversationHistory }),
      })
      const data = await response.json()
      const replyText = data.reply ?? 'Something went wrong.'
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }])
      setConversationHistory(data.history)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setIsThinking(false)
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInputText('')
    setTranscript('')
    transcriptRef.current = ''
    setPendingAction(null)
    setIsThinking(true)

    try {
      // First call preview to check if confirmation needed
      const previewRes = await fetch('/api/assistant/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const preview = await previewRes.json()

      if (preview.needs_confirmation && preview.creates?.length > 0) {
        setIsThinking(false)
        setPendingAction({ message: text, summary: preview.summary, creates: preview.creates })
      } else {
        await executeMessage(text)
      }
    } catch {
      await executeMessage(text)
    }
  }

  const confirmAction = async () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    setIsThinking(true)
    await executeMessage(action.message)
  }

  const cancelAction = () => {
    if (!pendingAction) return
    setPendingAction(null)
    setMessages(prev => [...prev, { role: 'assistant', content: 'No problem, action cancelled.' }])
  }

  const startVoice = () => {
    if (isListeningRef.current) return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice not supported. Try Chrome or Safari.'); return }
    transcriptRef.current = ''
    setTranscript('')
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition
    recognition.onstart = () => { isListeningRef.current = true; setIsListening(true) }
    recognition.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setTranscript(text)
      transcriptRef.current = text
    }
    recognition.onend = () => {
      isListeningRef.current = false
      setIsListening(false)
      if (transcriptRef.current.trim()) sendMessage(transcriptRef.current.trim())
    }
    recognition.onerror = () => { isListeningRef.current = false; setIsListening(false) }
    recognition.start()
  }

  const stopVoice = () => { if (!isListeningRef.current) return; recognitionRef.current?.stop() }
  const startVoiceFromChoose = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice not supported. Try Chrome or Safari.'); return }
    setMode('assistant')
    setTimeout(() => startVoice(), 100)
  }
  const handleMicClick = () => { if (isListeningRef.current) { stopVoice() } else { startVoice() } }

  const handleSheetSelect = async (file: File) => {
    setMode('sheet_processing')
    setSheetStep(0)
    try {
      // Dynamically import SheetJS
      const XLSX = await import('xlsx')
      setSheetStep(1)
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null })
      setSheetStep(2)
      if (rows.length === 0) {
        setMode('choose')
        alert('No data found in spreadsheet.')
        return
      }
      setSheetStep(3)
      const response = await fetch('/api/capture/spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!response.ok) throw new Error('AI processing failed')
      const result: SheetResult = await response.json()
      setSheetStep(4)
      setSheetResult(result)
      setSelectedContacts(result.contacts.map((_, i) => i))
      setSelectedCompanies(result.companies.map((_, i) => i))
      setSelectedDeals((result.deals ?? []).map((_, i) => i))
      setMode('sheet_confirm')
    } catch (err: any) {
      setMode('choose')
      alert(err.message || 'Something went wrong. Please try again.')
    }
  }
  const handleSheetSave = async () => {
  if (!sheetResult) return
  setSheetSaving(true)

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    setSheetSaving(false)
    alert('Not signed in.')
    return
  }

  const { data: membership, error: memErr } = await supabase
    .from('organisation_members').select('org_id')
    .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle()

  if (memErr) {
    logger.error('capture/sheet-save', 'Membership lookup failed', memErr)
    alert(`Could not load your workspace: ${memErr.message}`)
    setSheetSaving(false)
    return
  }

  const org_id = membership?.org_id ?? null
  if (!org_id) {
    logger.error('capture/sheet-save', 'No active org_id for user', { userId: user.id })
    alert('No active workspace found. Please re-onboard.')
    setSheetSaving(false)
    return
  }

  // Track failures across the loop so we can show one consolidated error
  const failures: string[] = []
  let companiesCreated = 0, companiesUpdated = 0
  let contactsCreated = 0, contactsUpdated = 0

  try {
    // ─── Companies ────────────────────────────────────────────────────────
    const companyMap: Record<string, string> = {}
    const chosenCompanies = sheetResult.companies.filter((_, i) => selectedCompanies.includes(i))

    for (const co of chosenCompanies) {
      if (!co?.name) continue
      const enrich = pickRegistryFields('companies', co, ['name'])

      const { data: existing, error: lookupErr } = await supabase
        .from('companies').select('id')
        .eq('user_id', user.id).ilike('name', co.name).maybeSingle()

      if (lookupErr) {
        logger.error('capture/sheet-save', 'Company lookup failed', { name: co.name, error: lookupErr })
        failures.push(`Company lookup ${co.name}: ${lookupErr.message}`)
        continue
      }

      if (existing) {
        companyMap[co.name.toLowerCase()] = existing.id
        if (Object.keys(enrich).length > 0) {
          const { error: updErr } = await supabase
            .from('companies').update(enrich).eq('id', existing.id)
          if (updErr) {
            logger.error('capture/sheet-save', 'Company update failed', { name: co.name, error: updErr })
            failures.push(`Update ${co.name}: ${updErr.message}`)
          } else {
            companiesUpdated++
          }
        }
      } else {
        const insert = { user_id: user.id, org_id, name: co.name, ...enrich }
        const { data: newCo, error: insErr } = await supabase
          .from('companies').insert(insert).select('id').maybeSingle()
        if (insErr) {
          logger.error('capture/sheet-save', 'Company insert failed', { name: co.name, error: insErr })
          failures.push(`Insert ${co.name}: ${insErr.message}`)
          continue
        }
        if (newCo) {
          companyMap[co.name.toLowerCase()] = newCo.id
          companiesCreated++
        }
      }
    }

    // ─── Contacts ─────────────────────────────────────────────────────────
    const chosenContacts = sheetResult.contacts.filter((_, i) => selectedContacts.includes(i))

    for (const c of chosenContacts) {
      if (!c?.full_name) continue
      const company_id = c.company_name ? (companyMap[c.company_name.toLowerCase()] || null) : null
      const enrich = pickRegistryFields('contacts', c, ['full_name'])

      const { data: existing, error: lookupErr } = await supabase
        .from('contacts').select('id')
        .eq('user_id', user.id).ilike('full_name', c.full_name).maybeSingle()

      if (lookupErr) {
        logger.error('capture/sheet-save', 'Contact lookup failed', { name: c.full_name, error: lookupErr })
        failures.push(`Contact lookup ${c.full_name}: ${lookupErr.message}`)
        continue
      }

      if (existing) {
        const { error: updErr } = await supabase.from('contacts').update({
          company_id: company_id || undefined,
          ...enrich,
        }).eq('id', existing.id)
        if (updErr) {
          logger.error('capture/sheet-save', 'Contact update failed', { name: c.full_name, error: updErr })
          failures.push(`Update ${c.full_name}: ${updErr.message}`)
        } else {
          contactsUpdated++
        }
      } else {
        const insert = {
          user_id: user.id, org_id,
          full_name: c.full_name,
          company_id,
          ...enrich,
        }
        const { error: insErr } = await supabase.from('contacts').insert(insert)
        if (insErr) {
          logger.error('capture/sheet-save', 'Contact insert failed', { name: c.full_name, error: insErr })
          failures.push(`Insert ${c.full_name}: ${insErr.message}`)
        } else {
          contactsCreated++
        }
      }
    }

    // ─── Deals ────────────────────────────────────────────────────────────
    const chosenDeals = (sheetResult.deals ?? []).filter((_, i) => selectedDeals.includes(i))
    let dealsCreated = 0, dealsUpdated = 0

    for (const d of chosenDeals) {
      if (!d?.name) continue
      const company_id = d.company_name ? (companyMap[d.company_name.toLowerCase()] || null) : null

      // Resolve contact link
      let contact_id: string | null = null
      if (d.contact_name) {
        const { data: existingContact } = await supabase
          .from('contacts').select('id')
          .eq('user_id', user.id).ilike('full_name', d.contact_name).maybeSingle()
        contact_id = existingContact?.id || null
      }

      const enrich = pickRegistryFields('deals', d, ['name', 'stage', 'company_name', 'contact_name'])

      const { data: existingDeal, error: dealLookupErr } = await supabase
        .from('deals').select('id')
        .eq('user_id', user.id).ilike('name', d.name).maybeSingle()

      if (dealLookupErr) {
        failures.push(`Deal lookup ${d.name}: ${dealLookupErr.message}`)
        continue
      }

      if (existingDeal) {
        const { error: updErr } = await supabase.from('deals').update({
          company_id: company_id || undefined,
          last_activity_at: new Date().toISOString(),
          ...enrich,
        }).eq('id', existingDeal.id)
        if (updErr) {
          failures.push(`Update deal ${d.name}: ${updErr.message}`)
        } else {
          dealsUpdated++
          if (contact_id) {
            await supabase.from('deal_contacts')
              .upsert({ deal_id: existingDeal.id, contact_id }, { onConflict: 'deal_id,contact_id' })
          }
        }
      } else {
        const { data: newDeal, error: insErr } = await supabase.from('deals').insert({
          user_id: user.id, org_id,
          name: d.name,
          company_id,
          stage: d.stage || 'lead',
          last_activity_at: new Date().toISOString(),
          ...enrich,
        }).select('id').maybeSingle()
        if (insErr) {
          failures.push(`Insert deal ${d.name}: ${insErr.message}`)
        } else {
          dealsCreated++
          if (newDeal && contact_id) {
            await supabase.from('deal_contacts')
              .upsert({ deal_id: newDeal.id, contact_id }, { onConflict: 'deal_id,contact_id' })
          }
        }
      }
    }

    // ─── If everything failed, don't redirect ─────────────────────────────
    const totalAttempted = chosenCompanies.length + chosenContacts.length + chosenDeals.length
    const totalSucceeded = companiesCreated + companiesUpdated + contactsCreated + contactsUpdated + dealsCreated + dealsUpdated
    if (totalSucceeded === 0 && totalAttempted > 0) {
      const msg = failures.length > 0
        ? `Import failed. First error:\n\n${failures[0]}`
        : 'Import failed silently — no records were written.'
      alert(msg)
      setSheetSaving(false)
      return
    }

    // ─── Log import event ─────────────────────────────────────────────────
    const summaryNote =
      `Spreadsheet import: ${contactsCreated} contacts created, ${contactsUpdated} updated, ` +
      `${companiesCreated} companies created, ${companiesUpdated} updated, ` +
      `${dealsCreated} deals created, ${dealsUpdated} updated.` +
      (failures.length ? ` ${failures.length} rows failed.` : '')

    const { error: evErr } = await supabase.from('events').insert({
      user_id: user.id, org_id, type: 'other',
      summary: summaryNote,
      metadata: {
        source: 'spreadsheet_import',
        contactsCreated, contactsUpdated, companiesCreated, companiesUpdated,
        dealsCreated, dealsUpdated,
        failures: failures.slice(0, 20),
      },
    })
    if (evErr) {
      logger.warn('capture/sheet-save', 'Event log failed', evErr)
      // Non-fatal — don't block the redirect
    }

    if (failures.length > 0) {
      alert(
        `Imported ${totalSucceeded} of ${totalAttempted} records. ` +
        `${failures.length} failed — check console for details.`
      )
    }

    router.push('/')
    router.refresh()
  } catch (err: any) {
    logger.error('capture/sheet-save', 'Unexpected error', err)
    alert(err.message || 'Failed to save.')
    setSheetSaving(false)
  }
}
  return (
    <main style={{ background: '#f5f4f0', paddingBottom: '90px', display: 'flex', flexDirection: 'column' }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]) }} />
      <input ref={sheetInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) handleSheetSelect(e.target.files[0]); e.currentTarget.value = '' }} />

      {/* Header */}
      <div style={{ padding: '56px 24px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {mode !== 'choose' && (
          <button onClick={() => { setMode('choose'); setMessages([]); setTranscript(''); setPendingAction(null); setSheetResult(null); transcriptRef.current = ''; recognitionRef.current?.stop() }} style={{
            width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.07)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: '#1a1a18' }}>
          {mode === 'choose' ? 'What can I help with?' :
           mode === 'image_processing' ? 'Reading image...' :
           mode === 'image_confirm' ? 'Review capture' :
           mode === 'sheet_processing' ? 'Reading spreadsheet...' :
           mode === 'sheet_confirm' ? 'Review import' : 'AI Assistant'}
        </p>
      </div>

      {/* Choose */}
      {mode === 'choose' && (
        <div style={{ padding: '0 24px', flex: 1 }} className="animate-fade-in-up">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{
              background: '#1a1a18', borderRadius: '18px', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px',
              border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="15" rx="2" stroke="white" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
                  <circle cx="17.5" cy="7.5" r="1" fill="white" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'white' }}>Capture image or screenshot</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Business card, WhatsApp, email, notes</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <button onClick={startVoiceFromChoose} style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3" stroke="#1a1a18" strokeWidth="1.5" />
                  <path d="M5 10a7 7 0 0 0 14 0" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 17v4M9 21h6" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Speak to assistant</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>Add contacts, search, update deals</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <button onClick={() => setMode('assistant')} style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#1a1a18" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Type a message</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>Chat with your AI sales assistant</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <button onClick={() => sheetInputRef.current?.click()} style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#1a1a18" strokeWidth="1.5" />
                  <path d="M3 9h18M3 15h18M9 3v18" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Import spreadsheet</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>Upload .xlsx or .csv — AI maps contacts & companies</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <p style={{ margin: '0 0 10px', fontSize: '10px', fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>Try saying</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'Add Tom from UC Architecture to my contacts',
              "What's the status of the TechCorp deal?",
              "Pull out Tracy's email from Loo Consulting",
              'Schedule a follow-up with Maria for Friday',
              'Show me my pipeline summary',
            ].map((example, i) => (
              <button key={i} onClick={() => { setMode('assistant'); setTimeout(() => sendMessage(example), 100) }} style={{
                background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.07)',
                padding: '11px 14px', textAlign: 'left', cursor: 'pointer', width: '100%',
                fontSize: '13px', color: '#6b6960', fontFamily: 'inherit',
              }}>
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image processing */}
      {mode === 'image_processing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', padding: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="capture-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
            {['Analysing image...', 'Identifying people and companies...', 'Extracting contact details...', 'Building your CRM update...', 'Almost done...'].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: processingStep >= i ? 1 : 0.2, transition: 'opacity 0.4s ease' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, background: processingStep > i ? '#1D9E75' : processingStep === i ? '#1a1a18' : 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s ease' }}>
                  {processingStep > i ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : processingStep === i ? (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white', animation: 'breathe 1s ease-in-out infinite' }} />
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: processingStep > i ? '#1D9E75' : processingStep === i ? '#1a1a18' : '#9b9890', fontWeight: processingStep === i ? 500 : 400, transition: 'color 0.3s ease' }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image confirm */}
      {mode === 'image_confirm' && aiResult && (
        <div style={{ padding: '0 24px', flex: 1 }} className="animate-slide-up">
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '16px 18px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#1D9E75' }}>AI processed</span>
            </div>
            <p style={{ margin: 0, fontSize: '15px', color: '#1a1a18', lineHeight: 1.6, minHeight: '24px' }}>
              {displayedSummary}
              {displayedSummary.length < (aiResult.summary?.length || 0) && (
                <span style={{ display: 'inline-block', width: '2px', height: '16px', background: '#1a1a18', marginLeft: '2px', verticalAlign: 'middle', animation: 'breathe 0.8s ease-in-out infinite' }} />
              )}
            </p>
          </div>

          {(() => {
            const items = buildDisplayItems(aiResult)
            if (items.length === 0) return null
            return (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '10px', fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>I'll create or update</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((item, i) => {
                  const selected = selectedItems.has(item.selectionKey)
                  const visible = i < visibleCreates
                  const pillType = item.kind === 'entity' ? item.entityType : item.createType
                  const toggle = () => {
                    setSelectedItems(prev => {
                      const next = new Set(prev)
                      if (next.has(item.selectionKey)) next.delete(item.selectionKey)
                      else next.add(item.selectionKey)
                      return next
                    })
                  }
                  return (
                    <div key={item.selectionKey}
                      style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(12px)',
                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                      }}
                    >
                      <button onClick={toggle} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: selected ? pillColors[pillType]?.bg ?? '#f5f4f0' : '#f5f4f0',
                        border: selected ? `1px solid ${pillColors[pillType]?.color ?? '#9b9890'}20` : '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '14px', padding: '11px 14px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s ease',
                      }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, background: selected ? pillColors[pillType]?.color ?? '#9b9890' : 'white', border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                          {selected && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: selected ? pillColors[pillType]?.color ?? '#9b9890' : '#9b9890', transition: 'color 0.15s ease' }}>{item.label}</span>
                      </button>

                      {/* Inline field editor for entity items, when toggled on */}
                      {item.kind === 'entity' && selected && aiResult.extracted && aiResult.config && (
                        <ExtractedFieldList
                          entity={ENTITY_PLURAL[item.entityType]}
                          record={aiResult.extracted[ENTITY_PLURAL[item.entityType]][item.recordIndex] ?? {}}
                          visibleKeys={aiResult.config.visibleFields[ENTITY_PLURAL[item.entityType]] ?? []}
                          fieldOptions={aiResult.config.fieldOptions}
                          onChange={(next) => {
                            setAiResult(prev => {
                              if (!prev?.extracted) return prev
                              const plural = ENTITY_PLURAL[item.entityType]
                              const arr = [...prev.extracted[plural]]
                              arr[item.recordIndex] = next
                              return { ...prev, extracted: { ...prev.extracted, [plural]: arr } }
                            })
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })()}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={() => setMode('choose')} style={{ flex: 1, background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 9999, padding: '15px', fontSize: '15px', color: '#6b6960', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
            <button onClick={handleImageSave} disabled={saving} className="btn-chrome" style={{ flex: 2, fontSize: '15px', padding: '15px', borderRadius: 9999, justifyContent: 'center', opacity: saving ? 0.55 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Looks good, save it'}
            </button>
          </div>
        </div>
      )}

      {/* Sheet processing */}
      {mode === 'sheet_processing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', padding: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="capture-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.5" />
              <path d="M3 9h18M3 15h18M9 3v18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
            {['Loading SheetJS parser...', 'Parsing spreadsheet rows...', 'Sending to AI...', 'Mapping contacts & companies...', 'Almost done...'].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: sheetStep >= i ? 1 : 0.2, transition: 'opacity 0.4s ease' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, background: sheetStep > i ? '#1D9E75' : sheetStep === i ? '#1a1a18' : 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s ease' }}>
                  {sheetStep > i ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : sheetStep === i ? (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white', animation: 'breathe 1s ease-in-out infinite' }} />
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: sheetStep > i ? '#1D9E75' : sheetStep === i ? '#1a1a18' : '#9b9890', fontWeight: sheetStep === i ? 500 : 400, transition: 'color 0.3s ease' }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sheet confirm */}
      {mode === 'sheet_confirm' && sheetResult && (
        <div style={{ padding: '0 24px', flex: 1, overflowY: 'auto' }} className="animate-slide-up no-scrollbar">
          {/* Single card containing all rows */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', overflow: 'hidden', marginBottom: '16px' }}>

            {/* Card header */}
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>Review import</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: '#9b9890' }}>{selectedContacts.length + selectedCompanies.length + selectedDeals.length} of {sheetResult.contacts.length + sheetResult.companies.length + (sheetResult.deals ?? []).length} selected</span>
                <button
                  onClick={() => {
                    const allSelected = selectedContacts.length === sheetResult.contacts.length && selectedCompanies.length === sheetResult.companies.length && selectedDeals.length === (sheetResult.deals ?? []).length
                    if (allSelected) { setSelectedContacts([]); setSelectedCompanies([]); setSelectedDeals([]) }
                    else { setSelectedContacts(sheetResult.contacts.map((_, i) => i)); setSelectedCompanies(sheetResult.companies.map((_, i) => i)); setSelectedDeals((sheetResult.deals ?? []).map((_, i) => i)) }
                  }}
                  style={{ background: 'none', border: 'none', fontSize: '11px', color: '#6b6960', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  {selectedContacts.length === sheetResult.contacts.length && selectedCompanies.length === sheetResult.companies.length && selectedDeals.length === (sheetResult.deals ?? []).length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            </div>

            {/* AI notes row */}
            <div style={{ padding: '11px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.4 }}>{sheetResult.notes}</p>
                {sheetResult.skipped > 0 && (
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9b9890' }}>{sheetResult.skipped} rows skipped — no name found</p>
                )}
              </div>
            </div>

            {/* Company rows */}
            {sheetResult.companies.map((co, i) => {
              const selected = selectedCompanies.includes(i)
              return (
                <button
                  key={`co-${i}`}
                  onClick={() => setSelectedCompanies(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', borderBottomStyle: 'solid', borderBottomWidth: '0.5px', borderBottomColor: 'rgba(0,0,0,0.06)' }}
                >
                  {/* Icon */}
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</p>
                    {(co.industry || co.website || co.city) && (
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9b9890', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[co.industry, co.city, co.website].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {/* Checkbox */}
                  <div style={{ width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, background: selected ? '#A32D2D' : 'transparent', border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                    {selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </button>
              )
            })}

            {/* Deal rows */}
            {(sheetResult.deals ?? []).map((d, i) => {
              const selected = selectedDeals.includes(i)
              return (
                <button
                  key={`d-${i}`}
                  onClick={() => setSelectedDeals(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', borderBottomStyle: 'solid', borderBottomWidth: '0.5px', borderBottomColor: 'rgba(0,0,0,0.06)' }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9b9890', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[d.company_name, d.stage, d.value != null ? `${d.currency ?? ''}${Number(d.value).toLocaleString()}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, background: selected ? '#0F6E56' : 'transparent', border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                    {selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </button>
              )
            })}

            {/* Contact rows */}
            {sheetResult.contacts.map((c, i) => {
              const selected = selectedContacts.includes(i)
              const isLast = i === sheetResult.contacts.length - 1
              return (
                <button
                  key={`c-${i}`}
                  onClick={() => setSelectedContacts(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', background: 'transparent', border: 'none', borderBottom: isLast ? 'none' : '0.5px solid rgba(0,0,0,0.06)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}
                >
                  {/* Icon */}
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9b9890', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[c.role, c.company_name, c.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {/* Checkbox */}
                  <div style={{ width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, background: selected ? '#185FA5' : 'transparent', border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                    {selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
            <button onClick={() => { setMode('choose'); setSheetResult(null); setSelectedDeals([]) }} style={{ flex: 1, background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 9999, padding: '15px', fontSize: '15px', color: '#6b6960', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
            <button onClick={handleSheetSave} disabled={sheetSaving || (selectedContacts.length === 0 && selectedCompanies.length === 0 && selectedDeals.length === 0)}
              className="btn-chrome"
              style={{
                flex: 2, fontSize: '15px', padding: '15px', borderRadius: 9999, justifyContent: 'center',
                opacity: (sheetSaving || (selectedContacts.length === 0 && selectedCompanies.length === 0 && selectedDeals.length === 0)) ? 0.5 : 1,
                cursor: (sheetSaving || (selectedContacts.length === 0 && selectedCompanies.length === 0 && selectedDeals.length === 0)) ? 'not-allowed' : 'pointer',
              }}>
              {sheetSaving ? 'Importing…' : `Import ${selectedContacts.length + selectedCompanies.length + selectedDeals.length} records`}
            </button>
          </div>
        </div>
      )}

      {/* Assistant chat */}
      {mode === 'assistant' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }} className="no-scrollbar">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ margin: 0, fontSize: '15px', color: '#9b9890' }}>Ask me anything about your CRM</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
                <div style={{
                  maxWidth: '85%', padding: '11px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? '#1a1a18' : 'white',
                  border: msg.role === 'assistant' ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                  fontSize: '14px', lineHeight: 1.5,
                  color: msg.role === 'user' ? 'white' : '#1a1a18',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Pending action confirm card */}
            {pendingAction && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF9F27' }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#EF9F27' }}>Confirm action</span>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#1a1a18', lineHeight: 1.5 }}>{pendingAction.summary}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {pendingAction.creates.map((item, i) => {
                      const colors = pillColors[item.type] ?? { bg: '#f5f4f0', color: '#6b6960' }
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: colors.bg }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', fontWeight: 500, color: colors.color }}>{item.label}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelAction} style={{ flex: 1, padding: '10px', borderRadius: 20, background: 'transparent', border: '0.5px solid rgba(0,0,0,0.1)', fontSize: '14px', color: '#6b6960', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                    <button onClick={confirmAction} style={{ flex: 2, padding: '10px', borderRadius: 20, background: '#1a1a18', border: 'none', fontSize: '14px', color: 'white', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Yes, do it
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isThinking && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
                <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#9b9890', animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isListening && (
            <div style={{ margin: '0 24px 8px', background: '#E1F5EE', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', color: '#0F6E56' }}>
              {transcript || 'Listening...'}
            </div>
          )}

          <div style={{ padding: '8px 24px 0', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ flex: 1, background: 'white', borderRadius: '24px', border: '0.5px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', padding: '10px 16px' }}>
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
                placeholder="Ask anything..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#1a1a18', background: 'transparent', fontFamily: 'inherit' }}
                autoFocus
              />
            </div>
            <button onClick={handleMicClick} style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, background: isListening ? '#1D9E75' : '#1a1a18', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s ease', touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="white" strokeWidth="1.5" />
                <path d="M5 10a7 7 0 0 0 14 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 17v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {inputText && (
              <button onClick={() => sendMessage(inputText)} style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, background: '#1a1a18', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}