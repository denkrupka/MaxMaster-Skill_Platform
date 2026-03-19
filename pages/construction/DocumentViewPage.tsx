import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/extension-bubble-menu'
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
  const [showParties, setShowParties] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
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

  const loadDocument = async () => {
    setLoading(true)
    const { data } = await supabase.from('documents').select('*, document_templates(name, type, content), contractors(name), projects(name)').eq('id', id!).single()
    if (data) {
      setDoc(data)
      let raw = ''
      if (data.content) raw = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
      else if (data.document_templates?.content) {
        const secs = Array.isArray(data.document_templates.content)
          ? data.document_templates.content.map((s: any) => `<h2>${s.title || ''}</h2><p>${s.body || ''}</p>`).join('\n')
          : String(data.document_templates.content)
        raw = secs
      }
      if (editor && raw) editor.commands.setContent(raw)
    }
    setLoading(false)
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
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
  }, [editor, id])

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

  const handleAI = async (type: string) => {
    setAiLoading(true); setShowAI(true); setAiResult('')
    const { data } = await supabase.functions.invoke('analyze-document', { body: { document_id: id, analysis_type: type } })
    setAiResult(data?.result || 'Błąd analizy'); setAiLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

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

          <button onClick={() => navigate(`/construction/dms/${id}/certificate`)} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 text-gray-700">Certyfikat</button>
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

      {/* BubbleMenu */}
      {editor && mode === 'edit' && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-1 bg-white border shadow-lg rounded-lg px-2 py-1">
            <button onClick={() => editor.chain().focus().toggleBold().run()} className="p-1 rounded text-xs font-bold hover:bg-gray-100">B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className="p-1 rounded text-xs italic hover:bg-gray-100">I</button>
            <button onClick={() => editor.chain().focus().toggleHighlight({color:'#fef08a'}).run()} className="p-1 rounded text-xs hover:bg-gray-100" style={{background:'#fef08a'}}>Zaznacz</button>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={() => { const sel = window.getSelection()?.toString() || ''; setSelectedText(sel); setShowComments(true); setShowCommentBox(true); setTimeout(() => commentBoxRef.current?.focus(), 100) }} className="p-1 rounded text-xs text-blue-600 font-medium hover:bg-blue-50">+ Komentarz</button>
          </div>
        </BubbleMenu>
      )}

      {/* Main content */}
      <div className="flex-1 flex max-w-screen-xl mx-auto w-full px-4 py-6 gap-6">
        {/* Document area */}
        <div className="flex-1">
          {/* AI result panel */}
          {showAI && aiResult && (
            <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-purple-800">Analiza AI</h4>
                <button onClick={() => { setShowAI(false); setAiResult('') }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
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
                  <button onClick={() => setShowComments(false)} className="text-xs text-gray-400">✕</button>
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
                          <button onClick={() => setActiveCommentId(null)} className="px-2 py-0.5 rounded text-xs border">✕</button>
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
                <button onClick={() => setShowParties(false)} className="text-xs text-gray-400">✕</button>
              </div>
              <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
                <DocumentParty label="Strona 1 (Zamawiający)" data={doc?.contractors} />
                <DocumentParty label="Strona 2 (Wykonawca)" data={null} isOwner />
              </div>
            </div>
          </div>
        )}
      </div>
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

const DocumentParty: React.FC<{ label: string; data?: PartyData | null; isOwner?: boolean }> = ({ label, data, isOwner }) => {
  const [form, setForm] = React.useState<PartyData>(data || {})
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

  const upd = (k: keyof PartyData, v: string) => setForm(p => ({ ...p, [k]: v }))

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
      </div>
    </div>
  )
}

export default DocumentViewPage
