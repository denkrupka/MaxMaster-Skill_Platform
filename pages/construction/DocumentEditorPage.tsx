import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, FontFamily, Color, FontSize } from '@tiptap/extension-text-style';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

function useCurrentUser() {
  const { state } = useAppContext();
  return { user: state.currentUser };
}

export const DocumentEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [currentSize, setCurrentSize] = useState('16');
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ hardBreak: { keepMarks: true } }),
      Underline,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      FontFamily.configure({ types: ['textStyle'] }),
      Color.configure({ types: ['textStyle'] }),
      FontSize,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[600px] p-8',
        style: 'font-size: 16px; line-height: 1.7;',
      },
      transformPastedHTML(html: string) {
        return html
          .replace(/<!--\[if.*?\]>.*?<!\[endif\]-->/gis, '')
          .replace(/<o:p[^>]*>.*?<\/o:p>/gis, '')
          .replace(/class="[^"]*Mso[^"]*"/gi, '')
          .replace(/style="[^"]*mso-[^"]*"/gi, match => {
            const cleaned = match.replace(/mso-[^;";]+;?/g, '');
            return cleaned === 'style=""' ? '' : cleaned;
          });
      },
    },
  });

  useEffect(() => {
    if (id) { loadDoc(); loadComments(); }
  }, [id]);

  const loadDoc = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    if (error || !data) { setLoading(false); return; }
    setDoc(data);
    let html = '';
    if (data.content) {
      html = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    } else if (data.document_templates?.content) {
      html = Array.isArray(data.document_templates.content)
        ? data.document_templates.content.map((s: any) => `<h2>${s.title || ''}</h2><p>${s.body || ''}</p>`).join('\n')
        : JSON.stringify(data.document_templates.content);
    }
    if (editor && html) editor.commands.setContent(html);
    setLoading(false);
  };

  const loadComments = async () => {
    const { data } = await supabase.from('document_comments').select('*').eq('document_id', id).order('created_at', { ascending: true });
    if (data) {
      const roots = data.filter(c => !c.parent_id).map(c => ({ ...c, replies: data.filter(r => r.parent_id === c.id) }));
      setComments(roots);
    }
  };

  const save = useCallback(async () => {
    if (!editor || !id) return;
    setSaving(true);
    const html = editor.getHTML();
    const { error } = await supabase.from('documents').update({ content: html, updated_at: new Date().toISOString() }).eq('id', id);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }, [editor, id]);

  useEffect(() => {
    const t = setInterval(save, 30000);
    return () => clearInterval(t);
  }, [save]);

  const addComment = async () => {
    if (!newComment.trim() || !user || !id) return;
    const { data } = await supabase.from('document_comments').insert({
      document_id: id, author_id: user.id, author_name: user.email, content: newComment.trim(),
      field_key: selectedText ? `selection:${selectedText.slice(0, 50)}` : null,
    }).select().single();
    if (data) {
      setComments(c => [...c, { ...data, replies: [] }]);
      setNewComment(''); setShowCommentInput(false); setSelectedText('');
      if (selectedText && editor) editor.commands.setHighlight({ color: '#fef08a' });
    }
  };

  const addReply = async (parentId: string) => {
    if (!replyText.trim() || !user || !id) return;
    const { data } = await supabase.from('document_comments').insert({
      document_id: id, author_id: user.id, author_name: user.email, content: replyText.trim(), parent_id: parentId,
    }).select().single();
    if (data) {
      setComments(c => c.map(item => item.id === parentId ? { ...item, replies: [...(item.replies || []), data] } : item));
      setReplyText(''); setReplyTo(null);
    }
  };

  const resolveComment = async (cId: string) => {
    await supabase.from('document_comments').update({ resolved: true }).eq('id', cId);
    setComments(c => c.map(item => item.id === cId ? { ...item, resolved: true } : item));
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const unresolved = comments.filter(c => !c.resolved);
  const resolved = comments.filter(c => c.resolved);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/construction/dms')} className="text-gray-500 hover:text-gray-800 p-2 rounded">← Powrót</button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <h1 className="text-sm font-semibold text-gray-900 truncate max-w-xs">{doc?.name || doc?.document_templates?.name || 'Dokument'}</h1>
          <div className="flex-1" />

          {editor && <>
            <select value={currentSize} onChange={e => { setCurrentSize(e.target.value); (editor.chain().focus() as any).setFontSize(e.target.value + 'px').run(); }}
              className="border rounded px-2 py-1 text-xs">
              {['12', '14', '16', '18', '20', '24', '28', '32', '36', '48'].map(s => <option key={s} value={s}>{s}px</option>)}
            </select>

            <button onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded text-sm font-bold ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded text-sm italic ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>I</button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded text-sm underline ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>U</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded text-xs font-bold ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>H1</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded text-xs font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>H2</button>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded text-xs ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>• Lista</button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded text-xs ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>1. Lista</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className="p-1.5 rounded text-xs hover:bg-gray-100" title="Do lewej">⬅</button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className="p-1.5 rounded text-xs hover:bg-gray-100" title="Wyśrodkuj">↔</button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className="p-1.5 rounded text-xs hover:bg-gray-100" title="Do prawej">➡</button>
            <div className="w-px h-6 bg-gray-200 mx-1" />

            <input type="color" onChange={e => editor.chain().focus().setColor(e.target.value).run()}
              className="w-7 h-7 rounded cursor-pointer border" title="Kolor tekstu" />
            <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
              className={`p-1.5 rounded text-xs ${editor.isActive('highlight') ? 'bg-yellow-100' : 'hover:bg-gray-100'}`}
              style={{ background: editor.isActive('highlight') ? '#fef08a' : '' }}>Zaznacz</button>
          </>}

          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button onClick={() => {
            const t = window.getSelection()?.toString() || '';
            setSelectedText(t); setShowCommentInput(true);
            setTimeout(() => commentRef.current?.focus(), 100);
          }} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">+ Komentarz</button>
          <button onClick={save} disabled={saving}
            className={`px-4 py-1.5 text-xs rounded-lg font-medium ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
            {saving ? 'Zapisywanie...' : saved ? 'Zapisano!' : 'Zapisz'}
          </button>
        </div>
      </div>


      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">
        <div className="flex-1">
          {showCommentInput && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              {selectedText && (
                <p className="text-xs text-gray-500 mb-2 italic">
                  Komentarz do: "<span className="font-medium">{selectedText.slice(0, 80)}{selectedText.length > 80 ? '...' : ''}</span>"
                </p>
              )}
              <textarea ref={commentRef} value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Napisz komentarz..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 mt-2">
                <button onClick={addComment} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Dodaj komentarz</button>
                <button onClick={() => { setShowCommentInput(false); setNewComment(''); setSelectedText(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs border hover:bg-gray-50">Anuluj</button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm border min-h-[700px]">
            <EditorContent editor={editor} />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Autosave co 30 sekund</p>
        </div>

        {/* Comments sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border shadow-sm sticky top-16">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Komentarze ({unresolved.length})</h3>
              {resolved.length > 0 && <span className="text-xs text-gray-400">{resolved.length} rozwiązane</span>}
            </div>
            <div className="divide-y max-h-[70vh] overflow-y-auto">
              {unresolved.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">Brak komentarzy.<br />Zaznacz tekst i kliknij "+ Komentarz"</p>
              )}
              {unresolved.map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className="text-xs font-medium text-gray-800">{c.author_name || c.author}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(c.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button onClick={() => resolveComment(c.id)} className="text-xs text-green-600 hover:underline flex-shrink-0">Rozwiąż</button>
                  </div>
                  {c.field_key?.startsWith('selection:') && (
                    <p className="text-xs text-blue-600 italic mb-1 bg-blue-50 px-2 py-0.5 rounded">"{c.field_key.replace('selection:', '')}"</p>
                  )}
                  <p className="text-sm text-gray-700 mb-2">{c.content || c.text}</p>
                  {c.replies?.map((r: any) => (
                    <div key={r.id} className="ml-3 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                      <span className="text-xs font-medium text-gray-700">{r.author_name || r.author}</span>
                      <p className="text-xs text-gray-600 mt-0.5">{r.content || r.text}</p>
                    </div>
                  ))}
                  {replyTo === c.id ? (
                    <div className="mt-2">
                      <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Odpowiedz..." rows={2}
                        className="w-full border rounded px-2 py-1 text-xs resize-none" />
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => addReply(c.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Odpowiedz</button>
                        <button onClick={() => setReplyTo(null)} className="px-2 py-1 rounded text-xs border">Anuluj</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setReplyTo(c.id)} className="text-xs text-blue-600 hover:underline">Odpowiedz</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditorPage;
