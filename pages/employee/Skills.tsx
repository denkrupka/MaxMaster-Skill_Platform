
import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Award, CheckCircle, Wallet, Clock, Lock, ChevronDown, ChevronUp, 
    BookOpen, Video, FileText, AlertTriangle, TrendingUp, Calendar, Layers, ChevronRight,
    X, ExternalLink, Play, Plus, Upload, Eye, RotateCcw, Camera, List
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SkillStatus, VerificationType, SkillCategory, LibraryResource } from '../../types';
import { Button } from '../../components/Button';
import { CHECKLIST_TEMPLATES, SKILL_STATUS_LABELS, BONUS_DOCUMENT_TYPES } from '../../constants';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';
import { uploadDocument } from '../../lib/supabase';

export const EmployeeSkills = () => {
    const { state, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus } = useAppContext();
    const { currentUser, userSkills, skills, tests, libraryResources, testAttempts, qualityIncidents } = state;
    const navigate = useNavigate();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
    const [openSections, setOpenSections] = useState({
        confirmed: true,
        verification: true,
        development: true,
        documents: false
    });

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [resourceModal, setResourceModal] = useState<{ isOpen: boolean; skillTitle: string; resources: LibraryResource[]; }>({ isOpen: false, skillTitle: '', resources: [] });
    const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; testId: string | null }>({ isOpen: false, testId: null });

    const [docsViewMode, setDocsViewMode] = useState<'active' | 'archived'>('active');
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [newDocData, setNewDocData] = useState({ 
        typeId: '',
        customName: '', 
        issue_date: new Date().toISOString().split('T')[0], 
        expires_at: '', 
        indefinite: false,
        files: [] as File[]
    });
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    if (!currentUser) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const toggleSection = (key: keyof typeof openSections) => { setOpenSections(prev => ({ ...prev, [key]: !prev[key] })); };
    const toggleCategory = (sectionKey: string, category: string) => { const key = `${sectionKey}-${category}`; setOpenCategories(prev => ({ ...prev, [key]: !prev[key] })); };

    const categorizedSkills = useMemo(() => {
        const confirmed: any[] = []; const verification: any[] = []; const development: any[] = [];
        skills.forEach(skill => {
            if (!skill.is_active || skill.is_archived) return;
            const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === skill.id);
            let status = userSkill?.status;
            const test = tests.find(t => t.skill_ids.includes(skill.id));
            if (test) {
                const hasPassed = testAttempts.some(ta => ta.user_id === currentUser.id && ta.test_id === test.id && ta.passed);
                if (hasPassed && (!status || status === SkillStatus.PENDING)) {
                    status = (skill.verification_type === VerificationType.THEORY_ONLY) ? SkillStatus.CONFIRMED : SkillStatus.THEORY_PASSED;
                }
            }
            const skillData = { ...skill, userSkill: userSkill || { status, user_id: currentUser.id, skill_id: skill.id, id: 'virtual' } };
            if (status === SkillStatus.CONFIRMED) confirmed.push(skillData);
            else if (status === SkillStatus.THEORY_PASSED || status === SkillStatus.PRACTICE_PENDING) verification.push(skillData);
            else if (skill.category !== SkillCategory.UPRAWNIENIA && skill.verification_type !== VerificationType.DOCUMENT) development.push(skillData);
        });
        return { confirmed, verification, development };
    }, [skills, userSkills, currentUser.id, testAttempts, tests]);

    const myDocuments = useMemo(() => {
        return userSkills.filter(us => us.user_id === currentUser.id).map(us => {
                const skill = skills.find(s => s.id === us.skill_id);
                const isDoc = (skill?.verification_type === VerificationType.DOCUMENT) || (us.skill_id && typeof us.skill_id === 'string' && (us.skill_id.startsWith('doc_') || us.custom_type === 'doc_generic')) || !us.skill_id;
                if (isDoc) return { ...us, docName: us.custom_name || (skill ? skill.name_pl : 'Dokument'), bonus: skill ? skill.hourly_bonus : (us.bonus_value || 0), fileCount: us.document_urls ? us.document_urls.length : (us.document_url ? 1 : 0) };
                return null;
            }).filter(Boolean) as any[];
    }, [currentUser, userSkills, skills]);

    const handleAddDocument = () => {
        setEditingDocId(null);
        setNewDocData({ typeId: '', customName: '', issue_date: new Date().toISOString().split('T')[0], expires_at: '', indefinite: false, files: [] });
        setIsDocModalOpen(true);
    };

    const handleEditDocument = (docId: string) => {
        const doc = userSkills.find(us => us.id === docId);
        if(!doc) return;
        setEditingDocId(docId);
        setNewDocData({ typeId: 'other', customName: doc.custom_name || doc.document_url || '', issue_date: doc.issue_date || new Date().toISOString().split('T')[0], expires_at: doc.expires_at || '', indefinite: doc.is_indefinite || false, files: [] });
        setIsDocModalOpen(true);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) setNewDocData(prev => ({ ...prev, files: [...prev.files, ...selectedFiles] }));
    };

    const removeFile = (index: number) => { setNewDocData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) })); };

    const handleSaveDocument = async () => {
        if(!currentUser) return;
        const selectedType = BONUS_DOCUMENT_TYPES.find(t => t.id === newDocData.typeId);
        const docName = newDocData.typeId === 'other' || editingDocId ? newDocData.customName : (selectedType?.label || 'Dokument');
        const bonus = selectedType?.bonus || 0;
        if (!docName) return alert("Podaj nazwę dokumentu.");
        const docPayload: any = { custom_name: docName, issue_date: newDocData.issue_date || null, expires_at: newDocData.indefinite ? null : (newDocData.expires_at || null), is_indefinite: newDocData.indefinite };
        if (newDocData.files.length > 0) {
             const uploadedUrls: string[] = [];
             for (const file of newDocData.files) {
                 const url = await uploadDocument(file, currentUser.id);
                 if (url) uploadedUrls.push(url);
             }
             if (uploadedUrls.length > 0) { docPayload.document_urls = uploadedUrls; docPayload.document_url = uploadedUrls[0]; }
        }
        try {
            if (editingDocId) await updateCandidateDocumentDetails(editingDocId, docPayload);
            else await addCandidateDocument(currentUser.id, { skill_id: crypto.randomUUID(), custom_type: 'doc_generic', status: SkillStatus.PENDING, bonus_value: bonus, ...docPayload });
            setIsDocModalOpen(false);
        } catch (error) { console.error("Error saving document:", error); alert("Błąd podczas zapisywania dokumentu."); }
    };

    const openFileViewer = (doc: any) => {
        const urls = doc.document_urls && doc.document_urls.length > 0 ? doc.document_urls : (doc.document_url ? [doc.document_url] : []);
        setFileViewer({ isOpen: true, urls, title: doc.docName, index: 0 });
    };

    const getQualityStatus = (us: any) => {
        const incidents = qualityIncidents.filter(inc => {
            const d = new Date(inc.date);
            return inc.user_id === currentUser.id && inc.skill_id === us.skill_id && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        if (incidents.length >= 2) return { status: 'blocked', label: 'Zablokowane', color: 'bg-red-100 text-red-700' };
        if (incidents.length === 1) return { status: 'warning', label: 'Ostrzeżenie', color: 'bg-yellow-100 text-yellow-700' };
        return { status: 'active', label: 'Aktywne', color: 'bg-green-100 text-green-700' };
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
            <h1 className="text-2xl font-bold">Umiejętności i Uprawnienia</h1>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button onClick={() => toggleSection('confirmed')} className="w-full px-6 py-4 flex items-center justify-between bg-slate-50"><div className="flex items-center gap-3"><CheckCircle className="text-green-600" size={24}/><h2 className="text-lg font-bold">Zaliczone Kompetencje</h2></div>{openSections.confirmed ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
                {openSections.confirmed && (<div className="p-6">{categorizedSkills.confirmed.map(item => (<div key={item.id} className="p-4 border rounded-xl mb-4 flex justify-between items-center"><div><div className="font-bold">{item.name_pl}</div><div className={`text-xs px-2 py-0.5 rounded w-fit mt-1 ${getQualityStatus(item.userSkill).color}`}>{getQualityStatus(item.userSkill).label}</div></div><div className="font-bold text-green-600">+{item.hourly_bonus} zł/h</div></div>))}</div>)}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button onClick={() => toggleSection('documents')} className="w-full px-6 py-4 flex items-center justify-between bg-slate-50"><div className="flex items-center gap-3"><FileText className="text-purple-600" size={24}/><h2 className="text-lg font-bold">Dokumenty i Uprawnienia</h2></div>{openSections.documents ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
                {openSections.documents && (<div className="p-6">
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            {myDocuments.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white border rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <FileText size={20} className="text-purple-600"/>
                                        <div>
                                            <h4 className="font-bold">{doc.docName}</h4>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs uppercase font-bold">{SKILL_STATUS_LABELS[doc.status]}</span>
                                                {doc.bonus > 0 && <span className={`text-xs font-bold ${doc.status === SkillStatus.CONFIRMED ? 'text-green-600' : 'text-slate-300'}`}>• +{doc.bonus.toFixed(2)} zł/h</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2"><button className="text-blue-600 text-xs font-bold" onClick={() => openFileViewer(doc)}>Zobacz</button><button className="text-slate-500 text-xs font-bold" onClick={() => handleEditDocument(doc.id)}>Edytuj</button></div>
                                </div>
                            ))}
                        </div>
                        <Button fullWidth variant="outline" onClick={handleAddDocument}><Plus size={18} className="mr-2"/> Dodaj Nowy Dokument</Button>
                    </div>)}
            </div>
            {isDocModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Dodaj Dokument</h2><button onClick={() => setIsDocModalOpen(false)}><X size={24}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-bold mb-1">Typ</label><select className="w-full border p-2 rounded bg-white" value={newDocData.typeId} onChange={e => setNewDocData({...newDocData, typeId: e.target.value})}>{BONUS_DOCUMENT_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></div>
                            {(newDocData.typeId === 'other' || editingDocId) && <input className="w-full border p-2 rounded" placeholder="Nazwa..." value={newDocData.customName} onChange={e => setNewDocData({...newDocData, customName: e.target.value})} />}
                            <div><label className="block text-sm font-bold mb-1">Pliki</label><input type="file" multiple onChange={handleFileSelect} className="w-full border p-2 rounded text-sm"/><div className="mt-2 space-y-1">{newDocData.files.map((f, i) => (<div key={i} className="flex justify-between items-center bg-slate-100 p-1.5 rounded text-xs"><span>{f.name}</span><button onClick={() => removeFile(i)} className="text-red-500"><X size={14}/></button></div>))}</div></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold mb-1">Wydanie (Od)</label><input type="date" className="w-full border p-2 rounded" value={newDocData.issue_date} onChange={e => setNewDocData({...newDocData, issue_date: e.target.value})}/></div>
                                {!newDocData.indefinite && <div><label className="block text-sm font-bold mb-1">Ważność (Do)</label><input type="date" className="w-full border p-2 rounded" value={newDocData.expires_at} onChange={e => setNewDocData({...newDocData, expires_at: e.target.value})}/></div>}
                            </div>
                            <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded"><input type="checkbox" id="indef_emp" checked={newDocData.indefinite} onChange={e => setNewDocData({...newDocData, indefinite: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" /><label htmlFor="indef_emp" className="text-sm text-slate-700 font-medium">Bezterminowy</label></div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6"><Button variant="ghost" onClick={() => setIsDocModalOpen(false)}>Anuluj</Button><Button onClick={handleSaveDocument}>Zapisz</Button></div>
                    </div>
                </div>
            )}
            <DocumentViewerModal isOpen={fileViewer.isOpen} onClose={() => setFileViewer({ ...fileViewer, isOpen: false })} urls={fileViewer.urls} title={fileViewer.title} />
        </div>
    );
};
