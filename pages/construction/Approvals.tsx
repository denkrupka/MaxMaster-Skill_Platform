import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Search, CheckSquare, Clock, CheckCircle, XCircle,
  Loader2, User, MessageSquare, ArrowRight, FileText,
  Send, Users, X, Save, Trash2,
  MapPin, Image, AlertTriangle, BarChart3, Download,
  History, Camera, Zap, TrendingUp, List
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project } from '../../types';

type UzgodnienieStatus = 'new' | 'in_review' | 'approved' | 'rejected' | 'delegated' | 'escalated' | 'cancelled';
type UzgodnienePriority = 'low' | 'normal' | 'high' | 'urgent';
type FilterTab = 'mine' | 'waiting' | 'all' | 'stats';
type ApprovalMode = 'single' | 'all' | 'any';

interface Annotation {
  type: 'point' | 'arrow';
  x: number; y: number;
  x2?: number; y2?: number;
}

interface Uzgodnienie {
  id: string;
  company_id: string;
  project_id?: string;
  number?: string;
  title: string;
  description?: string;
  status: UzgodnienieStatus;
  priority: UzgodnienePriority;
  template_type?: string;
  approval_mode?: ApprovalMode;
  plan_x?: number;
  plan_y?: number;
  plan_screenshot_url?: string;
  plan_annotations?: Annotation[];
  assigned_to_id?: string;
  created_by_id: string;
  sla_hours: number;
  sla_deadline?: string;
  escalated_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  project?: Project;
  assigned_to?: any;
  created_by?: any;
  photos?: UzgodnieniePhoto[];
  participants?: UzgodnienieParticipant[];
}

interface UzgodnienieHistoryEntry {
  id: string;
  uzgodnienie_id: string;
  action: string;
  from_status?: UzgodnienieStatus;
  to_status?: UzgodnienieStatus;
  user_id: string;
  comment?: string;
  delegated_to_id?: string;
  created_at: string;
  user?: any;
  delegated_to?: any;
}

interface UzgodnieniePhoto {
  id: string;
  uzgodnienie_id: string;
  url: string;
  caption?: string;
  created_at: string;
}

interface UzgodnienieParticipant {
  id: string;
  uzgodnienie_id: string;
  user_id: string;
  decision: string | null;
  decided_at?: string;
  comment?: string;
  created_at: string;
  user?: any;
}

const STATUS_LABELS: Record<UzgodnienieStatus, string> = {
  new: 'Nowe', in_review: 'W trakcie', approved: 'Zatwierdzone',
  rejected: 'Odrzucone', delegated: 'Delegowane', escalated: 'Eskalowane', cancelled: 'Anulowane'
};

const STATUS_COLORS: Record<UzgodnienieStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  delegated: 'bg-purple-100 text-purple-700 border-purple-200',
  escalated: 'bg-orange-100 text-orange-700 border-orange-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
};

const PRIORITY_LABELS: Record<UzgodnienePriority, string> = {
  low: 'Niski', normal: 'Normalny', high: 'Pilny', urgent: 'Krytyczny'
};

const PRIORITY_COLORS: Record<UzgodnienePriority, string> = {
  low: 'text-slate-500', normal: 'text-blue-600', high: 'text-amber-600', urgent: 'text-red-600'
};

const PRIORITY_BADGE: Record<UzgodnienePriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700 border border-red-300'
};

const PRIORITY_SLA: Record<UzgodnienePriority, number> = {
  low: 72, normal: 48, high: 24, urgent: 4
};

const QUESTION_TEMPLATES = [
  { id: 'zmiana_trasy_kabla', label: '⚡ Zmiana trasy kabla', value: 'Zmiana trasy kabla' },
  { id: 'brak_materialu', label: '📦 Brak materiału', value: 'Brak materiału na budowie' },
  { id: 'pytanie_o_technologie', label: '🔧 Pytanie o technologię', value: 'Pytanie o technologię wykonania' },
  { id: 'zmiana_projektu', label: '📐 Zmiana projektu', value: 'Zmiana w projekcie technicznym' },
];

const ACTION_LABELS: Record<string, string> = {
  created: 'Utworzono', approved: 'Zatwierdzono', rejected: 'Odrzucono',
  delegated: 'Delegowano', escalated: 'Eskalowano', comment: 'Komentarz', reassigned: 'Przypisano'
};

const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  single: '👤 Jedna osoba', all: '✅ Wszyscy muszą zatwierdzić', any: '🙋 Wystarczy jeden'
};

// Canvas Annotation Component
interface CanvasAnnotatorProps {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (a: Annotation[]) => void;
  readOnly?: boolean;
}

const CanvasAnnotator: React.FC<CanvasAnnotatorProps> = ({ imageUrl, annotations, onChange, readOnly }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [tool, setTool] = useState<'point' | 'arrow'>('point');
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    annotations.forEach((ann, i) => {
      const px = (ann.x / 100) * canvas.width;
      const py = (ann.y / 100) * canvas.height;
      if (ann.type === 'point') {
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239,68,68,0.85)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), px, py);
      } else if (ann.type === 'arrow' && ann.x2 != null && ann.y2 != null) {
        const px2 = (ann.x2 / 100) * canvas.width;
        const py2 = (ann.y2 / 100) * canvas.height;
        const angle = Math.atan2(py2 - py, px2 - px);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px2, py2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(px2, py2);
        ctx.lineTo(px2 - headLen * Math.cos(angle - Math.PI / 7), py2 - headLen * Math.sin(angle - Math.PI / 7));
        ctx.moveTo(px2, py2);
        ctx.lineTo(px2 - headLen * Math.cos(angle + Math.PI / 7), py2 - headLen * Math.sin(angle + Math.PI / 7));
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }, [annotations, imgLoaded]);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        const maxW = canvas.parentElement?.clientWidth || 480;
        const ratio = img.naturalHeight / img.naturalWidth;
        canvas.width = Math.min(maxW, img.naturalWidth);
        canvas.height = canvas.width * ratio;
      }
      setImgLoaded(true);
    };
    img.onerror = () => setImgLoaded(false);
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => { drawAll(); }, [drawAll]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round(((e.clientX - rect.left) * scaleX / canvas.width) * 100),
      y: Math.round(((e.clientY - rect.top) * scaleY / canvas.height) * 100)
    };
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex gap-2 text-sm flex-wrap">
          <button type="button" onClick={() => setTool('point')}
            className={`px-3 py-1.5 rounded-lg border ${tool === 'point' ? 'bg-red-500 text-white border-red-500' : 'border-slate-300 hover:bg-slate-50'}`}>
            📍 Punkt
          </button>
          <button type="button" onClick={() => setTool('arrow')}
            className={`px-3 py-1.5 rounded-lg border ${tool === 'arrow' ? 'bg-red-500 text-white border-red-500' : 'border-slate-300 hover:bg-slate-50'}`}>
            ➡️ Strzałka
          </button>
          {annotations.length > 0 && (
            <>
              <button type="button" onClick={() => onChange(annotations.slice(0, -1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-red-50 text-red-600 ml-auto">↩ Cofnij</button>
              <button type="button" onClick={() => onChange([])}
                className="px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600">🗑 Wyczyść</button>
            </>
          )}
        </div>
      )}
      {!imgLoaded && <div className="flex items-center gap-2 text-slate-500 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Ładowanie planu...</div>}
      <canvas
        ref={canvasRef}
        className={`w-full rounded-lg border border-slate-200 ${!readOnly ? (tool === 'arrow' ? 'cursor-crosshair' : 'cursor-cell') : ''} ${!imgLoaded ? 'hidden' : ''}`}
        onMouseDown={e => {
          if (readOnly) return;
          const coords = getCanvasCoords(e);
          if (tool === 'point') { onChange([...annotations, { type: 'point', ...coords }]); }
          else { setDragging(coords); }
        }}
        onMouseUp={e => {
          if (readOnly || !dragging) return;
          const coords = getCanvasCoords(e);
          if (Math.abs(coords.x - dragging.x) > 1 || Math.abs(coords.y - dragging.y) > 1) {
            onChange([...annotations, { type: 'arrow', x: dragging.x, y: dragging.y, x2: coords.x, y2: coords.y }]);
          }
          setDragging(null);
        }}
      />
      {!readOnly && <p className="text-xs text-slate-400">{tool === 'point' ? '👆 Kliknij aby dodać punkt' : '🖱 Kliknij i przeciągnij aby narysować strzałkę'}</p>}
    </div>
  );
};

