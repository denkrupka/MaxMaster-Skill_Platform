import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { supabase } from '../../lib/supabase'

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
  const [aiPrompt, setAiPrompt] = useState('')
  const [showParties, setShowParties] = useState(false)
  const [parties, setParties] = useState<{party1: any, party2: any}>({ party1: {}, party2: {} })
  const [showVersions, setShowVersions] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [diffHtml, setDiffHtml] = useState('')
  const [versions, setVersions] = useState<any[]>([])
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [docContent, setDocContent] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const commentBoxRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    if (id) { loadDocument(); loadComments() }
  }, [id])

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: '',
    editable: mode === 'edit',
    editorProps: { attributes: { class: 'prose prose-lg max-w-none focus:outline-none p-8 min-h-[500px]' } },
  })

  useEffect(() => {
    if (editor) editor.setEditable(mode === 'edit')
  }, [mode, editor])

  // Set content when editor becomes ready (it initializes async)
  useEffect(() => {
    if (editor && docContent && !editor.getHTML().replace(/<[^>]*>/g, '').trim()) {
      editor.commands.setContent(docContent)
    }
  }, [editor, docContent])

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
      alert('Link skopiowany do schowka!')
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
      if (raw) setDocContent(raw)
      if (editor && raw) editor.commands.setContent(raw)
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
    const { data } = await supabase.functions.invoke('analyze-document', { body: { document_id: id, analysis_type: type } })
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/construction/dms')} className="text-gray-500 hover:text-gray-800 p-2 rounded text-sm">← Powrót</button>
          <div className="w-px h-5 bg-gray-200" />
          <h1 className="text-sm font-semibold text-gray-900 truncate max-w-sm">{docTitle}</h1>
          {doc?.status && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${doc.status === 'completed' ? 'bg-green-100 text-green-700' : doc.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{doc.status}</span>}
          <div className="flex-1" />

          {/* Mode buttons */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setMode('preview')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'preview' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Podgląd</button>
            <button onClick={() => setMode('edit')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'edit' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Edytuj</button>
          </div>

          {/* Action buttons */}
          <button onClick={() => setShowComments(v => !v)} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${showComments ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'hover:bg-gray-50'}`}>
            Komentarze {activeComments.length > 0 && <span className="bg-yellow-400 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">{activeComments.length}</span>}
          </button>

          <button onClick={() => setShowParties(v => !v)} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${showParties ? 'bg-blue-50 border-blue-300 text-blue-700' : 'hover:bg-gray-50'}`}>
            Dane stron
          </button>
          <button onClick={() => { setShowVersions(v => !v); if (!showVersions) loadVersions() }} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${showVersions ? 'bg-purple-50 border-purple-300 text-purple-700' : 'hover:bg-gray-50'}`}>
            Historia wersji
          </button>

          {/* AI generate contract */}
          <button onClick={generateContractAI} disabled={aiLoading} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            Generuj AI
          </button>

          {/* AI dropdown */}
          <div className="relative">
            <button onClick={() => setShowAI(v => !v)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 flex items-center gap-1">
              AI <span className="text-[10px]">▾</span>
            </button>
            {showAI && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-xl shadow-lg z-30 w-56 py-1">
                <button onClick={() => handleAI('overview')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Analizuj dokument</button>
                <button onClick={() => handleAI('risk')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Wykryj krytyczne ryzyka</button>
                <button onClick={() => handleAI('clauses')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Kluczowe klauzule</button>
                <button onClick={() => handleAI('summary')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Streszczenie</button>
                <div className="border-t my-1" />
                <button onClick={() => { setShowAI(false); navigate(`/construction/dms/${id}/sign`) }} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium">Wyślij do podpisu →</button>
              </div>
            )}
          </div>

          <button onClick={handlePrintPDF} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            ↓ PDF
          </button>
          <button onClick={generatePortalLink} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 1 1.242 7.244" />
            </svg>
            Portal
          </button>
          <button onClick={() => navigate(`/construction/dms/${id}/certificate`)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 text-gray-700">Certyfikat</button>
          {doc?.status === 'client_signed' && (
            <button onClick={async () => {
              await supabase.functions.invoke('process-signature', { body: { document_id: id, signed_by: 'owner', notify_all: true } })
              loadDocument()
            }} className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium animate-pulse">
              Podpisz jako właściciel
            </button>
          )}
          <button onClick={() => navigate(`/construction/dms/${id}/sign`)} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Wyślij do podpisu
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
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded text-xs font-bold ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded text-xs italic ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>I</button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded text-xs underline ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>U</button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading',{level:1}) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>H1</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading',{level:2}) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>H2</button>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded text-xs ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>• Lista</button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`px-2 py-1 rounded text-xs ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'}`}>1. Lista</button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200">L</button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200">C</button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200">R</button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <input type="color" onChange={e => editor.chain().focus().setColor(e.target.value).run()} className="w-6 h-6 rounded cursor-pointer border-0" title="Kolor tekstu" />
            <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} className="px-2 py-1 rounded text-xs hover:bg-gray-200" style={{background:'#fef08a80'}}>Zaznacz</button>
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

          {/* Comment box */}
          {showCommentBox && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              {selectedText && <p className="text-xs text-gray-500 mb-2 italic">Do: &quot;<span className="font-medium">{selectedText.slice(0,80)}</span>&quot;</p>}
              <textarea ref={commentBoxRef} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Napisz komentarz..." rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 mt-2">
                <button onClick={handleAddComment} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Dodaj</button>
                <button onClick={() => { setShowCommentBox(false); setNewComment(''); setSelectedText('') }} className="px-3 py-1.5 rounded-lg text-xs border hover:bg-gray-50">Anuluj</button>
              </div>
            </div>
          )}

          {/* Document content */}
          <div className="bg-white rounded-xl shadow-sm border">
            <EditorContent editor={editor} />
          </div>
          {mode === 'edit' && <p className="text-xs text-gray-400 mt-2 text-center">Autosave co 30s</p>}
        </div>

        {/* Comments sidebar */}
        {showComments && (
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm sticky top-32">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Komentarze ({activeComments.length})</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setShowCommentBox(true); setSelectedText(''); setTimeout(() => commentBoxRef.current?.focus(), 100) }} className="text-xs text-blue-600">+ Dodaj</button>
                  <button onClick={() => setShowComments(false)} className="text-xs text-gray-400">×</button>
                </div>
              </div>
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
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm sticky top-32">
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

        {/* Historia wersji sidebar */}
        {showVersions && (
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border shadow-sm sticky top-32">
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
                        <button onClick={() => { if(editor) editor.commands.setContent(v.content); setShowVersions(false) }} className="text-xs text-blue-600 hover:underline">Przywróć</button>
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

  const lookupGUS = async (nip: string) => {
    if (nip.replace(/[\s-]/g,'').length !== 10) return
    setNipLoading(true)
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
    } catch { /* GUS API może być niedostępne */ }
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
          {k:'address',l:'Adres',ph:'ul. Przykładowa 1, 00-000 Warszawa'},
          {k:'phone',l:'Telefon',ph:'+48 600 000 000'},
          {k:'email',l:'E-mail',ph:'biuro@firma.pl'},
        ].map(({k,l,ph}) => (
          <div key={k}>
            <label className="text-xs text-gray-500 mb-0.5 block">{l}</label>
            <input value={form[k as keyof PartyData]||''} onChange={e => upd(k as keyof PartyData, e.target.value)}
              placeholder={ph} className="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" />
          </div>
        ))}
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
  { key: 'draft', label: 'Szkic', icon: '' },
  { key: 'sent', label: 'Wysłano', icon: '📤' },
  { key: 'viewed', label: 'Odczytano', icon: '👁' },
  { key: 'client_signed', label: 'Podpisano', icon: '✍' },
  { key: 'completed', label: 'Zakończono', icon: '' },
]

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
              {i < activeIdx ? '✓' : step.icon}
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
