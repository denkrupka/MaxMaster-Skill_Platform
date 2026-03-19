import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface Comment {
  id: string
  text: string
  author: string
  author_id: string
  created_at: string
  selection?: string
  parent_id?: string | null
  resolved?: boolean
  replies?: Comment[]
  [key: string]: any
}

const DocumentEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [fontSize, setFontSize] = useState('16')
  const commentBoxRef = useRef<HTMLTextAreaElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[600px] p-8',
        style: 'font-size: 16px; line-height: 1.7;',
      },
    },
  })

  useEffect(() => {
    if (!id) return
    loadDocument()
    loadComments()
  }, [id])

  const loadDocument = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*, document_templates(name, type, content)')
      .eq('id', id!)
      .single()
    if (error || !data) { setLoading(false); return }
    setDoc(data)

    // Load content: prioritize document.content, fallback to template content
    let rawContent = ''
    if (data.content) {
      rawContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content)
    } else if (data.document_templates?.content) {
      const sections = Array.isArray(data.document_templates.content)
        ? data.document_templates.content.map((s: any) => `<h2>${s.title || ''}</h2><p>${s.body || ''}</p>`).join('\n')
        : JSON.stringify(data.document_templates.content)
      rawContent = sections
    }

    if (editor && rawContent) {
      editor.commands.setContent(rawContent)
    }
    setLoading(false)
  }

  const loadComments = async () => {
    const { data } = await supabase
      .from('document_comments')
      .select('*')
      .eq('document_id', id!)
      .order('created_at', { ascending: true })
    if (data) {
      const topLevel = data.filter(c => !c.parent_id)
      const withReplies = topLevel.map(c => ({
        ...c,
        replies: data.filter(r => r.parent_id === c.id)
      }))
      setComments(withReplies)
    }
  }

  const handleSave = useCallback(async () => {
    if (!editor || !id) return
    setSaving(true)
    const html = editor.getHTML()
    const { error } = await supabase
      .from('documents')
      .update({ content: html, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }, [editor, id])

  // Auto-save every 30s
  useEffect(() => {
    const timer = setInterval(handleSave, 30000)
    return () => clearInterval(timer)
  }, [handleSave])

  const handleAddComment = async () => {
    if (!newComment.trim() || !user || !id) return
    const { data } = await supabase.from('document_comments').insert({
      document_id: id,
      author_id: user.id,
      author_name: user.email,
      content: newComment.trim(),
      field_key: selectedText ? `selection:${selectedText.slice(0, 50)}` : null,
    }).select().single()
    if (data) {
      setComments(prev => [...prev, { ...data, replies: [] }])
      setNewComment('')
      setShowCommentBox(false)
      setSelectedText('')
      // Highlight selection
      if (selectedText && editor) {
        editor.commands.setHighlight({ color: '#fef08a' })
      }
    }
  }

  const handleReply = async (parentId: string) => {
    if (!replyText.trim() || !user || !id) return
    const { data } = await supabase.from('document_comments').insert({
      document_id: id,
      author_id: user.id,
      author_name: user.email,
      content: replyText.trim(),
      parent_id: parentId,
    }).select().single()
    if (data) {
      setComments(prev => prev.map(c => c.id === parentId
        ? { ...c, replies: [...(c.replies || []), data] }
        : c
      ))
      setReplyText('')
      setActiveCommentId(null)
    }
  }

  const handleResolve = async (commentId: string) => {
    await supabase.from('document_comments').update({ resolved: true }).eq('id', commentId)
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, resolved: true } : c))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const activeComments = comments.filter(c => !c.resolved)
  const resolvedComments = comments.filter(c => c.resolved)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header Toolbar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/construction/dms')} className="text-gray-500 hover:text-gray-800 p-2 rounded">
            ← Powrót
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <h1 className="text-sm font-semibold text-gray-900 truncate max-w-xs">
            {doc?.name || doc?.document_templates?.name || 'Dokument'}
          </h1>
          <div className="flex-1" />

          {/* Formatting */}
          {editor && (
            <>
              <select
                value={fontSize}
                onChange={e => { setFontSize(e.target.value); editor.chain().focus().run() }}
                className="border rounded px-2 py-1 text-xs"
              >
                {['12','14','16','18','20','24','28','32','36','48'].map(s => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
              <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded text-sm font-bold ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>B</button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded text-sm italic ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>I</button>
              <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded text-sm underline ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>U</button>
              <div className="w-px h-6 bg-gray-200 mx-1" />
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1.5 rounded text-xs font-bold ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>H1</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded text-xs font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>H2</button>
              <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded text-xs ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>≡</button>
              <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded text-xs ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>1.</button>
              <div className="w-px h-6 bg-gray-200 mx-1" />
              <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className="p-1.5 rounded text-xs hover:bg-gray-100" title="Wyrównaj do lewej">⬅</button>
              <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className="p-1.5 rounded text-xs hover:bg-gray-100" title="Wyśrodkuj">↔</button>
              <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className="p-1.5 rounded text-xs hover:bg-gray-100" title="Wyrównaj do prawej">➡</button>
              <div className="w-px h-6 bg-gray-200 mx-1" />
              <input type="color" onChange={e => editor.chain().focus().setColor(e.target.value).run()} className="w-7 h-7 rounded cursor-pointer border" title="Kolor tekstu" />
              <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} className={`p-1.5 rounded text-xs ${editor.isActive('highlight') ? 'bg-yellow-100' : 'hover:bg-gray-100'}`} style={{background: editor.isActive('highlight') ? '#fef08a' : ''}}>Zaznacz</button>
            </>
          )}

          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button
            onClick={() => { const sel = window.getSelection()?.toString() || ''; setSelectedText(sel); setShowCommentBox(true); setTimeout(() => commentBoxRef.current?.focus(), 100) }}
            className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
          >
            + Komentarz
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-1.5 text-xs rounded-lg font-medium ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}
          >
            {saving ? 'Zapisywanie...' : saved ? 'Zapisano!' : 'Zapisz'}
          </button>
        </div>
      </div>

      {/* Bubble Menu (appears on text selection) */}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-1 bg-white border shadow-lg rounded-lg px-2 py-1">
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1 rounded text-xs font-bold ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1 rounded text-xs italic ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>I</button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1 rounded text-xs underline ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>U</button>
            <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} className="p-1 rounded text-xs hover:bg-gray-100" style={{background:'#fef08a'}}>Zaznacz</button>
            <div className="w-px h-4 bg-gray-200" />
            <button
              onClick={() => {
                const sel = window.getSelection()?.toString() || ''
                setSelectedText(sel)
                setShowCommentBox(true)
                setTimeout(() => commentBoxRef.current?.focus(), 100)
              }}
              className="p-1 rounded text-xs hover:bg-blue-50 text-blue-600 font-medium"
            >
              + Komentarz
            </button>
          </div>
        </BubbleMenu>
      )}

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">
        {/* Editor Area */}
        <div className="flex-1">
          {/* Comment Box (floating) */}
          {showCommentBox && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              {selectedText && (
                <p className="text-xs text-gray-500 mb-2 italic">
                  Komentarz do: &quot;<span className="font-medium">{selectedText.slice(0, 80)}{selectedText.length > 80 ? '...' : ''}</span>&quot;
                </p>
              )}
              <textarea
                ref={commentBoxRef}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Napisz komentarz..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleAddComment} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Dodaj komentarz</button>
                <button onClick={() => { setShowCommentBox(false); setNewComment(''); setSelectedText('') }} className="px-3 py-1.5 rounded-lg text-xs border hover:bg-gray-50">Anuluj</button>
              </div>
            </div>
          )}

          {/* TipTap Editor */}
          <div className="bg-white rounded-xl shadow-sm border min-h-[700px]">
            <EditorContent editor={editor} />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Autosave co 30 sekund</p>
        </div>

        {/* Comments Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Komentarze ({activeComments.length})</h3>
              {resolvedComments.length > 0 && (
                <span className="text-xs text-gray-400">{resolvedComments.length} rozwiązane</span>
              )}
            </div>
            <div className="divide-y max-h-[70vh] overflow-y-auto">
              {activeComments.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">Brak komentarzy.<br/>Zaznacz tekst i kliknij &quot;+ Komentarz&quot;</p>
              )}
              {activeComments.map(comment => (
                <div key={comment.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className="text-xs font-medium text-gray-800">{comment.author_name || comment.author}</span>
                      <span className="text-xs text-gray-400 ml-2">{new Date(comment.created_at).toLocaleDateString('pl-PL', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <button onClick={() => handleResolve(comment.id)} className="text-xs text-green-600 hover:underline flex-shrink-0">Rozwiąż</button>
                  </div>
                  {comment.field_key?.startsWith('selection:') && (
                    <p className="text-xs text-blue-600 italic mb-1 bg-blue-50 px-2 py-0.5 rounded">
                      &quot;{comment.field_key.replace('selection:', '')}&quot;
                    </p>
                  )}
                  <p className="text-sm text-gray-700 mb-2">{comment.content || comment.text}</p>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-3 space-y-2 mb-2">
                      {comment.replies.map(reply => (
                        <div key={reply.id} className="bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-gray-700">{reply.author_name || reply.author}</span>
                          <p className="text-xs text-gray-600 mt-0.5">{reply.content || reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply form */}
                  {activeCommentId === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Odpowiedz..."
                        rows={2}
                        className="w-full border rounded px-2 py-1 text-xs resize-none"
                      />
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => handleReply(comment.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Odpowiedz</button>
                        <button onClick={() => setActiveCommentId(null)} className="px-2 py-1 rounded text-xs border">Anuluj</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setActiveCommentId(comment.id)} className="text-xs text-blue-600 hover:underline">Odpowiedz</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentEditorPage
