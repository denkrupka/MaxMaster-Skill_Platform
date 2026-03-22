import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase'
import { computeDiffPatches } from '../../utils/trackChanges'

const SUPABASE_URL = 'https://diytvuczpciikzdhldny.supabase.co'

type Step = 'loading' | 'phone' | 'otp' | 'document' | 'editing' | 'proposal_sent' | 'signed' | 'expired'

interface SignData {
  token: any
  request: any
  document: any
  company?: any
}

const SignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [step, setStep] = useState<Step>('loading')
  const [signData, setSignData] = useState<SignData | null>(null)
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [diffSummary, setDiffSummary] = useState('')
  const [proposal, setProposal] = useState<any>(null)
  const [signatureName, setSignatureName] = useState('')
  const [renderedContent, setRenderedContent] = useState<string>('')
  const [companyBranding, setCompanyBranding] = useState<{ name?: string; logo_url?: string; color?: string } | null>(null)
  const [signingMethod, setSigningMethod] = useState<'type' | 'draw' | 'upload' | 'pz'>('type')
  const [allowedMethods, setAllowedMethods] = useState<('type' | 'draw' | 'upload' | 'pz')[]>(['type', 'draw', 'upload', 'pz'])
  const [pzLoading, setPzLoading] = useState(false)
  const [pzError, setPzError] = useState('')
  const [drawSignatureData, setDrawSignatureData] = useState('')
  const [uploadSignatureData, setUploadSignatureData] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })

  // TipTap editor for editing mode
  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color],
    editable: false,
    content: '',
  })

  const efPost = useCallback(async (fn: string, body: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    })
    return res.json()
  }, [])

  useEffect(() => {
    if (!token) { setStep('expired'); setError('Brak tokenu w linku'); return }
    loadSignData()
  }, [token])

  const [templateContent, setTemplateContent] = useState<string | null>(null)

  const renderTemplateWithData = (template: string, data: Record<string, any>): string => {
    if (!template || !data) return template || ''
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = data[key]
      if (val === undefined || val === null) return `{{${key}}}`
      return String(val)
    })
  }

  const getDocContent = (doc: any): string => {
    if (!doc) return ''

    // If we have a fetched template content + data object, render with substitution
    if (templateContent && doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data) && !doc.data.html && !doc.data.sections) {
      return renderTemplateWithData(templateContent, doc.data)
    }

    const raw = doc.data || doc.content
    if (raw) {
      if (typeof raw === 'string') return raw
      if (Array.isArray(raw)) return raw.map((s: any) => `<h2>${s.title || ''}</h2><p>${s.body || ''}</p>`).join('')
      if (typeof raw === 'object' && raw.sections) return raw.sections.map((s: any) => `<h2>${s.title || ''}</h2><p>${s.body || ''}</p>`).join('')
      if (typeof raw === 'object' && raw.html) return raw.html
      // If data is an object but no template loaded yet, show placeholder
      if (typeof raw === 'object' && doc.template_id) return '<p class="text-gray-400 text-center py-8">Ładowanie szablonu...</p>'
      // Last resort: try to render key-value pairs readably
      if (typeof raw === 'object') {
        return Object.entries(raw).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('')
      }
    }
    if (doc.document_templates?.content) {
      const c = doc.document_templates.content
      return Array.isArray(c) ? c.map((s: any) => `<h2>${s.title || ''}</h2><p>${s.body || ''}</p>`).join('') : String(c)
    }
    return ''
  }

  const loadSignData = async () => {
    setStep('loading')
    try {
      const data = await efPost('get-sign-data', { token: token! })
      if (data?.error || !data?.request) {
        setError(data?.error || 'Nie udało się załadować dokumentu')
        setStep('expired')
        return
      }
      setSignData(data)

      // Use server-side rendered content if available (from get-sign-data EF)
      if (data.rendered_content) {
        setRenderedContent(data.rendered_content)
      }

      if (data.company) {
        setCompanyBranding({ name: data.company.name, logo_url: data.company.logo_url, color: data.company.color })
      }

      // Fetch template content if document has template_id and data is JSONB object (client-side fallback)
      const docData = data.document?.data
      const templateId = data.document?.template_id
      if (templateId && docData && typeof docData === 'object' && !Array.isArray(docData) && !docData.html && !docData.sections) {
        try {
          const tplRes = await fetch(`${SUPABASE_URL}/rest/v1/document_templates?id=eq.${templateId}&select=content`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          })
          const tplRows = await tplRes.json()
          if (tplRows?.[0]?.content) {
            const tplContent = tplRows[0].content
            const tplStr = typeof tplContent === 'string' ? tplContent : JSON.stringify(tplContent)
            setTemplateContent(tplStr)
            // Pre-render template with variables for immediate display
            const vars = docData || {}
            let html = tplStr.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
              const val = (vars as Record<string, any>)[key]
              return val !== undefined && val !== null ? String(val) : `{{${key}}}`
            })
            setRenderedContent(html)
          }
        } catch (e) {
          console.warn('Failed to fetch template:', e)
        }
      }

      if (data.request?.signer_name) setSignatureName(data.request.signer_name)
      if (data.request?.signer_phone) setPhone(data.request.signer_phone)

      // Check if already signed
      if (data.token?.used_at) {
        setStep('signed')
        return
      }

      // Check if proposal exists
      const { data: proposals } = await supabase
        .from('document_change_proposals')
        .select('*')
        .eq('token', token!)
        .order('created_at', { ascending: false })
        .limit(1)

      if (proposals && proposals.length > 0) {
        setProposal(proposals[0])
        setStep('proposal_sent')
        return
      }

      // Set signing method from signer data
      const method = (data.request?.signing_method || data.request?.signers?.[0]?.signing_method || 'type') as 'type' | 'draw' | 'upload' | 'pz'
      setSigningMethod(method)

      // Set allowed methods — if a specific method was chosen, only show that one
      const reqAllowed = data.request?.allowed_methods || data.request?.allowedMethods
      if (reqAllowed && Array.isArray(reqAllowed) && reqAllowed.length > 0) {
        setAllowedMethods(reqAllowed as ('type' | 'draw' | 'upload' | 'pz')[])
      } else if (method && method !== 'type') {
        // If a specific non-default method was set, show only that method
        setAllowedMethods([method])
      }

      // Determine if signer has phone — require OTP if yes
      const signerPhone = data.request?.signer_phone || data.request?.signers?.[0]?.phone
      if (signerPhone) {
        setPhone(signerPhone)
        setStep('phone')
      } else {
        setStep('document')
      }
    } catch {
      setError('Błąd połączenia z serwerem')
      setStep('expired')
    }
  }

  const sendOtp = async () => {
    const cleanPhone = phone.replace(/\s/g, '').trim()
    if (!cleanPhone) { setError('Wpisz numer telefonu'); return }
    setLoading(true); setError('')
    try {
      const res = await efPost('send-sign-otp', { token: token!, phone: cleanPhone })
      if (res.ok || res.success) {
        setStep('otp')
      } else {
        setError(res.error || 'Błąd wysyłania SMS')
      }
    } catch {
      setError('Błąd połączenia')
    }
    setLoading(false)
  }

  const verifyOtp = async () => {
    if (otpCode.length !== 6) { setError('Wpisz 6-cyfrowy kod'); return }
    setLoading(true); setError('')
    try {
      const res = await efPost('verify-sign-otp', { token: token!, phone: phone.replace(/\s/g, ''), code: otpCode.trim() })
      if (res.verified || res.ok) {
        setStep('document')
      } else {
        setError(res.error || 'Nieprawidlowy kod')
      }
    } catch {
      setError('Błąd weryfikacji')
    }
    setLoading(false)
  }

  const handlePZSign = async () => {
    setPzLoading(true)
    setPzError('')
    try {
      const documentContent = getDocContent(signData?.document)
      const documentName =
        signData?.document?.name ||
        signData?.document?.title ||
        signData?.request?.document_name ||
        'Dokument MaxMaster'
      const res = await efPost('pz-signing', {
        action: 'init',
        token: token!,
        documentContent,
        documentName,
      })
      if (res.error === 'pz_endpoints_not_mapped') {
        // Known CPA limitation — show info message instead of hard error
        setPzError('Integracja Profil Zaufany jest aktywowana. Skontaktuj się z administratorem w celu weryfikacji endpointów CPA.')
      } else if (res.error || (!res.signingUrl && !res.redirectUrl)) {
        setPzError(res.message || res.error || 'Błąd inicjalizacji Profil Zaufany')
      } else {
        window.location.href = res.signingUrl || res.redirectUrl
      }
    } catch {
      setPzError('Błąd połączenia z serwisem Profil Zaufany')
    }
    setPzLoading(false)
  }

  const handleSign = async () => {
    if (signingMethod === 'type' && !signatureName.trim()) { setError('Wpisz imię i nazwisko'); return }
    if (signingMethod === 'draw' && !drawSignatureData) { setError('Narysuj podpis na polu poniżej'); return }
    if (signingMethod === 'upload' && !uploadSignatureData) { setError('Wgraj plik z podpisem'); return }
    setLoading(true); setError('')
    try {
      const signature = signingMethod === 'draw'
        ? { type: 'draw' as const, dataUrl: drawSignatureData }
        : signingMethod === 'upload'
          ? { type: 'upload' as const, dataUrl: uploadSignatureData }
          : { type: 'text' as const, value: signatureName }
      const res = await efPost('process-signature', { token: token!, signed: true, phone, name: signatureName, signature })
      if (res.success || res.ok || !res.error) {
        setStep('signed')
      } else {
        setError(res.error || 'Błąd podpisywania')
      }
    } catch {
      setError('Błąd podpisywania dokumentu')
    }
    setLoading(false)
  }

  const enterEditingMode = () => {
    const content = getDocContent(signData?.document)
    if (editor) {
      editor.commands.setContent(content)
      editor.setEditable(true)
    }
    setStep('editing')
  }

  const submitProposal = async () => {
    if (!editor) return
    const proposedContent = editor.getHTML()
    if (!diffSummary.trim()) { setError('Opisz proponowane zmiany'); return }

    setLoading(true); setError('')
    try {
      const originalContent = getDocContent(signData?.document)
      const signerNameVal = signData?.request?.signer_name || signatureName || 'Signer'
      const signerEmail = signData?.request?.signer_email || signData?.request?.recipient_email || ''

      // Compute diff patches for track changes view
      const patches = computeDiffPatches(originalContent, proposedContent, signerNameVal)

      const { error: insertErr } = await supabase.from('document_change_proposals').insert({
        document_id: signData?.request?.document_id || signData?.document?.id,
        request_id: signData?.token?.request_id || signData?.request?.id,
        token: token!,
        proposed_by_name: signerNameVal,
        proposed_by_email: signerEmail,
        original_content: originalContent,
        proposed_content: proposedContent,
        diff_summary: diffSummary,
        patches: patches,
        company_id: signData?.document?.company_id,
      })

      if (insertErr) {
        setError('Błąd zapisu propozycji: ' + insertErr.message)
      } else {
        // Reload proposal
        const { data: proposals } = await supabase
          .from('document_change_proposals')
          .select('*')
          .eq('token', token!)
          .order('created_at', { ascending: false })
          .limit(1)
        if (proposals?.[0]) setProposal(proposals[0])
        setStep('proposal_sent')
      }
    } catch {
      setError('Błąd wysyłania propozycji')
    }
    setLoading(false)
  }

  const cancelEditing = () => {
    if (editor) {
      editor.setEditable(false)
      editor.commands.setContent('')
    }
    setDiffSummary('')
    setError('')
    setStep('document')
  }

  // --- Canvas drawing helpers ---
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    setLastPos(getCanvasPos(e, canvas))
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getCanvasPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.x, lastPos.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setLastPos(pos)
  }

  const endDraw = () => {
    if (!isDrawing || !canvasRef.current) return
    setIsDrawing(false)
    setDrawSignatureData(canvasRef.current.toDataURL('image/png'))
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setDrawSignatureData('')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Plik jest zbyt duzy (max 5MB)'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setUploadSignatureData(ev.target?.result as string)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  // --- Derived values ---
  const docTitle = signData?.document?.name || signData?.document?.document_templates?.name || 'Dokument'
  const docNumber = signData?.request?.document_number || signData?.document?.number || ''
  const docContent = getDocContent(signData?.document)
  const signerDisplay = signData?.request?.signer_name || signData?.request?.recipient_name || ''

  // --- Company logo component ---
  const CompanyLogo = () => {
    if (!companyBranding) return null
    return (
      <div className="flex items-center gap-3 mb-4">
        {companyBranding.logo_url ? (
          <img src={companyBranding.logo_url} alt={companyBranding.name || 'Logo'} className="w-10 h-10 rounded-lg object-contain" />
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: companyBranding.color || '#2563eb' }}>
            <span className="text-white text-sm font-bold">{(companyBranding.name || 'MM').slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <span className="font-semibold text-gray-900">{companyBranding.name || 'MaxMaster'}</span>
      </div>
    )
  }

  // --- Step indicator ---
  const StepIndicator = () => {
    const steps = [
      { num: 1, label: 'Telefon', key: 'phone' },
      { num: 2, label: 'Weryfikacja', key: 'otp' },
      { num: 3, label: 'Podpis', key: 'document' },
    ]
    const stepIdx = step === 'phone' ? 0 : step === 'otp' ? 1 : 2
    return (
      <div className="flex items-center gap-0 mb-2">
        {steps.map((s, i) => {
          const isDone = i < stepIdx
          const isActive = i === stepIdx
          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone ? 'bg-blue-600 text-white' : isActive ? 'bg-blue-600 text-white ring-2 ring-blue-200' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isDone ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : s.num}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-blue-600' : isDone ? 'text-blue-400' : 'text-gray-400'}`}>{s.label}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${isDone ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  // --- LOADING ---
  if (step === 'loading') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-gray-500 text-sm">Ladowanie dokumentu...</span>
      </div>
    </div>
  )

  // --- EXPIRED / ERROR ---
  if (step === 'expired') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Nie mozna zaladowac dokumentu</h2>
        <p className="text-sm text-gray-500 mb-6">{error || 'Link do podpisu jest nieprawidlowy lub wygasl. Skontaktuj sie z nadawca dokumentu.'}</p>
      </div>
    </div>
  )

  // --- SIGNED ---
  if (step === 'signed') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dokument podpisany</h2>
        <p className="text-gray-500 mb-2">Dokument <strong>{docTitle}</strong> został pomyślnie podpisany.</p>
        <p className="text-xs text-gray-400 mb-4">Kopia zostanie wysłana na Twój e-mail.</p>
        <button
          onClick={() => {
            const base = window.location.origin + window.location.pathname;
            window.open(base + '#/sign/' + token + '/certificate', '_blank');
          }}
          className="px-4 py-2 text-sm border border-green-200 rounded-lg text-green-700 hover:bg-green-50 transition-colors font-medium"
        >
          Certyfikat podpisu
        </button>
      </div>
    </div>
  )

  // --- PROPOSAL SENT ---
  if (step === 'proposal_sent') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md w-full">
        <CompanyLogo />
        <h2 className="text-lg font-bold text-gray-900 mb-1">{docTitle}</h2>
        {docNumber && <p className="text-sm text-gray-500 mb-4">Nr: {docNumber}</p>}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-amber-800 mb-1">Propozycja zmian wyslana</p>
          <p className="text-sm text-amber-700">Oczekuj na odpowiedz od wystawcy dokumentu.</p>
        </div>

        {proposal?.status === 'approved' && (
          <div className="mb-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-green-800 font-medium">Zmiany zostaly zaakceptowane. Mozesz podpisac dokument.</p>
            </div>
            <input
              type="text"
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              placeholder="Imie i nazwisko"
              className="w-full border rounded-xl px-4 py-3 text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button
              onClick={handleSign}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Podpisywanie...' : 'Podpisz dokument'}
            </button>
          </div>
        )}

        {proposal?.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-800 font-medium">Zmiany zostaly odrzucone.</p>
            {proposal?.review_notes && <p className="text-sm text-red-700 mt-1">Powod: {proposal.review_notes}</p>}
          </div>
        )}

        {(!proposal?.status || proposal?.status === 'pending') && (
          <p className="text-sm text-gray-500">Status: Oczekuje na recenzje...</p>
        )}

        {proposal?.diff_summary && (
          <div className="mt-4 bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-600 mb-1">Opis zmian:</p>
            <p className="text-xs text-gray-500">{proposal.diff_summary}</p>
          </div>
        )}
      </div>
    </div>
  )

  // --- PHONE / OTP / DOCUMENT / EDITING ---
  if (step === 'phone' || step === 'otp') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md">
        <div className="px-6 pt-6 pb-4 border-b">
          <CompanyLogo />
          <p className="text-sm text-gray-500 mb-4">
            {signerDisplay ? `Dzien dobry, ${signerDisplay}! ` : ''}Przeslano Ci dokument do podpisu.
          </p>
          <StepIndicator />
        </div>
        <div className="p-6">
          {step === 'phone' && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Weryfikacja tozsamosci</h2>
              <p className="text-sm text-gray-500 mb-4">Podaj numer telefonu, aby otrzymac kod SMS.</p>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+48 600 000 000"
                className="w-full border rounded-xl px-4 py-3 text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                onKeyDown={e => e.key === 'Enter' && sendOtp()}
              />
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <button
                onClick={sendOtp}
                disabled={loading || !phone.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Wysyłanie...' : 'Wyślij kod SMS'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Wprowadz kod</h2>
              <p className="text-sm text-gray-500 mb-4">Wysłaliśmy 6-cyfrowy kod na <strong>{phone}</strong>.</p>
              <input
                type="text"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full border rounded-xl px-4 py-3 text-2xl text-center font-mono tracking-widest mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                onKeyDown={e => e.key === 'Enter' && otpCode.length === 6 && verifyOtp()}
              />
              {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
              <button
                onClick={verifyOtp}
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 mb-2"
              >
                {loading ? 'Weryfikacja...' : 'Weryfikuj'}
              </button>
              <button
                onClick={() => { setStep('phone'); setOtpCode(''); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-gray-600"
              >
                Zmień numer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )

  // --- DOCUMENT VIEW + EDITING ---
  if (step === 'document' || step === 'editing') return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <CompanyLogo />

        {/* Document header */}
        <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{docTitle}</h2>
              {docNumber && <p className="text-sm text-gray-500">Nr: {docNumber}</p>}
              {signerDisplay && <p className="text-xs text-gray-500 mt-1">Podpisujący: {signerDisplay}</p>}
            </div>
            {step === 'document' && (
              <button
                onClick={enterEditingMode}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Zaproponuj zmiany
              </button>
            )}
          </div>
        </div>

        {/* Editing mode banner */}
        {step === 'editing' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <p className="text-sm text-amber-800">Tryb edycji — wprowadz proponowane zmiany w tekscie ponizej</p>
            <button
              onClick={cancelEditing}
              className="text-xs text-amber-700 hover:text-amber-900 underline ml-3 whitespace-nowrap"
            >
              Anuluj
            </button>
          </div>
        )}

        {/* Document content */}
        {step === 'document' && (
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border">
            {renderedContent ? (
              <div
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed max-h-[60vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            ) : docContent ? (
              <div
                className="prose prose-sm max-w-none text-gray-700 leading-relaxed max-h-[60vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: docContent }}
              />
            ) : (
              <div className="text-gray-400 text-center py-8">Ładowanie treści...</div>
            )}
          </div>
        )}

        {/* TipTap editor */}
        {step === 'editing' && editor && (
          <>
            <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border">
              <div className="prose prose-sm max-w-none min-h-[300px] max-h-[60vh] overflow-y-auto [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[280px]">
                <EditorContent editor={editor} />
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm border">
              <label className="block text-sm font-medium text-gray-700 mb-2">Opisz proponowane zmiany</label>
              <textarea
                value={diffSummary}
                onChange={e => setDiffSummary(e.target.value)}
                placeholder="Np. Zmieniono termin realizacji z 30 na 45 dni..."
                rows={3}
                className="w-full border rounded-xl px-4 py-3 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={submitProposal}
                  disabled={loading}
                  className="flex-1 bg-amber-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Wysyłanie...' : 'Wyślij propozycję zmian'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-4 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </>
        )}

        {/* Sign section (only in document view mode) */}
        {step === 'document' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex items-center gap-3 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <h3 className="font-medium text-gray-800">Podpisz dokument</h3>
            </div>

            {/* Signing method tabs — only show allowed methods */}
            {allowedMethods.length > 1 && (
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
              {([
                { key: 'type' as const, label: 'Wpisz' },
                { key: 'draw' as const, label: 'Narysuj' },
                { key: 'upload' as const, label: 'Wgraj' },
                { key: 'pz' as const, label: 'Profil Zaufany' },
              ]).filter(m => allowedMethods.includes(m.key)).map(m => (
                <button
                  key={m.key}
                  onClick={() => { setSigningMethod(m.key); setError(''); setPzError('') }}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    signingMethod === m.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            )}

            {/* Type: text input */}
            {signingMethod === 'type' && (
              <input
                type="text"
                value={signatureName}
                onChange={e => setSignatureName(e.target.value)}
                placeholder="Imie i nazwisko (podpis)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            )}

            {/* Draw: canvas */}
            {signingMethod === 'draw' && (
              <div className="mb-3">
                <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full cursor-crosshair"
                    style={{ height: 160, touchAction: 'none' }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  {!drawSignatureData && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-gray-300 text-sm">Narysuj podpis tutaj</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={clearCanvas}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Wyczyść
                </button>
              </div>
            )}

            {/* Profil Zaufany */}
            {signingMethod === 'pz' && (
              <div className="mb-3">
                <div className="border border-blue-100 bg-blue-50 rounded-xl p-5 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-blue-700">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-blue-800 text-sm">Profil Zaufany</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Zostaniesz przekierowany na stronę Profil Zaufany (pz.gov.pl) w celu potwierdzenia tożsamości i podpisania dokumentu.
                  </p>
                  <p className="text-xs text-blue-500">
                    Bezpieczna autoryzacja przez państwowy serwis ePUAP / mObywatel
                  </p>
                  {pzError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-left">
                      <p className="text-xs text-red-700">{pzError}</p>
                    </div>
                  )}
                  <button
                    onClick={handlePZSign}
                    disabled={pzLoading}
                    className="w-full bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {pzLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Inicjalizacja...
                      </>
                    ) : (
                      <>
                        Przejdź do Profil Zaufany
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Upload: file input */}
            {signingMethod === 'upload' && (
              <div className="mb-3">
                <label className="block w-full border border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploadSignatureData ? (
                    <div>
                      <img src={uploadSignatureData} alt="Podpis" className="max-h-20 mx-auto mb-2" />
                      <span className="text-xs text-gray-400">Kliknij, aby zmienic</span>
                    </div>
                  ) : (
                    <div>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-300 mx-auto mb-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                      <span className="text-sm text-gray-500">Wgraj obraz podpisu</span>
                      <span className="block text-xs text-gray-400 mt-1">PNG, JPG lub SVG (max 5MB)</span>
                    </div>
                  )}
                </label>
              </div>
            )}

            {signingMethod !== 'pz' && (
              <>
                <p className="text-xs text-gray-500 mb-4">
                  Klikajac "Podpisz dokument", potwierdzasz zapoznanie sie z trescia i wyrazasz zgode na podpisanie elektroniczne.
                </p>
                {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={handleSign}
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Podpisywanie...' : 'Podpisz dokument'}
                  </button>
                  <button className="px-4 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                    Odrzuc
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return null
}

export default SignPage