// Main Component
export const ApprovalsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;
  const usersList: any[] = users || [];

  const [filterTab, setFilterTab] = useState<FilterTab>('mine');
  const [uzgodnienia, setUzgodnienia] = useState<Uzgodnienie[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedUzgodnienie, setSelectedUzgodnienie] = useState<Uzgodnienie | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailHistory, setDetailHistory] = useState<UzgodnienieHistoryEntry[]>([]);
  const [detailParticipants, setDetailParticipants] = useState<UzgodnienieParticipant[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUzgodnienie, setEditingUzgodnienie] = useState<Uzgodnienie | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delegate' | 'comment'>('approve');
  const [actionComment, setActionComment] = useState('');
  const [delegateTo, setDelegateTo] = useState('');

  const [groupParticipants, setGroupParticipants] = useState<string[]>([]);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('single');

  const [form, setForm] = useState({
    project_id: '', title: '', description: '', priority: 'normal' as UzgodnienePriority,
    assigned_to_id: '', sla_hours: 48, plan_screenshot_url: '', template_type: ''
  });

  useEffect(() => { if (currentUser) loadData(); }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [uzgRes, projectsRes] = await Promise.all([
        supabase.from('uzgodnienia')
          .select(`*, project:projects(*),
            assigned_to:users!uzgodnienia_assigned_to_id_fkey(id, first_name, last_name, email),
            created_by:users!uzgodnienia_created_by_id_fkey(id, first_name, last_name, email),
            photos:uzgodnienia_photos(*),
            participants:uzgodnienia_participants(*, user:users(id, first_name, last_name, email))`)
          .eq('company_id', currentUser.company_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('projects').select('*').eq('company_id', currentUser.company_id)
      ]);
      if (uzgRes.data) {
        setUzgodnienia(uzgRes.data);
        // Auto-escalate overdue
        const now = new Date();
        const toEscalate = uzgRes.data.filter(u =>
          ['new', 'in_review'].includes(u.status) && u.sla_deadline && new Date(u.sla_deadline) < now && !u.escalated_at
        );
        if (toEscalate.length > 0) {
          await Promise.all(toEscalate.map(u =>
            supabase.from('uzgodnienia').update({ status: 'escalated', escalated_at: now.toISOString() }).eq('id', u.id)
          ));
        }
      }
      if (projectsRes.data) setProjects(projectsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadHistory = async (uzgId: string) => {
    const [h, p] = await Promise.all([
      supabase.from('uzgodnienia_history')
        .select(`*, user:users!uzgodnienia_history_user_id_fkey(id, first_name, last_name), delegated_to:users!uzgodnienia_history_delegated_to_id_fkey(id, first_name, last_name)`)
        .eq('uzgodnienie_id', uzgId).order('created_at', { ascending: true }),
      supabase.from('uzgodnienia_participants')
        .select(`*, user:users(id, first_name, last_name)`).eq('uzgodnienie_id', uzgId)
    ]);
    if (h.data) setDetailHistory(h.data);
    if (p.data) setDetailParticipants(p.data);
  };

  const uploadPhotos = async (uzgId: string, files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `uzgodnienia/${uzgId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('dms').upload(fileName, file, { upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('dms').getPublicUrl(fileName);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
    }
    return urls;
  };

  const insertNotif = async (userId: string, title: string, message: string, entityId: string) => {
    if (!currentUser) return;
    await supabase.from('notifications').insert({
      company_id: currentUser.company_id, user_id: userId, type: 'task_assigned',
      title, message, entity_type: 'uzgodnienie', entity_id: entityId, is_read: false, created_at: new Date().toISOString()
    }) as any;
  };

  const sendEmail = async (email: string, subject: string, message: string) => {
    await supabase.functions.invoke('send-email', {
      body: { template: 'NOTIFICATION', to: email, data: { subject, message, actionUrl: window.location.origin, actionLabel: 'Przejdź do portalu' } }
    }) as any;
  };

  const stats = useMemo(() => {
    const mine = uzgodnienia.filter(u => u.created_by_id === currentUser?.id);
    const waitingForMe = uzgodnienia.filter(u =>
      (u.assigned_to_id === currentUser?.id || u.participants?.some(p => p.user_id === currentUser?.id && !p.decision)) &&
      ['new', 'in_review', 'escalated', 'delegated'].includes(u.status)
    );
    const overdue = uzgodnienia.filter(u =>
      u.sla_deadline && !['approved', 'rejected', 'cancelled'].includes(u.status) && new Date(u.sla_deadline) < new Date()
    );
    const approvedThisMonth = uzgodnienia.filter(u => {
      if (u.status !== 'approved' || !u.resolved_at) return false;
      const d = new Date(u.resolved_at); const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const resolved = uzgodnienia.filter(u => u.resolved_at);
    const avgHours = resolved.length > 0
      ? resolved.reduce((s, u) => s + (new Date(u.resolved_at!).getTime() - new Date(u.created_at).getTime()) / 3600000, 0) / resolved.length : 0;

    const employeeMap: Record<string, { name: string; assigned: number; approved: number; rejected: number; overdue: number; totalHours: number; resolvedCount: number }> = {};
    uzgodnienia.forEach(u => {
      if (!u.assigned_to_id || !u.assigned_to) return;
      const uid = u.assigned_to_id;
      if (!employeeMap[uid]) employeeMap[uid] = { name: `${u.assigned_to.first_name} ${u.assigned_to.last_name}`, assigned: 0, approved: 0, rejected: 0, overdue: 0, totalHours: 0, resolvedCount: 0 };
      employeeMap[uid].assigned++;
      if (u.status === 'approved') employeeMap[uid].approved++;
      if (u.status === 'rejected') employeeMap[uid].rejected++;
      if (u.sla_deadline && !['approved', 'rejected', 'cancelled'].includes(u.status) && new Date(u.sla_deadline) < new Date()) employeeMap[uid].overdue++;
      if (u.resolved_at) { employeeMap[uid].totalHours += (new Date(u.resolved_at).getTime() - new Date(u.created_at).getTime()) / 3600000; employeeMap[uid].resolvedCount++; }
    });

    const templateCounts: Record<string, number> = {};
    uzgodnienia.forEach(u => { const t = u.template_type || 'custom'; templateCounts[t] = (templateCounts[t] || 0) + 1; });

    return { mine: mine.length, waitingForMe: waitingForMe.length, overdue: overdue.length, approvedThisMonth: approvedThisMonth.length, avgHours, employeeMap, templateCounts };
  }, [uzgodnienia, currentUser]);

  const filtered = useMemo(() => {
    let list = uzgodnienia;
    if (filterTab === 'mine') list = list.filter(u => u.created_by_id === currentUser?.id);
    else if (filterTab === 'waiting') list = list.filter(u =>
      (u.assigned_to_id === currentUser?.id || u.participants?.some(p => p.user_id === currentUser?.id && !p.decision)) &&
      ['new', 'in_review', 'escalated', 'delegated'].includes(u.status)
    );
    if (projectFilter !== 'all') list = list.filter(u => u.project_id === projectFilter);
    if (statusFilter !== 'all') list = list.filter(u => u.status === statusFilter);
    if (search) list = list.filter(u => u.title.toLowerCase().includes(search.toLowerCase()) || u.number?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [uzgodnienia, filterTab, projectFilter, statusFilter, search, currentUser]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pl-PL');
  const fmtDT = (d: string) => new Date(d).toLocaleString('pl-PL');
  const getName = (u: any) => u ? `${u.first_name} ${u.last_name}` : '—';
  const isOverdue = (u: Uzgodnienie) =>
    u.sla_deadline && !['approved', 'rejected', 'cancelled'].includes(u.status) && new Date(u.sla_deadline) < new Date();
  const canDecide = (uzg: Uzgodnienie) => {
    if (!currentUser || !['new', 'in_review', 'escalated', 'delegated'].includes(uzg.status)) return false;
    if (uzg.approval_mode === 'single' || !uzg.approval_mode) return uzg.assigned_to_id === currentUser.id;
    return uzg.participants?.some(p => p.user_id === currentUser.id && !p.decision) ?? false;
  };

  const handlePhotoAdd = (files: File[]) => {
    setPhotoFiles(prev => [...prev, ...files]);
    setPhotoPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };
  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photoPreviewUrls[i]);
    setPhotoFiles(p => p.filter((_, j) => j !== i));
    setPhotoPreviewUrls(p => p.filter((_, j) => j !== i));
  };

  const handleSave = async () => {
    if (!currentUser || !form.title) return;
    setSaving(true);
    try {
      const data: any = {
        company_id: currentUser.company_id, project_id: form.project_id || null,
        title: form.title, description: form.description || null, priority: form.priority,
        assigned_to_id: approvalMode === 'single' ? (form.assigned_to_id || null) : null,
        sla_hours: form.sla_hours, created_by_id: currentUser.id, status: 'new' as UzgodnienieStatus,
        template_type: form.template_type || null, approval_mode: approvalMode,
        plan_annotations: annotations.length > 0 ? annotations : null,
        plan_screenshot_url: form.plan_screenshot_url || null
      };

      let uzgId: string;
      if (editingUzgodnienie) {
        await supabase.from('uzgodnienia').update(data).eq('id', editingUzgodnienie.id);
        uzgId = editingUzgodnienie.id;
      } else {
        const { data: created } = await supabase.from('uzgodnienia').insert(data).select().single();
        uzgId = created!.id;
        await supabase.from('uzgodnienia_history').insert({ uzgodnienie_id: uzgId, action: 'created', to_status: 'new', user_id: currentUser.id });

        if (photoFiles.length > 0) {
          const photoUrls = await uploadPhotos(uzgId, photoFiles);
          for (const url of photoUrls) await supabase.from('uzgodnienia_photos').insert({ uzgodnienie_id: uzgId, url, uploaded_by_id: currentUser.id, created_at: new Date().toISOString() });
        }

        if (approvalMode !== 'single' && groupParticipants.length > 0) {
          await supabase.from('uzgodnienia_participants').insert(groupParticipants.map(uid => ({ uzgodnienie_id: uzgId, user_id: uid, decision: null })));
          for (const uid of groupParticipants) {
            await insertNotif(uid, `Nowe uzgodnienie: ${form.title}`, `Wymagana Twoja decyzja. Tryb: ${APPROVAL_MODE_LABELS[approvalMode]}`, uzgId);
            const u = usersList.find(u => u.id === uid);
            if (u?.email) await sendEmail(u.email, `Nowe uzgodnienie: ${form.title}`, `Wymagana Twoja decyzja (${APPROVAL_MODE_LABELS[approvalMode]}). Termin: ${form.sla_hours}h.`);
          }
        } else if (form.assigned_to_id) {
          await insertNotif(form.assigned_to_id, `Nowe uzgodnienie: ${form.title}`, `Masz nowe uzgodnienie. Termin: ${form.sla_hours}h.`, uzgId);
          const assignee = usersList.find(u => u.id === form.assigned_to_id);
          if (assignee?.email) await sendEmail(assignee.email, `Nowe uzgodnienie: ${form.title}`, `Masz nowe uzgodnienie: "${form.title}". Termin: ${form.sla_hours}h.`);
          if (form.priority === 'urgent' || form.priority === 'high')
            await insertNotif(form.assigned_to_id, `🚨 PILNE: ${form.title}`, 'Wymagana natychmiastowa reakcja!', uzgId);
        }
      }

      setShowCreateModal(false); setEditingUzgodnienie(null); resetForm(); await loadData();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleAction = async () => {
    if (!currentUser || !selectedUzgodnienie) return;
    setProcessing(true);
    try {
      const newStatus: UzgodnienieStatus =
        actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' :
        actionType === 'delegate' ? 'delegated' : selectedUzgodnienie.status;

      if (selectedUzgodnienie.approval_mode !== 'single' && (actionType === 'approve' || actionType === 'reject')) {
        await supabase.from('uzgodnienia_participants')
          .update({ decision: actionType === 'approve' ? 'approved' : 'rejected', decided_at: new Date().toISOString(), comment: actionComment || null })
          .eq('uzgodnienie_id', selectedUzgodnienie.id).eq('user_id', currentUser.id);

        const { data: parts } = await supabase.from('uzgodnienia_participants').select('decision').eq('uzgodnienie_id', selectedUzgodnienie.id);
        const allDecided = parts?.every(p => p.decision != null);
        const anyApproved = parts?.some(p => p.decision === 'approved');
        const allApproved = parts?.every(p => p.decision === 'approved');

        let finalStatus: UzgodnienieStatus = selectedUzgodnienie.status;
        if (selectedUzgodnienie.approval_mode === 'all' && allApproved) finalStatus = 'approved';
        else if (selectedUzgodnienie.approval_mode === 'any' && anyApproved) finalStatus = 'approved';
        else if (allDecided && !anyApproved) finalStatus = 'rejected';

        if (finalStatus !== selectedUzgodnienie.status)
          await supabase.from('uzgodnienia').update({ status: finalStatus, resolved_at: new Date().toISOString(), resolved_by_id: currentUser.id }).eq('id', selectedUzgodnienie.id);
      } else {
        const upd: any = { status: newStatus };
        if (actionType === 'approve' || actionType === 'reject') { upd.resolved_at = new Date().toISOString(); upd.resolved_by_id = currentUser.id; }
        if (actionType === 'delegate' && delegateTo) upd.assigned_to_id = delegateTo;
        await supabase.from('uzgodnienia').update(upd).eq('id', selectedUzgodnienie.id);
      }

      const histData: any = { uzgodnienie_id: selectedUzgodnienie.id, action: actionType, from_status: selectedUzgodnienie.status, to_status: newStatus, user_id: currentUser.id, comment: actionComment || null };
      if (actionType === 'delegate' && delegateTo) histData.delegated_to_id = delegateTo;
      await supabase.from('uzgodnienia_history').insert(histData);

      const notifyId = actionType === 'delegate' ? delegateTo : selectedUzgodnienie.created_by_id;
      const aLabel = actionType === 'approve' ? 'zatwierdzone' : actionType === 'reject' ? 'odrzucone' : actionType === 'delegate' ? 'delegowane' : 'skomentowane';
      if (notifyId && notifyId !== currentUser.id) await insertNotif(notifyId, `Uzgodnienie ${aLabel}: ${selectedUzgodnienie.title}`, actionComment || `Uzgodnienie zostało ${aLabel}.`, selectedUzgodnienie.id);

      setShowActionModal(false); setShowDetailModal(false); setActionComment(''); setDelegateTo(''); await loadData();
    } catch (err) { console.error(err); }
    finally { setProcessing(false); }
  };

  const handleExportPDF = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const pu = uzgodnienia.filter(u => u.project_id === projectId);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Uzgodnienia ${project?.name}</title>
<style>body{font-family:Arial,sans-serif;margin:20px}h1{color:#1e293b}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#f1f5f9;padding:8px;text-align:left;border:1px solid #e2e8f0}td{padding:8px;border:1px solid #e2e8f0;font-size:12px}.approved{color:#16a34a}.rejected{color:#dc2626}</style></head>
<body><h1>Uzgodnienia: ${project?.name}</h1><p>Data: ${new Date().toLocaleString('pl-PL')} | Łącznie: ${pu.length} | Zat.: ${pu.filter(u => u.status === 'approved').length} | Odrz.: ${pu.filter(u => u.status === 'rejected').length}</p>
<table><tr><th>Nr</th><th>Tytuł</th><th>Status</th><th>Priorytet</th><th>Przypisany</th><th>Autor</th><th>SLA</th><th>Decyzja</th></tr>
${pu.map(u => `<tr><td>${u.number || '—'}</td><td>${u.title}</td><td class="${u.status}">${STATUS_LABELS[u.status]}</td><td>${PRIORITY_LABELS[u.priority]}</td><td>${getName(u.assigned_to)}</td><td>${getName(u.created_by)}</td><td>${u.sla_deadline ? fmtDT(u.sla_deadline) : '—'}</td><td>${u.resolved_at ? fmtDate(u.resolved_at) : '—'}</td></tr>`).join('')}
</table><p style="margin-top:30px;color:#64748b;font-size:11px">MaxMaster Portal</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `uzgodnienia_${project?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setForm({ project_id: '', title: '', description: '', priority: 'normal', assigned_to_id: '', sla_hours: 48, plan_screenshot_url: '', template_type: '' });
    setPhotoFiles([]); setPhotoPreviewUrls([]); setAnnotations([]); setGroupParticipants([]); setApprovalMode('single'); setCreateStep(1);
  };

  return (
    <div className="p-3 sm:p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex justify-end">
        <button onClick={() => { resetForm(); setEditingUzgodnienie(null); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium min-h-[48px] shadow-sm">
          <Plus className="w-5 h-5" /> Nowe uzgodnienie
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Moje', value: stats.mine, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Czekam', value: stats.waitingForMe, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Przeterminowane', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Zat. (m-c)', value: stats.approvedThisMonth, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Śr. czas', value: stats.avgHours > 0 ? `${stats.avgHours.toFixed(1)}h` : '—', icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} p-3 rounded-xl border border-slate-200`}>
            <Icon className={`w-4 h-4 ${color} mb-1`} />
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Tabs */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <nav className="flex min-w-max">
            {([
              { key: 'mine', label: 'Moje' },
              { key: 'waiting', label: `Czekam${stats.waitingForMe > 0 ? ` (${stats.waitingForMe})` : ''}` },
              { key: 'all', label: 'Wszystkie' },
              { key: 'stats', label: '📊 Statystyki' },
            ] as { key: FilterTab; label: string }[]).map(tab => (
              <button key={tab.key} onClick={() => setFilterTab(tab.key)}
                className={`px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap ${filterTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Stats tab */}
        {filterTab === 'stats' ? (
          <div className="p-4 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Statystyki wg pracownika</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50">
                    <th className="text-left p-2 font-medium text-slate-600">Pracownik</th>
                    <th className="text-center p-2 font-medium text-slate-600">Przyp.</th>
                    <th className="text-center p-2 font-medium text-slate-600">Zatw.</th>
                    <th className="text-center p-2 font-medium text-slate-600">Odrz.</th>
                    <th className="text-center p-2 font-medium text-slate-600">Przeter.</th>
                    <th className="text-center p-2 font-medium text-slate-600">Śr. czas</th>
                  </tr></thead>
                  <tbody>
                    {Object.values(stats.employeeMap).length === 0
                      ? <tr><td colSpan={6} className="text-center p-4 text-slate-400">Brak danych</td></tr>
                      : Object.values(stats.employeeMap).sort((a, b) => b.assigned - a.assigned).map(emp => (
                        <tr key={emp.name} className="border-t border-slate-100">
                          <td className="p-2 font-medium">{emp.name}</td>
                          <td className="p-2 text-center">{emp.assigned}</td>
                          <td className="p-2 text-center text-green-600 font-medium">{emp.approved}</td>
                          <td className="p-2 text-center text-red-600">{emp.rejected}</td>
                          <td className="p-2 text-center">{emp.overdue > 0 ? <span className="text-red-600 font-medium">{emp.overdue}</span> : <span className="text-slate-400">0</span>}</td>
                          <td className="p-2 text-center text-purple-600">{emp.resolvedCount > 0 ? `${(emp.totalHours / emp.resolvedCount).toFixed(1)}h` : '—'}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><List className="w-4 h-4" /> Top typy pytań</h3>
              <div className="space-y-2">
                {Object.entries(stats.templateCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                  const t = QUESTION_TEMPLATES.find(t => t.id === type);
                  const label = t?.label || (type === 'custom' ? '✏️ Własne' : type);
                  const pct = Math.round((count / (uzgodnienia.length || 1)) * 100);
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-slate-500">{count} ({pct}%)</span></div>
                      <div className="h-2 bg-slate-100 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            {projectFilter !== 'all' && (
              <button onClick={() => handleExportPDF(projectFilter)}
                className="flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm min-h-[48px]">
                <Download className="w-4 h-4" /> Eksport projektu do PDF
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2">
              <div className="flex-1 min-w-0 relative" style={{ minWidth: '160px' }}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Szukaj..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="all">Wszystkie projekty</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="all">Wszystkie statusy</option>
                {(Object.keys(STATUS_LABELS) as UzgodnienieStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              {projectFilter !== 'all' && (
                <button onClick={() => handleExportPDF(projectFilter)} className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm">
                  <Download className="w-4 h-4" /> PDF
                </button>
              )}
            </div>

            {/* List */}
            <div className="p-3">
              {loading ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 mb-4">Brak uzgodnień</p>
                  <button onClick={() => { resetForm(); setShowCreateModal(true); }}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 min-h-[48px]">
                    Utwórz pierwsze uzgodnienie
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(uzg => {
                    const overdue = isOverdue(uzg);
                    return (
                      <div key={uzg.id} onClick={() => { setSelectedUzgodnienie(uzg); setShowDetailModal(true); loadHistory(uzg.id); }}
                        className={`flex items-start sm:items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                          overdue ? 'bg-red-50 border-red-200 hover:bg-red-100' :
                          (uzg.priority === 'urgent' || uzg.priority === 'high') ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' :
                          'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          uzg.priority === 'urgent' ? 'bg-red-500' : uzg.priority === 'high' ? 'bg-amber-400' : uzg.status === 'approved' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          <CheckSquare className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <p className="font-semibold text-slate-900 text-sm truncate">{uzg.title}</p>
                            {uzg.number && <span className="text-xs text-slate-400">#{uzg.number}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {uzg.project?.name && <span>{uzg.project.name}</span>}
                            {uzg.assigned_to && <span>→ {getName(uzg.assigned_to)}</span>}
                            {(uzg.participants?.length || 0) > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{uzg.participants!.length} os.</span>}
                            {uzg.sla_deadline && <span className={overdue ? 'text-red-600 font-medium' : ''}>⏱ {overdue ? 'PRZEKROCZONO' : fmtDate(uzg.sla_deadline)}</span>}
                            {(uzg.photos?.length || 0) > 0 && <span>📸 {uzg.photos!.length}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[uzg.status]}`}>{STATUS_LABELS[uzg.status]}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_BADGE[uzg.priority]}`}>{PRIORITY_LABELS[uzg.priority]}</span>
                        </div>
                        {canDecide(uzg) && (
                          <div className="flex gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={e => { e.stopPropagation(); setSelectedUzgodnienie(uzg); setActionType('approve'); setShowActionModal(true); }}
                              className="min-h-[44px] px-3 py-2 bg-green-500 text-white text-xs font-medium rounded-xl hover:bg-green-600">✓</button>
                            <button onClick={e => { e.stopPropagation(); setSelectedUzgodnienie(uzg); setActionType('reject'); setShowActionModal(true); }}
                              className="min-h-[44px] px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-xl hover:bg-red-600">✗</button>
                          </div>
                        )}
                        <button onClick={e => { e.stopPropagation(); if (confirm('Usunąć?')) supabase.from('uzgodnienia').update({ deleted_at: new Date().toISOString() }).eq('id', uzg.id).then(() => loadData()); }}
                          className="p-2 hover:bg-red-100 rounded-xl flex-shrink-0">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-2xl">
              <div>
                <h2 className="text-lg font-semibold">{editingUzgodnienie ? 'Edytuj' : 'Nowe uzgodnienie'}</h2>
                {!editingUzgodnienie && (
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3].map(s => <div key={s} className={`h-1.5 rounded-full transition-all ${s === createStep ? 'w-8 bg-blue-600' : s < createStep ? 'w-4 bg-green-400' : 'w-4 bg-slate-200'}`} />)}
                    <span className="text-xs text-slate-400 ml-1">Krok {createStep}/3</span>
                  </div>
                )}
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Step 1: Photo + Template */}
              {createStep === 1 && !editingUzgodnienie && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">📸 Zdjęcia z obiektu</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button type="button" onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-blue-700 hover:bg-blue-100 min-h-[80px] font-medium">
                        <Camera className="w-6 h-6" /><span className="text-sm">Zrób zdjęcie</span>
                      </button>
                      <button type="button" onClick={() => photoInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100 min-h-[80px]">
                        <Image className="w-6 h-6" /><span className="text-sm">Z galerii</span>
                      </button>
                    </div>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => e.target.files && handlePhotoAdd(Array.from(e.target.files))} />
                    <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={e => e.target.files && handlePhotoAdd(Array.from(e.target.files))} />
                    {photoPreviewUrls.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {photoPreviewUrls.map((url, i) => (
                          <div key={i} className="relative">
                            <img src={url} className="w-full h-20 object-cover rounded-xl border border-slate-200" />
                            <button type="button" onClick={() => removePhoto(i)}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">⚡ Szybkie szablony</label>
                    <div className="space-y-2">
                      {QUESTION_TEMPLATES.map(t => (
                        <button key={t.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, title: t.value, template_type: t.id })); setCreateStep(2); }}
                          className={`w-full text-left px-3 py-3 rounded-xl border text-sm min-h-[48px] ${form.template_type === t.id ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-slate-200 hover:bg-slate-50'}`}>
                          {t.label}
                        </button>
                      ))}
                      <button type="button" onClick={() => { setForm(f => ({ ...f, template_type: 'custom' })); setCreateStep(2); }}
                        className={`w-full text-left px-3 py-3 rounded-xl border text-sm min-h-[48px] ${form.template_type === 'custom' ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-slate-200 hover:bg-slate-50'}`}>
                        ✏️ Własne pytanie...
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Title + Details */}
              {createStep === 2 && !editingUzgodnienie && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł pytania *</label>
                    <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="Opisz pytanie lub problem..." autoFocus
                      className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm min-h-[48px]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Opis (opcjonalnie)</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      rows={3} placeholder="Szczegóły..." className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                      <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[44px]">
                        <option value="">-- Wybierz --</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Pilność</label>
                      <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as UzgodnienePriority, sla_hours: PRIORITY_SLA[e.target.value as UzgodnienePriority] })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[44px]">
                        <option value="low">🟢 Niski (72h)</option>
                        <option value="normal">🔵 Normalny (48h)</option>
                        <option value="high">🟠 Pilny (24h)</option>
                        <option value="urgent">🔴 Krytyczny (4h)</option>
                      </select>
                    </div>
                  </div>
                  {(form.priority === 'high' || form.priority === 'urgent') && (
                    <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${form.priority === 'urgent' ? 'bg-red-50 border border-red-200 text-red-700 font-medium' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                      {form.priority === 'urgent' ? <AlertTriangle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      {form.priority === 'urgent' ? 'KRYTYCZNE — SLA tylko 4 godziny!' : 'Pilne — natychmiastowe powiadomienie!'}
                    </div>
                  )}
                </>
              )}

              {/* Step 3: Assign + Annotation */}
              {createStep === 3 && !editingUzgodnienie && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tryb zatwierdzenia</label>
                    <div className="space-y-2">
                      {(['single', 'all', 'any'] as ApprovalMode[]).map(mode => (
                        <button key={mode} type="button" onClick={() => setApprovalMode(mode)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm min-h-[44px] ${approvalMode === mode ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-slate-200 hover:bg-slate-50'}`}>
                          {APPROVAL_MODE_LABELS[mode]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {approvalMode === 'single' ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Odpowiedzialny</label>
                      <select value={form.assigned_to_id} onChange={e => setForm({ ...form, assigned_to_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[44px]">
                        <option value="">-- Wybierz --</option>
                        {usersList.map((u: any) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Uczestnicy ({groupParticipants.length})</label>
                      <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2">
                        {usersList.filter((u: any) => u.id !== currentUser?.id).map((u: any) => (
                          <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={groupParticipants.includes(u.id)}
                              onChange={e => setGroupParticipants(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                              className="w-4 h-4 rounded" />
                            <span className="text-sm">{u.first_name} {u.last_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">📍 Oznaczenie na planie (opcjonalnie)</label>
                    <input type="url" value={form.plan_screenshot_url}
                      onChange={e => { setForm({ ...form, plan_screenshot_url: e.target.value }); setAnnotations([]); }}
                      placeholder="URL planu/rysunku..." className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2" />
                    {form.plan_screenshot_url && (
                      <CanvasAnnotator imageUrl={form.plan_screenshot_url} annotations={annotations} onChange={setAnnotations} />
                    )}
                  </div>
                </>
              )}

              {/* Edit form (all fields at once) */}
              {editingUzgodnienie && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł *</label>
                    <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Projekt</label>
                      <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm">
                        <option value="">--</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Pilność</label>
                      <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as UzgodnienePriority })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm">
                        {(Object.entries(PRIORITY_LABELS) as [UzgodnienePriority, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t flex gap-3 bg-white">
              {!editingUzgodnienie && createStep > 1 && (
                <button onClick={() => setCreateStep(s => (s - 1) as any)} className="px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 min-h-[52px]">← Wstecz</button>
              )}
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 min-h-[52px]">Anuluj</button>
              <div className="flex-1" />
              {!editingUzgodnienie && createStep < 3 ? (
                <button onClick={() => { if (createStep === 2 && !form.title) return; setCreateStep(s => (s + 1) as any); }}
                  disabled={createStep === 2 && !form.title}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 min-h-[52px]">
                  Dalej →
                </button>
              ) : (
                <button onClick={handleSave} disabled={!form.title || saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 min-h-[52px]">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {editingUzgodnienie ? 'Zapisz' : 'Wyślij'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {showDetailModal && selectedUzgodnienie && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-2xl">
              <div className="flex-1 mr-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-900 truncate">{selectedUzgodnienie.title}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${STATUS_COLORS[selectedUzgodnienie.status]}`}>{STATUS_LABELS[selectedUzgodnienie.status]}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${PRIORITY_BADGE[selectedUzgodnienie.priority]}`}>{PRIORITY_LABELS[selectedUzgodnienie.priority]}</span>
                </div>
                {selectedUzgodnienie.number && <p className="text-xs text-slate-400">{selectedUzgodnienie.number}</p>}
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-100 rounded-xl flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                <div><span className="text-slate-500">Projekt:</span><span className="ml-1 font-medium">{selectedUzgodnienie.project?.name || '—'}</span></div>
                <div><span className="text-slate-500">Tryb:</span><span className="ml-1 font-medium">{APPROVAL_MODE_LABELS[selectedUzgodnienie.approval_mode || 'single']}</span></div>
                <div><span className="text-slate-500">Autor:</span><span className="ml-1 font-medium">{getName(selectedUzgodnienie.created_by)}</span></div>
                <div><span className="text-slate-500">SLA:</span><span className={`ml-1 font-medium ${isOverdue(selectedUzgodnienie) ? 'text-red-600' : ''}`}>{selectedUzgodnienie.sla_deadline ? fmtDT(selectedUzgodnienie.sla_deadline) : '—'}{isOverdue(selectedUzgodnienie) && ' ⚠️'}</span></div>
              </div>

              {selectedUzgodnienie.description && <div className="p-3 bg-blue-50 rounded-xl text-sm">{selectedUzgodnienie.description}</div>}

              {/* Group participants */}
              {selectedUzgodnienie.approval_mode !== 'single' && detailParticipants.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Uczestnicy</h3>
                  <div className="space-y-2">
                    {detailParticipants.map(p => (
                      <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${p.decision === 'approved' ? 'bg-green-50 border-green-200' : p.decision === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${p.decision === 'approved' ? 'bg-green-500 text-white' : p.decision === 'rejected' ? 'bg-red-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                          {p.decision === 'approved' ? '✓' : p.decision === 'rejected' ? '✗' : '?'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{getName(p.user)}</p>
                          {p.comment && <p className="text-xs text-slate-500">{p.comment}</p>}
                          {p.decided_at && <p className="text-xs text-slate-400">{fmtDT(p.decided_at)}</p>}
                        </div>
                        {!p.decision && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Oczekuje</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Canvas */}
              {selectedUzgodnienie.plan_screenshot_url && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Lokalizacja na planie</h3>
                  <CanvasAnnotator
                    imageUrl={selectedUzgodnienie.plan_screenshot_url}
                    annotations={selectedUzgodnienie.plan_annotations || (selectedUzgodnienie.plan_x != null ? [{ type: 'point', x: selectedUzgodnienie.plan_x!, y: selectedUzgodnienie.plan_y! }] : [])}
                    onChange={() => {}} readOnly
                  />
                </div>
              )}

              {/* Photos */}
              {selectedUzgodnienie.photos && selectedUzgodnienie.photos.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Image className="w-4 h-4" /> Zdjęcia ({selectedUzgodnienie.photos.length})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedUzgodnienie.photos.map(p => (
                      <img key={p.id} src={p.url} className="w-full h-24 sm:h-28 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90" onClick={() => window.open(p.url, '_blank')} />
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Historia</h3>
                {detailHistory.length === 0
                  ? <p className="text-sm text-slate-400">Brak historii</p>
                  : <div className="space-y-2">{detailHistory.map(h => (
                    <div key={h.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-slate-500" /></div>
                      <div className="flex-1 pb-3">
                        <div className="flex flex-wrap items-center gap-1 text-sm">
                          <span className="font-medium">{getName(h.user)}</span>
                          <span className="text-slate-500">{ACTION_LABELS[h.action] || h.action}</span>
                          {h.to_status && <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[h.to_status]}`}>{STATUS_LABELS[h.to_status]}</span>}
                        </div>
                        {h.comment && <p className="text-sm text-slate-600 mt-1 bg-slate-50 px-2 py-1 rounded-lg">{h.comment}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDT(h.created_at)}</p>
                      </div>
                    </div>
                  ))}</div>
                }
              </div>
            </div>

            {canDecide(selectedUzgodnienie) && (
              <div className="p-4 border-t grid grid-cols-2 gap-2 bg-white">
                <button onClick={() => { setActionType('approve'); setShowActionModal(true); }}
                  className="flex items-center justify-center gap-2 py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 min-h-[56px]">
                  <CheckCircle className="w-5 h-5" /> Zatwierdź
                </button>
                <button onClick={() => { setActionType('reject'); setShowActionModal(true); }}
                  className="flex items-center justify-center gap-2 py-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 min-h-[56px]">
                  <XCircle className="w-5 h-5" /> Odrzuć
                </button>
                <button onClick={() => { setActionType('delegate'); setShowActionModal(true); }}
                  className="flex items-center justify-center gap-2 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 min-h-[48px]">
                  <ArrowRight className="w-4 h-4" /> Deleguj
                </button>
                <button onClick={() => { setActionType('comment'); setShowActionModal(true); }}
                  className="flex items-center justify-center gap-2 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 min-h-[48px]">
                  <MessageSquare className="w-4 h-4" /> Komentarz
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTION MODAL ── */}
      {showActionModal && selectedUzgodnienie && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[60]">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {actionType === 'approve' ? '✅ Zatwierdzam' : actionType === 'reject' ? '❌ Odrzucam' : actionType === 'delegate' ? '➡️ Deleguj' : '💬 Komentarz'}
              </h2>
              <button onClick={() => setShowActionModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600"><strong>{selectedUzgodnienie.title}</strong></p>
              {actionType === 'delegate' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deleguj do *</label>
                  <select value={delegateTo} onChange={e => setDelegateTo(e.target.value)}
                    className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm min-h-[48px]">
                    <option value="">-- Wybierz --</option>
                    {usersList.filter((u: any) => u.id !== currentUser?.id).map((u: any) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Komentarz {actionType === 'comment' ? '*' : '(opcjonalnie)'}</label>
                <textarea value={actionComment} onChange={e => setActionComment(e.target.value)}
                  rows={3} placeholder={actionType === 'approve' ? 'Zatwierdzono...' : actionType === 'reject' ? 'Powód odrzucenia...' : 'Komentarz...'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" />
              </div>
            </div>
            <div className="p-4 border-t grid grid-cols-2 gap-3">
              <button onClick={() => setShowActionModal(false)} className="py-3 border border-slate-200 rounded-xl hover:bg-slate-50 min-h-[52px]">Anuluj</button>
              <button onClick={handleAction}
                disabled={processing || (actionType === 'delegate' && !delegateTo) || (actionType === 'comment' && !actionComment)}
                className={`flex items-center justify-center gap-2 py-3 text-white rounded-xl font-semibold disabled:opacity-40 min-h-[52px] ${actionType === 'approve' ? 'bg-green-500 hover:bg-green-600' : actionType === 'reject' ? 'bg-red-500 hover:bg-red-600' : actionType === 'delegate' ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : actionType === 'approve' ? <CheckCircle className="w-5 h-5" /> : actionType === 'reject' ? <XCircle className="w-5 h-5" /> : actionType === 'delegate' ? <ArrowRight className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                {actionType === 'approve' ? 'Zatwierdź' : actionType === 'reject' ? 'Odrzuć' : actionType === 'delegate' ? 'Deleguj' : 'Wyślij'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
