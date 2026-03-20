import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize || null,
        renderHTML: attributes => {
          if (!attributes.fontSize) return {}
          return { style: `font-size: ${attributes.fontSize}` }
        },
      },
    }
  },
})

import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import { supabase } from '../../lib/supabase'
import VariablesPanel from '../../components/documents/VariablesPanel'

type Mode = 'preview' | 'edit' | 'sign'

const DocumentViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('preview')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [user, setUser] = useState<any>(null)
  const [showAI, setShowAI] = useState(false)
  const [aiMenuPos, setAiMenuPos] = useState({ top: 0, left: 0 })
  const [aiPrompt, setAiPrompt] = useState('')
  const [showParties, setShowParties] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [parties, setParties] = useState<{party1: any, party2: any}>({ party1: {}, party2: {} })
  const [showVersions, setShowVersions] = useState(false)
  const [variablesVersion, setVariablesVersion] = useState(0)
  const [portalLinkModal, setPortalLinkModal] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [diffHtml, setDiffHtml] = useState('')
  const [versions, setVersions] = useState<any[]>([])
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [docContent, setDocContent] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [downloadMenuPos, setDownloadMenuPos] = useState({ top: 0, left: 0 })
  const [showGenerujModal, setShowGenerujModal] = useState(false)
  const [generujPrompt, setGenerujPrompt] = useState('')
  const [generujLoading, setGenerujLoading] = useState(false)
  const commentBoxRef = useRef<HTMLTextAreaElement>(null)


  // Convert sections JSON to HTML if needed
  const convertContentToHtml = (raw: string): string => {
    if (!raw) return '<p></p>'
    try {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.sections && Array.isArray(parsed.sections)) {
        return parsed.sections.map((s: any) => 
          `<h2>${s.title || ''}</h2><p>${(s.content || s.body || '').replace(/\n/g, '</p><p>')}</p>`
        ).join('\n')
      }
      if (Array.isArray(parsed)) {
        return parsed.map((s: any) => 
          `<h2>${s.title || ''}</h2><p>${(s.content || s.body || '').replace(/\n/g, '</p><p>')}</p>`
        ).join('\n')
      }
    } catch {
      // Not JSON, return as-is
    }
    return raw
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    if (id) { loadDocument(); loadComments() }
  }, [id])

  const editor = useEditor({
    extensions: [StarterKit, Underline, FontSize, Color, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] }), FontFamily.configure({ types: ['textStyle'] })],
    content: '',
    editable: mode === 'edit',
    editorProps: { attributes: { class: 'prose prose-lg max-w-none focus:outline-none p-8 min-h-[500px]' } },
  })

  // Replace {{variable}} with stored values for preview, or highlight unfilled
  const renderPreviewContent = useCallback((html: string): string => {
    if (!html) return ''
    const storedVars: Record<string, string> = JSON.parse(localStorage.getItem('doc_variables') || '{}')
    return html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = storedVars[key.trim()]
      if (value && value.trim()) {
        return `<span style="color:inherit;font-weight:inherit;text-decoration:underline;text-decoration-color:#3b82f6">${value}</span>`
      }
      return `<span style="background:#fee2e2;color:#dc2626;border-radius:3px;padding:1px 4px;font-size:0.875em" title="Zmienna niezapełniona: ${key}">${match}</span>`
    })
  }, [])

  useEffect(() => {
    if (editor) editor.setEditable(mode === 'edit')
  }, [mode, editor])

  // Set content when editor becomes ready or mode/variables change
  useEffect(() => {
    if (editor && docContent) {
      const isEmpty = !editor.getHTML().replace(/<[^>]*>/g, '').trim()
      if (isEmpty || mode === 'preview') {
        const content = mode === 'preview' ? renderPreviewContent(docContent) : docContent
        editor.commands.setContent(content)
      }
    }
  }, [editor, docContent, mode, renderPreviewContent, variablesVersion])

  const closeAllPanels = () => {
    setShowComments(false)
    setShowParties(false)
    setShowVariables(false)
    setShowVersions(false)
  }

  const loadVersions = async () => {
    const { data } = await supabase.from('document_versions').select('*').eq('document_id', id!).order('version_number', { ascending: false }).limit(20)
    setVersions(data || [])
  }
  const showVersionDiff = (v: any) => {
    const prev = (v.content || '').replace(/<[^>]*>/g, '')
    const curr = (editor?.getHTML() || '').replace(/<[^>]*>/g, '')
    const prevLines = prev.split('\n').filter((l: string) => l.trim())
    const currLines = curr.split('\n').filter((l: string) => l.trim())
    const removed = prevLines.filter((l: string) => !currLines.includes(l))
    const added = currLines.filter((l: string) => !prevLines.includes(l))
    const html = [
      ...removed.map((l: string) => `<div style="background:#fee2e2;padding:2px 6px;margin:2px 0;border-radius:4px;border-left:3px solid #ef4444">- ${l}</div>`),
      ...added.map((l: string) => `<div style="background:#d1fae5;padding:2px 6px;margin:2px 0;border-radius:4px;border-left:3px solid #10b981">+ ${l}</div>`)
    ].join('')
    setDiffHtml(html || '<p class="text-gray-400 text-center py-4">Brak różnic</p>')
    setShowDiff(true)
  }


  const generateContractAI = async () => {
    if (!doc) return
    const confirmed = window.confirm('AI wygeneruje treść umowy na podstawie danych dokumentu. Zastąpi obecną treść. Kontynuować?')
    if (!confirmed) return
    setAiLoading(true)
    const { data } = await supabase.functions.invoke('analyze-document', {
      body: {
        document_id: doc.id,
        action: 'generate_contract',
        context: {
          title: doc.name,
          parties: doc.parties,
          project_id: doc.project_id,
          type: doc.document_type || 'umowa'
        }
      }
    })
    if (data?.result) {
      editor?.commands.setContent(data.result)
    }
    setAiLoading(false)
  }

  const generatePortalLink = async () => {
    const { data } = await supabase.from('client_portal_tokens').insert({
      project_id: doc?.project_id,
      company_id: doc?.company_id,
      label: doc?.name,
      active: true
    }).select('token').single()
    if (data?.token) {
      const link = `${window.location.origin}${window.location.pathname.split('#')[0]}#/portal/${data.token}`
      await navigator.clipboard.writeText(link)
      setPortalLinkModal(link)
    }
  }

  const loadDocument = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase.from('documents').select('*, document_templates(name, type, content), contractors(name), projects(name)').eq('id', id!).single()
      if (error) { setLoadError(error.message); setLoading(false); return }
      if (!data) { setLoadError('Dokument nie został znaleziony'); setLoading(false); return }
      setDoc(data)
      if (data?.parties) setParties(data.parties)
      let raw = ''
      if (data.content) raw = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
      else if (data.document_templates?.content) {
        const secs = Array.isArray(data.document_templates.content)
          ? data.document_templates.content.map((s: any) => `<h2>${s.title || ''}</h2><p>${s.body || ''}</p>`).join('\n')
          : String(data.document_templates.content)
        raw = secs
      }
      if (raw) setDocContent(convertContentToHtml(raw))
      if (editor && raw) editor.commands.setContent(convertContentToHtml(raw))
    } catch (err: any) {
      setLoadError(err?.message || 'Błąd ładowania dokumentu')
    }
    setLoading(false)
  }

  const saveParties = async (newParties?: typeof parties) => {
    const toSave = newParties || parties
    await supabase.from('documents').update({ parties: toSave }).eq('id', id!)
  }

  const loadComments = async () => {
    const { data } = await supabase.from('document_comments').select('*').eq('document_id', id!).order('created_at', { ascending: true })
    if (data) {
      const top = data.filter(c => !c.parent_id)
      setComments(top.map(c => ({ ...c, replies: data.filter(r => r.parent_id === c.id) })))
    }
  }

  const handleSave = useCallback(async () => {
    if (!editor || !id) return
    setSaving(true)
    const html = editor.getHTML()
    await supabase.from('documents').update({ content: html, updated_at: new Date().toISOString() }).eq('id', id)

    // Save version snapshot for history
    await supabase.functions.invoke('log-document-event', {
      body: {
        document_id: id,
        action: 'content_saved',
        actor_email: user?.email,
        content_snapshot: html,
        snapshot_reason: 'autosave',
      }
    }).catch(() => {})

    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }, [editor, id, user])

  useEffect(() => {
    if (mode === 'edit') { const t = setInterval(handleSave, 30000); return () => clearInterval(t) }
  }, [mode, handleSave])

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return
    const { data } = await supabase.from('document_comments').insert({
      document_id: id, author_id: user?.id || 'anon', author_name: user?.email || 'Użytkownik',
      content: newComment.trim(), field_key: selectedText ? `selection:${selectedText.slice(0, 80)}` : null,
    }).select().single()
    if (data) {
      setComments(prev => [...prev, { ...data, replies: [] }])
      setNewComment(''); setShowCommentBox(false); setSelectedText('')
      if (selectedText && editor) editor.commands.setHighlight({ color: '#fef08a' })
    }
  }

  const handleReply = async (parentId: string) => {
    if (!replyText.trim() || !id) return
    const { data } = await supabase.from('document_comments').insert({
      document_id: id, author_id: user?.id || 'anon', author_name: user?.email || 'Użytkownik',
      content: replyText.trim(), parent_id: parentId,
    }).select().single()
    if (data) {
      setComments(prev => prev.map(c => c.id === parentId ? { ...c, replies: [...(c.replies || []), data] } : c))
      setReplyText(''); setActiveCommentId(null)
    }
  }

  const handlePrintPDF = () => {
    const style = document.createElement('style')
    style.id = 'print-dms-style'
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #dms-print-area { display: block !important; }
        #dms-print-area { position: fixed; top: 0; left: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `
    document.head.appendChild(style)

    const printArea = document.createElement('div')
    printArea.id = 'dms-print-area'
    printArea.style.display = 'none'
    printArea.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <h1 style="font-size: 20px; margin-bottom: 8px;">${doc?.name || 'Dokument'}</h1>
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 24px;">Data: ${new Date(doc?.created_at || '').toLocaleDateString('pl-PL')} | Autor: ${doc?.author_name || ''}</p>
        <hr style="margin-bottom: 24px;" />
        <div style="font-size: 13px; line-height: 1.6;">
          ${doc?.content || '<p style="color:#999">Treść dokumentu niedostępna</p>'}
        </div>
        <hr style="margin-top: 40px; margin-bottom: 16px;" />
        <p style="font-size: 11px; color: #6b7280; text-align: center;">Wygenerowano przez MaxMaster | ${window.location.href}</p>
      </div>
    `
    document.body.appendChild(printArea)

    window.print()

    setTimeout(() => {
      document.head.removeChild(style)
      document.body.removeChild(printArea)
    }, 500)
  }

  const handleAI = async (type: string) => {
    setAiLoading(true); setShowAI(true); setAiResult('')
    const content = (editor?.getText() || editor?.getHTML() || doc?.content || '').slice(0, 8000)
    const { data } = await supabase.functions.invoke('analyze-document', {
      body: {
        document_id: id,
        analysis_type: type,
        content,
        context: {
          title: doc?.name,
          type: doc?.document_type,
          parties: doc?.parties
        }
      }
    })
    setAiResult(data?.result || 'Błąd analizy'); setAiLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  if (loadError || !doc) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-red-500 text-lg mb-4">{loadError || 'Dokument nie został znaleziony'}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Wróć</button>
      </div>
    </div>
  )

  const docTitle = doc?.name || doc?.document_templates?.name || 'Dokument'
  const activeComments = comments.filter(c => !c.resolved)

  const handleDownloadPDF = async () => {
    if (!doc) return
    const content = editor?.getHTML() || doc.content || ''
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6}h1,h2,h3{color:#111}</style></head><body>${content}</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: (doc.name || 'dokument') + '.html' })
    a.click(); URL.revokeObjectURL(url)
  }

  const handleDownloadDOC = () => {
    if (!doc) return
    const content = editor?.getHTML() || doc.content || ''
    const blob = new Blob(["<html xmlns:o='urn:schemas-microsoft-com:office:office'><body>" + content + '</body></html>'], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: (doc.name || 'dokument') + '.doc' })
    a.click(); URL.revokeObjectURL(url)
  }

  const handleGenerujAI = async () => {
    if (!generujPrompt.trim()) return
    setGenerujLoading(true)
    try {
      const res = await fetch('https://diytvuczpciikzdhldny.supabase.co/functions/v1/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: generujPrompt, action: 'generate' })
      })
      const data = await res.json()
      if (data.result && editor) {
        editor.commands.setContent('<p>' + data.result.replace(/\n/g, '</p><p>') + '</p>')
        setShowGenerujModal(false)
        setGenerujPrompt('')
      }
    } catch (e) {
      console.error('Generuj AI error', e)
    }
    setGenerujLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap overflow-x-auto">
          <button onClick={() => navigate('/construction/dms')} className="text-gray-500 hover:text-gray-800 p-2 rounded text-sm">← Powrót</button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="text-sm font-semibold text-gray-900 truncate max-w-sm">{docTitle}</h1>
          {doc?.status && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${doc.status === 'completed' ? 'bg-green-100 text-green-700' : doc.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{doc.status}</span>}
          <div className="flex-1" />

          {/* Mode buttons */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setMode('preview')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'preview' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Podgląd</button>
            <button onClick={() => setMode('edit')} disabled={doc?.status === 'client_signed' || doc?.status === 'completed' || doc?.status === 'sent'} className={`px-3 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'edit' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Edytuj</button>
          </div>

          {/* Action buttons */}
          <button onClick={() => { closeAllPanels(); setShowComments(v => !v) }} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${showComments ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'hover:bg-gray-50'}`}>
            Komentarze {activeComments.length > 0 && <span className="bg-yellow-400 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">{activeComments.length}</span>}
          </button>

          <button onClick={() => { closeAllPanels(); setShowParties(v => !v) }} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${showParties ? 'bg-blue-50 border-blue-300 text-blue-700' : 'hover:bg-gray-50'}`}>
            Dane stron
          </button>
          <button onClick={() => { closeAllPanels(); setShowVariables(v => !v) }} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${showVariables ? 'bg-green-50 border-green-300 text-green-700' : 'hover:bg-gray-50'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
            Zmienne
          </button>
          <button onClick={() => { closeAllPanels(); setShowVersions(v => !v); if (!showVersions) loadVersions() }} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${showVersions ? 'bg-purple-50 border-purple-300 text-purple-700' : 'hover:bg-gray-50'}`}>
            Historia wersji
          </button>

          {/* AI generate contract */}
          <button onClick={() => setShowGenerujModal(true)} disabled={aiLoading} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            Generuj AI
          </button>

          {/* AI dropdown */}
          <div className="relative">
            <button onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setAiMenuPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 230) })
              setShowAI(v => !v)
            }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347-.347.347a3.5 3.5 0 01-4.95 0l-.347-.347-.347-.347z" /></svg>
              AI
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showAI && (
              <div className="fixed bg-white border rounded-xl shadow-2xl z-[9999] w-56 py-1" style={{ top: aiMenuPos.top, left: aiMenuPos.left }}>
                <button onClick={() => { setShowAI(false); setShowGenerujModal(true) }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-purple-700">Generuj dokument</button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => handleAI('overview')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Analizuj dokument</button>
                <button onClick={() => handleAI('risk')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Wykryj krytyczne ryzyka</button>
                <button onClick={() => handleAI('clauses')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Kluczowe klauzule</button>
                <button onClick={() => handleAI('summary')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Streszczenie</button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                setDownloadMenuPos({ top: rect.bottom + 4, left: rect.left })
                setShowDownloadMenu(!showDownloadMenu)
              }}
              className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
            >
              Pobierz
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <button onClick={generatePortalLink} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 1 1.242 7.244" />
            </svg>
            Odnośnik
          </button>
          <button onClick={() => navigate(`/construction/dms/${id}/certificate`)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 text-gray-700">Certyfikat podpisu</button>
          {doc?.status === 'client_signed' && (
            <button onClick={async () => {
              await supabase.functions.invoke('process-signature', { body: { document_id: id, signed_by: 'owner', notify_all: true } })
              loadDocument()
            }} className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium animate-pulse">
              Podpisz jako właściciel
            </button>
          )}
          <button onClick={() => navigate(`/construction/dms/${id}/sign`)} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Podpis
          </button>

          {mode === 'edit' && (
            <button onClick={handleSave} disabled={saving} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${saved ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'} disabled:opacity-50`}>
              {saving ? '...' : saved ? 'Zapisano!' : 'Zapisz'}
            </button>
          )}
        </div>

        {/* Edit toolbar (only in edit mode) */}
        {mode === 'edit' && editor && (
          <div className="border-t bg-gray-50 px-4 py-1.5 flex items-center gap-1 flex-wrap">
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded text-xs font-bold ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>B</button>
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded text-xs italic ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>I</button>
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded text-xs underline ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>U</button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading',{level:1}) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>H1</button>
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading',{level:2}) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>H2</button>
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded text-xs ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>• Lista</button>
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`px-2 py-1 rounded text-xs ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>1. Lista</button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('left').run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('center').run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('right').run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
              <div className="w-px h-4 bg-gray-300 mx-1" />
              {/* Font Family */}
              <select
                className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none bg-white"
                value={editor.getAttributes('textStyle').fontFamily || ''}
                onChange={e => {
                  if (e.target.value) {
                    editor.chain().focus().setFontFamily(e.target.value).run()
                  } else {
                    editor.chain().focus().unsetFontFamily().run()
                  }
                }}
                onPointerDown={e => e.stopPropagation()}
              >
                <option value="">Czcionka</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Verdana, sans-serif">Verdana</option>
              </select>
              {/* Font Size */}
              <select
                className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none bg-white w-16"
                value={editor.getAttributes('textStyle').fontSize?.replace('px', '') || ''}
                onChange={e => {
                  if (e.target.value) {
                    editor.chain().focus().setMark('textStyle', { fontSize: e.target.value + 'px' }).run()
                  } else {
                    editor.chain().focus().setMark('textStyle', { fontSize: null }).run()
                  }
                }}
                onPointerDown={e => e.stopPropagation()}
                title="Rozmiar czcionki"
              >
                <option value="">Rozmiar</option>
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
                <option value="14">14</option>
                <option value="16">16</option>
                <option value="18">18</option>
                <option value="20">20</option>
                <option value="24">24</option>
                <option value="28">28</option>
                <option value="32">32</option>
                <option value="36">36</option>
                <option value="48">48</option>
              </select>
              {/* Paragraph */}
              <button
                onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}
                onClick={() => editor.chain().focus().insertContent('§ ').run()}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${false ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Wstaw § (paragraf)"
              >
                ¶
              </button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <input type="color" onChange={e => editor.chain().focus().setColor(e.target.value).run()} className="w-6 h-6 rounded cursor-pointer border-0" title="Kolor tekstu" />
            <button onPointerDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200" style={{background:'#fef08a80'}}>Zaznacz</button>
          </div>
        )}
      </div>



      {/* Document Status Timeline */}
      <div className="max-w-screen-xl mx-auto w-full px-4 pt-4">
        <DocumentTimeline status={doc?.status} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex max-w-screen-xl mx-auto w-full px-4 py-6 gap-6">
        {/* Document area */}
        <div className="flex-1">
          {/* AI result panel */}
          {showAI && aiResult && (
            <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-purple-800">Analiza AI</h4>
                <button onClick={() => { setShowAI(false); setAiResult('') }} className="text-xs text-gray-400 hover:text-gray-600">×</button>
              </div>
              {aiLoading ? <div className="text-sm text-gray-500">Analizuję...</div> : <div className="text-sm text-gray-700 whitespace-pre-wrap">{aiResult}</div>}
            </div>
          )}

          {/* Document content */}
          <div className="bg-white rounded-xl shadow-sm border">
            <EditorContent editor={editor} />
          </div>
          {mode === 'edit' && <p className="text-xs text-gray-400 mt-2 text-center">Autosave co 30s</p>}
        </div>

        {/* Comments sidebar */}
      {/* Mobile backdrop */}
      {(showVariables || showComments || showParties || showVersions) && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => closeAllPanels()} />
      )}
        {showComments && (
          <div className="fixed right-0 top-0 h-full w-72 max-w-[90vw] z-50 shadow-xl md:relative md:shadow-none md:h-auto flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm h-full md:h-auto md:sticky md:top-32">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Komentarze ({activeComments.length})</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setShowCommentBox(true); setSelectedText(''); setTimeout(() => commentBoxRef.current?.focus(), 100) }} className="text-xs text-blue-600">+ Dodaj</button>
                  <button onClick={() => setShowComments(false)} className="text-xs text-gray-400">×</button>
                </div>
              </div>
              {/* Comment form inside panel */}
              {showCommentBox && (
                <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
                  {selectedText && <p className="text-xs text-gray-500 mb-2 italic">Do: &quot;<span className="font-medium">{selectedText.slice(0,80)}</span>&quot;</p>}
                  <textarea ref={commentBoxRef} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Napisz komentarz..." rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleAddComment} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Dodaj</button>
                    <button onClick={() => { setShowCommentBox(false); setNewComment(''); setSelectedText('') }} className="px-3 py-1.5 rounded-lg text-xs border hover:bg-gray-50">Anuluj</button>
                  </div>
                </div>
              )}
              <div className="divide-y max-h-[65vh] overflow-y-auto">
                {activeComments.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">Brak komentarzy</p>}
                {activeComments.map(c => (
                  <div key={c.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => {
                    if (c.field_key?.startsWith('selection:')) {
                      const text = c.field_key.replace('selection:', '')
                      const editorEl = document.querySelector('.ProseMirror')
                      if (editorEl) {
                        const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT)
                        while (walker.nextNode()) {
                          const node = walker.currentNode as Text
                          if (node.textContent?.includes(text.slice(0, 20))) {
                            node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            break
                          }
                        }
                      }
                    }
                  }}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-gray-800">{c.author_name || c.author}</span>
                      <button onClick={e => { e.stopPropagation(); supabase.from('document_comments').update({resolved:true}).eq('id',c.id); setComments(prev => prev.map(x => x.id===c.id?{...x,resolved:true}:x)) }} className="text-xs text-green-600 hover:underline">Rozwiąż</button>
                    </div>
                    {c.field_key?.startsWith('selection:') && <p className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-1 italic truncate">&quot;{c.field_key.replace('selection:','')}&quot;</p>}
                    <p className="text-sm text-gray-700 mb-1">{c.content}</p>
                    {c.replies?.map((r: any) => (
                      <div key={r.id} className="ml-3 bg-gray-50 rounded px-2 py-1 mb-1">
                        <span className="text-xs font-medium text-gray-600">{r.author_name}</span>
                        <p className="text-xs text-gray-600">{r.content}</p>
                      </div>
                    ))}
                    {activeCommentId === c.id ? (
                      <div className="mt-1">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} placeholder="Odpowiedz..." className="w-full border rounded px-2 py-1 text-xs resize-none" />
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => handleReply(c.id)} className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">OK</button>
                          <button onClick={() => setActiveCommentId(null)} className="px-2 py-0.5 rounded text-xs border">×</button>
                        </div>
                      </div>
                    ) : <button onClick={e => { e.stopPropagation(); setActiveCommentId(c.id) }} className="text-xs text-blue-600 hover:underline">Odpowiedz</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Dane stron sidebar */}
        {showParties && (
          <div className="fixed right-0 top-0 h-full w-80 max-w-[90vw] z-50 shadow-xl md:relative md:shadow-none md:h-auto flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm h-full md:h-auto md:sticky md:top-32">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Dane stron</h3>
                <button onClick={() => setShowParties(false)} className="text-xs text-gray-400">×</button>
              </div>
              <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
                <DocumentParty label="Strona 1 (Zamawiający)" value={parties.party1} onChange={v => setParties(p => ({...p, party1: v}))} onSave={() => saveParties({...parties, party1: parties.party1})} />
                <DocumentParty label="Strona 2 (Wykonawca)" value={parties.party2} onChange={v => setParties(p => ({...p, party2: v}))} onSave={() => saveParties({...parties, party2: parties.party2})} />
              </div>
            </div>
          </div>
        )}

        {/* Variables sidebar */}
        {showVariables && (
          <VariablesPanel
            editor={editor}
            content={docContent}
            onClose={() => setShowVariables(false)}
            onVariablesChange={() => setVariablesVersion(v => v + 1)}
          />
        )}

        {/* Historia wersji sidebar */}
        {showVersions && (
          <div className="fixed right-0 top-0 h-full w-72 max-w-[90vw] z-50 shadow-xl md:relative md:shadow-none md:h-auto flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm h-full md:h-auto md:sticky md:top-32">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Historia wersji</h3>
                <button onClick={() => setShowVersions(false)} className="text-xs text-gray-400">×</button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {versions.length === 0 && <p className="text-xs text-gray-400 p-4 text-center">Brak zapisanych wersji</p>}
                {versions.map(v => (
                  <div key={v.id} className="px-4 py-3 border-b hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">v{v.version_number}</span>
                      <span className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString('pl-PL', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <p className="text-xs text-gray-500">{v.snapshot_reason || 'zapisano'}</p>
                    {v.created_by && <p className="text-xs text-gray-400">{v.created_by}</p>}
                    {v.content && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => showVersionDiff(v)} className="text-xs text-purple-600 hover:underline">Diff</button>
                        <button onClick={() => { if(editor) editor.commands.setContent(convertContentToHtml(v.content)); setShowVersions(false) }} className="text-xs text-blue-600 hover:underline">Przywróć</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Version Diff Modal */}
      {showDiff && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Porównanie wersji</h3>
              <button onClick={() => setShowDiff(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="text-xs text-gray-500 mb-3 flex gap-4">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded inline-block"></span> Usunięte</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded inline-block"></span> Dodane</span>
            </div>
            <div className="font-mono text-xs" dangerouslySetInnerHTML={{ __html: diffHtml }} />
          </div>
        </div>
      )}

      {/* Portal Link Modal */}
      {portalLinkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPortalLinkModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Link do portalu klienta</h3>
              <button onClick={() => setPortalLinkModal(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Udostępnij ten link klientowi — może on przeglądać dokument bez logowania.</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="flex-1 text-xs text-gray-700 font-mono truncate">{portalLinkModal}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(portalLinkModal); }}
                className="flex-shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
                Kopiuj
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">Link wygasa po 30 dniach</p>
          </div>
        </div>
      )}

      {/* Download dropdown menu */}
      {showDownloadMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-xl shadow-2xl py-1 min-w-[160px] z-[9999]"
          style={{ top: downloadMenuPos.top, left: downloadMenuPos.left }}
          onMouseLeave={() => setShowDownloadMenu(false)}
        >
          <button
            onClick={() => { setShowDownloadMenu(false); handleDownloadPDF() }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            PDF
          </button>
          <button
            onClick={() => { setShowDownloadMenu(false); handleDownloadDOC() }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Word (DOCX)
          </button>
        </div>
      )}

      {/* Generuj AI modal */}
      {showGenerujModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowGenerujModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-[520px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Generuj dokument z AI</h2>
            <p className="text-sm text-gray-500 mb-4">Opisz czego ma dotyczyć dokument, a AI go napisze</p>
            <textarea
              value={generujPrompt}
              onChange={e => setGenerujPrompt(e.target.value)}
              placeholder="Np: Umowa o roboty budowlane między MaxMaster a wykonawcą XYZ. Prace elektryczne w budynku mieszkalnym. Termin 60 dni, kara 0.5% za dzień zwłoki..."
              className="w-full h-32 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowGenerujModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Anuluj
              </button>
              <button
                onClick={handleGenerujAI}
                disabled={!generujPrompt.trim() || generujLoading}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {generujLoading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generuję...</>
                ) : (
                  <>Generuj</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

interface PartyData {
  name?: string
  address?: string
  nip?: string
  phone?: string
  email?: string
  contact_person?: string
  contact_position?: string
}

const DocumentParty: React.FC<{ label: string; value: PartyData; onChange: (v: PartyData) => void; onSave: () => void }> = ({ label, value, onChange, onSave }) => {
  const [form, setForm] = React.useState<PartyData>(value || {})
  const [nipLoading, setNipLoading] = React.useState(false)
  const [reps, setReps] = React.useState<Array<{name:string;position:string;email:string;phone:string}>>([{ name: form.contact_person||'', position: form.contact_position||'', email: form.email||'', phone: form.phone||'' }])
  const [addressSuggestions, setAddressSuggestions] = React.useState<Array<{display: string; street: string; city: string; postcode: string}>>([])
  const [addressSearchTimeout, setAddressSearchTimeout] = React.useState<ReturnType<typeof setTimeout> | null>(null)

  const searchAddress = async (query: string) => {
    if (query.length < 3) { setAddressSuggestions([]); return }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=pl&limit=5`, {
        headers: { 'Accept-Language': 'pl' }
      })
      const data = await res.json()
      setAddressSuggestions(data.map((item: any) => ({
        display: item.display_name,
        street: item.address?.road ? `${item.address.road} ${item.address?.house_number || ''}`.trim() : '',
        city: item.address?.city || item.address?.town || item.address?.village || '',
        postcode: item.address?.postcode || ''
      })))
    } catch { setAddressSuggestions([]) }
  }

  const handleAddressInput = (value: string) => {
    upd('address', value)
    if (addressSearchTimeout) clearTimeout(addressSearchTimeout)
    setAddressSearchTimeout(setTimeout(() => searchAddress(value), 400))
  }

  const selectAddress = (suggestion: {display: string; street: string; city: string; postcode: string}) => {
    const formatted = suggestion.street
      ? `${suggestion.street}, ${suggestion.postcode} ${suggestion.city}`.trim()
      : suggestion.display.split(',').slice(0, 3).join(',').trim()
    upd('address', formatted)
    setAddressSuggestions([])
  }

  const lookupGUS = async (nip: string) => {
    if (nip.replace(/[\s-]/g,'').length !== 10) return
    setNipLoading(true)
    try {
      const clean = nip.replace(/[\s-]/g,'')
      const today = new Date().toISOString().split('T')[0]
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://wl-api.mf.gov.pl/api/search/nip/${clean}?date=${today}`)}`)
      const raw = await r.json()
      const d = typeof raw.contents === 'string' ? JSON.parse(raw.contents) : raw
      const s = d?.result?.subject
      if (s) {
        setForm(prev => ({
          ...prev,
          name: s.name || prev.name,
          address: s.workingAddress || s.residenceAddress || prev.address,
          nip: clean,
        }))
      }
    } catch {
      // Biała Lista API fallback
      try {
        const clean = nip.replace(/[\s-]/g,'')
        const r = await fetch(`https://api-ost.biznes.gov.pl/api/search/companies/nip/${clean}`)
        const d = await r.json()
        const co = d?.company || d?.result?.[0] || d
        if (co?.name || co?.companyName) {
          setForm(prev => ({
            ...prev,
            name: co.name || co.companyName || prev.name,
            address: co.address?.street ? `${co.address.street} ${co.address.buildingNumber||''}, ${co.address.postalCode||''} ${co.address.city||''}`.trim() : prev.address,
            nip: clean,
          }))
        }
      } catch { /* API niedostępne */ }
    }
    setNipLoading(false)
  }

  const upd = (k: keyof PartyData, v: string) => {
    const newForm = { ...form, [k]: v }
    setForm(newForm)
    onChange(newForm)
  }

  React.useEffect(() => {
    if (value && JSON.stringify(value) !== JSON.stringify(form)) {
      setForm(value)
    }
  }, [value])

  return (
    <div className="border rounded-xl p-3 bg-gray-50">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">{label}</h4>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">NIP</label>
          <div className="flex gap-1">
            <input value={form.nip||''} onChange={e => { upd('nip',e.target.value); if(e.target.value.replace(/[\s-]/g,'').length===10) lookupGUS(e.target.value) }}
              placeholder="000-000-00-00" className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            {nipLoading && <span className="text-xs text-gray-400 self-center">↻</span>}
          </div>
        </div>
        {[
          {k:'name',l:'Nazwa firmy',ph:'ABC Sp. z o.o.'},
          {k:'phone',l:'Telefon',ph:'+48 600 000 000'},
          {k:'email',l:'E-mail',ph:'biuro@firma.pl'},
        ].map(({k,l,ph}) => (
          <div key={k}>
            <label className="text-xs text-gray-500 mb-0.5 block">{l}</label>
            <input value={form[k as keyof PartyData]||''} onChange={e => {
              if (k === 'phone') {
                const v = e.target.value.replace(/[^0-9+\s-]/g, '')
                upd(k as keyof PartyData, v.slice(0, 15))
              } else {
                upd(k as keyof PartyData, e.target.value)
              }
            }}
              placeholder={ph} className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" />
          </div>
        ))}
        <div className="relative">
          <label className="text-xs text-gray-500 mb-0.5 block">Adres</label>
          <input value={form.address||''} onChange={e => handleAddressInput(e.target.value)}
            placeholder="ul. Przykładowa 1, 00-000 Warszawa" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" />
          {addressSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {addressSuggestions.map((s, i) => (
                <button key={i} onClick={() => selectAddress(s)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 border-b last:border-0 truncate">
                  {s.display}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t pt-2 mt-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-600">Przedstawiciele</p>
            <button onClick={() => setReps(p => [...p, {name:'',position:'',email:'',phone:''}])} className="text-xs text-blue-600">+ Dodaj</button>
          </div>
          {reps.map((r,i) => (
            <div key={i} className="bg-white rounded p-2 mb-1 border">
              <div className="grid grid-cols-2 gap-1">
                <input value={r.name} onChange={e => setReps(p => p.map((x,j) => j===i?{...x,name:e.target.value}:x))} placeholder="Imię i nazwisko" className="border rounded px-2 py-1 text-xs col-span-2" />
                <input value={r.position} onChange={e => setReps(p => p.map((x,j) => j===i?{...x,position:e.target.value}:x))} placeholder="Stanowisko" className="border rounded px-2 py-1 text-xs" />
                <input value={r.phone} onChange={e => setReps(p => p.map((x,j) => j===i?{...x,phone:e.target.value}:x))} placeholder="+48 600..." className="border rounded px-2 py-1 text-xs" />
                <input value={r.email} onChange={e => setReps(p => p.map((x,j) => j===i?{...x,email:e.target.value}:x))} placeholder="email@..." className="border rounded px-2 py-1 text-xs col-span-2" />
              </div>
            </div>
          ))}
        </div>
        <button onClick={onSave} className="mt-3 w-full text-xs bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 font-medium">
          Zapisz dane strony
        </button>
      </div>
    </div>
  )
}

const STATUS_STEPS = [
  { key: 'draft', label: 'Szkic' },
  { key: 'sent', label: 'Wysłano' },
  { key: 'viewed', label: 'Odczytano' },
  { key: 'client_signed', label: 'Podpisano' },
  { key: 'completed', label: 'Zakończono' },
]

const STEP_ICONS: Record<string, React.ReactNode> = {
  draft: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>,
  sent: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>,
  viewed: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
  client_signed: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>,
  completed: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
}

const DocumentTimeline: React.FC<{ status?: string }> = ({ status }) => {
  const currentIdx = STATUS_STEPS.findIndex(s => s.key === status)
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="flex items-center gap-0 w-full my-4">
      {STATUS_STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
              i < activeIdx ? 'bg-green-500 border-green-500 text-white' :
              i === activeIdx ? 'bg-blue-600 border-blue-600 text-white' :
              'bg-white border-gray-200 text-gray-400'
            }`}>
              {STEP_ICONS[step.key]}
            </div>
            <span className={`text-xs mt-1 font-medium ${i === activeIdx ? 'text-blue-600' : i < activeIdx ? 'text-green-600' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mb-4 ${i < activeIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}

    </div>
  )
}

export default DocumentViewPage
