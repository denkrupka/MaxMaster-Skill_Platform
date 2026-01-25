
import React, { useState, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, ExternalLink, FileText, Video, Link as LinkIcon, ChevronDown, ChevronUp, ChevronRight, X, Archive, RotateCcw, AlertTriangle, Image as ImageIcon, Type, Sparkles, Layers, Save, Camera, Paperclip, FileCheck, Loader2, Eye, Download, Search } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { LibraryResource, Skill, SkillStatus } from '../../types';
import { uploadDocument } from '../../lib/supabase';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

export const HRLibraryPage = () => {
    const { state, addLibraryResource, updateLibraryResource, deleteLibraryResource } = useAppContext();
    const { systemConfig, skills, libraryResources } = state;
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    
    // Accordion State
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [activeSkillId, setActiveSkillId] = useState<string | null>(null);

    // Modal States
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Partial<LibraryResource> | null>(null);
    const [localFiles, setLocalFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<LibraryResource | null>(null);

    // Skills Selector State
    const [skillSearch, setSkillSearch] = useState('');

    // Carousel for HR Preview
    const [previewViewer, setPreviewViewer] = useState<{isOpen: boolean, urls: string[], index: number, title?: string}>({ 
        isOpen: false, urls: [], title: '', index: 0 
    });

    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        actionLabel: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', actionLabel: '', onConfirm: () => {} });

    // Inputs Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helpers
    const getYoutubeEmbedUrl = (url?: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
    };

    // Data Processing - Using dynamic categories from systemConfig
    const hierarchy = useMemo(() => {
        const groups: Record<string, Record<string, LibraryResource[]>> = {};
        const resources = libraryResources.filter(r => viewMode === 'archived' ? r.is_archived : !r.is_archived);

        // Initialize with dynamic categories
        (systemConfig.skillCategories || []).forEach(cat => {
            groups[cat] = {};
        });

        resources.forEach(res => {
            const resourceCategories = (res.categories && res.categories.length > 0) 
                ? res.categories 
                : [res.category || (systemConfig.skillCategories[systemConfig.skillCategories.length-1] || 'INNE')];

            resourceCategories.forEach(cat => {
                if (!groups[cat]) groups[cat] = {};

                const relevantSkills = res.skill_ids?.filter(sid => {
                    const skill = skills.find(s => s.id === sid);
                    return skill?.category === cat;
                }) || [];

                if (relevantSkills.length === 0) {
                    if (!groups[cat]['general']) groups[cat]['general'] = [];
                    if (!groups[cat]['general'].includes(res)) {
                        groups[cat]['general'].push(res);
                    }
                } else {
                    relevantSkills.forEach(skillId => {
                        if (!groups[cat][skillId]) groups[cat][skillId] = [];
                        if (!groups[cat][skillId].includes(res)) {
                            groups[cat][skillId].push(res);
                        }
                    });
                }
            });
        });

        return groups;
    }, [libraryResources, viewMode, skills, systemConfig.skillCategories]);

    // Group available skills for selector
    const skillsByCategory = useMemo(() => {
        const groups: Record<string, Skill[]> = {};
        skills.filter(s => !s.is_archived).forEach(s => {
            if (!groups[s.category]) groups[s.category] = [];
            groups[s.category].push(s);
        });
        return groups;
    }, [skills]);

    // Actions
    const handleOpenEditor = (res?: LibraryResource) => {
        setLocalFiles([]);
        setSkillSearch('');
        if (res) {
            setEditingResource({ ...res, categories: res.categories || [res.category] });
        } else {
            setEditingResource({ 
                title: '', 
                description: '',
                type: 'mixed', 
                category: systemConfig.skillCategories[0] || 'INNE', 
                categories: [systemConfig.skillCategories[0] || 'INNE'],
                url: '', 
                videoUrl: '',
                imageUrl: '',
                file_urls: [],
                textContent: '',
                skill_ids: [],
                is_archived: false
            });
        }
        setIsEditorOpen(true);
        if(isDetailOpen) setIsDetailOpen(false);
    };

    const handleSaveResource = async () => {
        const res = editingResource;
        if (!res || !res.title) return;

        setIsUploading(true);
        const resourceId = res.id || crypto.randomUUID();

        // 1. Upload new local files in parallel (not sequentially)
        let newlyUploadedUrls: string[] = [];
        const filesToUpload: File[] = localFiles || [];
        if (filesToUpload.length > 0) {
            console.log(`Uploading ${filesToUpload.length} files in parallel...`);
            try {
                const uploadPromises = filesToUpload.map(file =>
                    uploadDocument(file, 'library/' + resourceId)
                );
                const results = await Promise.all(uploadPromises);
                newlyUploadedUrls = results.filter((url): url is string => url !== null);

                if (newlyUploadedUrls.length < filesToUpload.length) {
                    const failedCount = filesToUpload.length - newlyUploadedUrls.length;
                    console.warn(`${failedCount} file(s) failed to upload`);
                    alert(`Uwaga: ${failedCount} plik(ów) nie udało się przesłać. Pozostałe dane zostaną zapisane.`);
                }
            } catch (uploadError) {
                console.error('File upload error:', uploadError);
                alert('Błąd podczas przesyłania plików. Spróbuj ponownie.');
                setIsUploading(false);
                return;
            }
        }

        // 2. Merge with existing file_urls
        const existingFileUrls: string[] = Array.isArray(res.file_urls) ? (res.file_urls as string[]) : [];
        const finalFileUrls = [...existingFileUrls, ...newlyUploadedUrls];

        // 3. Derive categories from skills
        const selectedSkillIds = (res.skill_ids as string[]) || [];
        const derivedCategories = new Set<string>();
        selectedSkillIds.forEach(sid => {
            const skill = skills.find(s => s.id === sid);
            if (skill) derivedCategories.add(skill.category);
        });

        const defaultCat = systemConfig.skillCategories[0] || 'INNE';
        const cats = derivedCategories.size > 0 ? Array.from(derivedCategories) : [res.category || defaultCat];

        const resourceToSave = {
            ...res,
            id: resourceId,
            categories: cats,
            category: cats[0],
            file_urls: finalFileUrls,
            imageUrl: finalFileUrls.find(u => u && u.match(/\.(jpeg|jpg|gif|png)$/i)) || res.imageUrl || '',
            url: res.url || ''
        } as LibraryResource;

        try {
            console.log('Saving resource:', resourceToSave);
            if (res.id) {
                console.log('Updating existing resource...');
                await updateLibraryResource(res.id, resourceToSave);
            } else {
                console.log('Adding new resource...');
                await addLibraryResource(resourceToSave);
            }
            console.log('Resource saved successfully');
        } catch (error: any) {
            console.error('Error saving resource:', error);
            const errorMessage = error.message?.includes('timed out')
                ? 'Przekroczono limit czasu. Sprawdź połączenie i spróbuj ponownie.'
                : 'Błąd podczas zapisywania materiału. Spróbuj ponownie.';
            alert(errorMessage);
            setIsUploading(false);
            return;
        }

        setIsUploading(false);
        setIsEditorOpen(false);
        setEditingResource(null);
        setLocalFiles([]);
    };

    const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setLocalFiles(prev => [...(Array.isArray(prev) ? prev : []), ...files]);
        }
    };

    const removeLocalFile = (index: number) => {
        setLocalFiles(prev => (Array.isArray(prev) ? prev.filter((_, i) => i !== index) : []));
    };

    const removeRemoteFile = (url: string) => {
        if (editingResource) {
            setEditingResource({
                ...editingResource,
                file_urls: (Array.isArray(editingResource.file_urls) ? (editingResource.file_urls as string[]) : []).filter(u => u !== url)
            });
        }
    };

    const toggleSkillId = (id: string) => {
        if (!editingResource) return;
        const current = (editingResource.skill_ids as string[]) || [];
        const updated = current.includes(id) ? current.filter(sid => sid !== id) : [...current, id];
        setEditingResource({ ...editingResource, skill_ids: updated });
    };

    const handleArchiveResource = (res: LibraryResource) => {
        setConfirmation({
            isOpen: true,
            title: "Archiwizacja Materiału",
            message: "Czy na pewno chcesz usunąć ten materiał? Zostanie on przeniesiony do archiwum.",
            actionLabel: "Usuń (Archiwizuj)",
            onConfirm: async () => {
                try {
                    await updateLibraryResource(res.id, { is_archived: true });
                    setIsDetailOpen(false);
                    setSelectedResource(null);
                } catch (error) {
                    console.error('Error archiving resource:', error);
                }
            }
        });
    };

    // Explicitly cast to string[] to resolve 'unknown' type errors in TS
    const editingFileUrls: string[] = Array.isArray(editingResource?.file_urls) ? (editingResource?.file_urls as string[]) : [];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {viewMode === 'active' ? 'Biblioteka Materiałów' : 'Archiwum Materiałów'}
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setViewMode(viewMode === 'active' ? 'archived' : 'active')} className="rounded-xl h-11 px-5 border-slate-200 text-slate-600">
                        {viewMode === 'active' ? <><Archive size={18} className="mr-2"/> Archiwum</> : <><RotateCcw size={18} className="mr-2"/> Powrót</>}
                    </Button>
                    {viewMode === 'active' && <Button onClick={() => handleOpenEditor()} className="rounded-xl h-11 px-6 font-black shadow-lg shadow-blue-600/20"><Plus size={18} className="mr-2"/> Dodaj Materiał</Button>}
                </div>
            </div>

            {/* Hierarchical List */}
            <div className="space-y-4">
                {Object.keys(hierarchy).map(cat => {
                    const skillGroups = hierarchy[cat];
                    const hasResources = Object.values(skillGroups).some(list => list.length > 0);
                    if (!hasResources) return null;

                    return (
                        <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <button 
                                className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
                                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                            >
                                <span className="font-bold text-slate-800 uppercase text-xs tracking-widest">{cat}</span>
                                {activeCategory === cat ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </button>
                            
                            {activeCategory === cat && (
                                <div className="divide-y divide-slate-100 border-t border-slate-100">
                                    {Object.keys(skillGroups).map(skillId => {
                                        const skill = skills.find(s => s.id === skillId);
                                        const skillName = skill ? skill.name_pl : (skillId === 'general' ? 'Ogólne / Pomoc' : 'Inne');
                                        const resources = skillGroups[skillId];
                                        if (resources.length === 0) return null;

                                        return (
                                            <div key={skillId} className="bg-white">
                                                <button 
                                                    className="w-full px-6 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors pl-10"
                                                    onClick={() => setActiveSkillId(activeSkillId === skillId ? null : skillId)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700 text-sm">{skillName}</span>
                                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-black text-slate-400">{resources.length}</span>
                                                    </div>
                                                    {activeSkillId === skillId ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                                                </button>

                                                {activeSkillId === skillId && (
                                                    <div className="bg-slate-50/50 divide-y divide-slate-100">
                                                        {resources.map(res => (
                                                            <div 
                                                                key={res.id} 
                                                                className="px-6 py-3 pl-16 flex justify-between items-center hover:bg-blue-50 cursor-pointer transition-colors group"
                                                                onClick={() => { setSelectedResource(res); setIsDetailOpen(true); }}
                                                            >
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-slate-900 font-medium text-sm">{res.title}</span>
                                                                        {res.is_archived && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 rounded font-black uppercase tracking-widest">Archiwum</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-slate-300 group-hover:text-blue-500 transition-colors">
                                                                    {res.videoUrl && <Video size={14} />}
                                                                    {/* Fix: Explicitly cast file_urls to any[] to resolve 'unknown' type errors for length check */}
                                                                    {(res.imageUrl || (Array.isArray(res.file_urls) && (res.file_urls as any[]).length > 0)) && <ImageIcon size={14} />}
                                                                    <ChevronRight size={18}/>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Editor Modal */}
            {isEditorOpen && editingResource && (
                <div className="fixed inset-0 bg-black/70 z-[250] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-5xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300">
                        <div className="bg-[#1A1C1E] px-6 py-5 flex justify-between items-center text-white">
                            <h2 className="text-xl font-black tracking-tight uppercase">
                                {editingResource.id ? 'Edytuj Materiał' : 'Dodaj Nowy Materiał'}
                            </h2>
                            <button onClick={() => setIsEditorOpen(false)} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-white scrollbar-hide">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">NAZWA MATERIAŁU</label>
                                        <input 
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                            value={editingResource.title} 
                                            onChange={e => setEditingResource({...editingResource, title: e.target.value})} 
                                            placeholder="np. Instrukcja montażu gniazd..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">KATEGORIA GŁÓWNA</label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl font-bold text-slate-800 outline-none appearance-none focus:bg-white transition-all shadow-inner"
                                            value={editingResource.category}
                                            onChange={e => setEditingResource({...editingResource, category: e.target.value, categories: [e.target.value]})}
                                        >
                                            {systemConfig.skillCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">TREŚĆ MATERIAŁU (TEKST)</label>
                                        <textarea 
                                            className="w-full bg-slate-50 border border-slate-200 p-4 rounded-[24px] font-medium text-slate-700 text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-inner min-h-[300px] scrollbar-hide" 
                                            placeholder="Wpisz treść instrukcji, normy, kroki wykonawcze..."
                                            value={editingResource.textContent || ''} 
                                            onChange={e => setEditingResource({...editingResource, textContent: e.target.value})} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Categorized Skills Multi-selector */}
                                    <div className="bg-slate-50 p-5 rounded-[24px] border border-slate-200 flex flex-col h-[350px]">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">POWIĄZANE UMIEJĘTNOŚCI</h4>
                                        
                                        <div className="relative mb-4">
                                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                            <input 
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                                                placeholder="Szukaj umiejętności..."
                                                value={skillSearch}
                                                onChange={e => setSkillSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
                                            {Object.entries(skillsByCategory).map(([cat, list]) => {
                                                const filteredList = (list as Skill[]).filter(s => s.name_pl.toLowerCase().includes(skillSearch.toLowerCase()));
                                                if (filteredList.length === 0) return null;

                                                return (
                                                    <div key={cat}>
                                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mb-2 border-b border-slate-200 pb-1">{cat}</p>
                                                        <div className="space-y-1">
                                                            {filteredList.map(skill => {
                                                                const isSelected = editingResource?.skill_ids?.includes(skill.id);
                                                                return (
                                                                    <div 
                                                                        key={skill.id}
                                                                        onClick={() => toggleSkillId(skill.id)}
                                                                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-white text-slate-600 hover:text-blue-600'}`}
                                                                    >
                                                                        <span className="text-[11px] font-bold">{skill.name_pl}</span>
                                                                        {isSelected && <FileCheck size={14} />}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-5 rounded-[24px] border border-slate-200 space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">MULTIMEDIA I LINKI</h4>
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Video size={18}/></div>
                                                <input className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2" placeholder="YouTube Link..." value={editingResource.videoUrl || ''} onChange={e => setEditingResource({...editingResource, videoUrl: e.target.value})} />
                                            </div>
                                            <div className="relative">
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><LinkIcon size={18}/></div>
                                                <input className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2" placeholder="Link zewnętrzny (strona WWW)..." value={editingResource.url || ''} onChange={e => setEditingResource({...editingResource, url: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-600/20" disabled={isUploading}>{isUploading ? <Loader2 size={18} className="animate-spin"/> : <Paperclip size={18} />} Załącz obrazy lub PDF</button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" multiple onChange={handleFilesSelect} />
                                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-hide">
                                                {/* Fixed: cast file_urls to any[] to avoid 'unknown' type errors */}
                                                {(editingFileUrls as any[]).map((url, idx) => (
                                                    <div key={`rem-${idx}`} className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-xl shadow-sm">
                                                        <div className="flex items-center gap-2 truncate">
                                                            {url.match(/\.(jpeg|jpg|gif|png)$/i) ? <ImageIcon size={14} className="text-blue-500"/> : <FileText size={14} className="text-orange-500"/>}
                                                            <span className="text-[9px] font-bold text-slate-500 truncate">{url.split('/').pop()}</span>
                                                        </div>
                                                        <button onClick={() => removeRemoteFile(url)} className="p-1 text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                                                    </div>
                                                ))}
                                                {localFiles.map((file, idx) => (
                                                    <div key={`loc-${idx}`} className="flex items-center justify-between p-2 bg-blue-50/50 border border-blue-100 rounded-xl shadow-sm italic"><span className="text-[9px] font-bold text-blue-600 truncate">{file.name} (NOWY)</span><button onClick={() => removeLocalFile(idx)} className="p-1 text-red-400 hover:text-red-600 transition-colors"><X size={14}/></button></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-white border-t border-slate-100 flex justify-end items-center gap-8">
                            <button onClick={() => setIsEditorOpen(false)} className="text-[11px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-colors">ANULUJ</button>
                            <Button 
                                onClick={handleSaveResource} 
                                disabled={!editingResource.title || isUploading}
                                className="h-12 px-10 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/30"
                            >
                                {isUploading ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>}
                                ZAPISZ MATERIAŁ
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail View */}
            {isDetailOpen && selectedResource && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsDetailOpen(false)}>
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-[#1A1C1E] px-8 py-6 flex justify-between items-center text-white">
                            <div>
                                <h3 className="text-2xl font-black tracking-tight leading-tight uppercase">{selectedResource.title}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(selectedResource?.skill_ids || []).map(sid => {
                                        const s = skills.find(sk => sk.id === sid);
                                        return s ? (
                                            <span key={sid} className="bg-blue-600/20 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-blue-500/30">
                                                {s.name_pl}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                            <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
                                <X size={28} />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-white scrollbar-hide">
                            {selectedResource.description && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><FileText size={14}/> Krótki opis</h4>
                                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 font-medium italic shadow-inner">{selectedResource.description}</div>
                                </div>
                            )}

                            {selectedResource.videoUrl && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Video size={14}/> INSTRUKCJA WIDEO</h4>
                                    <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-slate-200">
                                        <iframe src={getYoutubeEmbedUrl(selectedResource.videoUrl)!} className="w-full h-full" allowFullScreen title="Video instruction" />
                                    </div>
                                </div>
                            )}

                            {selectedResource.textContent && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Type size={14}/> TREŚĆ MATERIAŁU</h4>
                                    <div className="prose max-w-none p-8 bg-slate-50 border border-slate-100 rounded-[32px] whitespace-pre-wrap text-slate-700 font-medium leading-relaxed shadow-inner break-words text-base">{selectedResource.textContent}</div>
                                </div>
                            )}

                            {/* Fixed: cast file_urls to any[] to avoid 'unknown' type errors for length check */}
                            {((selectedResource?.file_urls as any[])?.length || 0) > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Paperclip size={14}/> ZAŁĄCZNIKI</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {/* Fixed: cast file_urls to any[] to avoid 'unknown' type errors */}
                                        {(selectedResource?.file_urls as any[] || []).map((url, i) => (
                                            <div key={i} className="group relative h-40 bg-slate-100 rounded-2xl overflow-hidden cursor-pointer border border-slate-200 shadow-sm" onClick={() => setPreviewViewer({ isOpen: true, urls: (selectedResource.file_urls as string[] || []) as string[], index: i })}>
                                                {url.match(/\.(jpeg|jpg|gif|png)$/i) ? <img src={url} alt="file" className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50"><FileText size={40} className="text-orange-400"/><span className="text-[10px] font-black uppercase tracking-widest">Podgląd dokumentu</span></div>}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Eye size={24} /></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-8 py-5 bg-slate-50 border-t flex justify-between items-center">
                            <Button variant="danger" onClick={() => handleArchiveResource(selectedResource)} className="rounded-xl px-6 h-10 font-bold uppercase text-[11px]"><Trash2 size={16} className="mr-2"/> Usuń materiał</Button>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => handleOpenEditor(selectedResource)} className="rounded-xl px-6 h-10 font-bold uppercase text-[11px]"><Edit size={16} className="mr-2"/> Edytuj</Button>
                                <Button onClick={() => setIsDetailOpen(false)} className="rounded-xl px-8 h-10 font-black uppercase text-[11px] tracking-widest">Zamknij</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <DocumentViewerModal 
                isOpen={previewViewer.isOpen} 
                onClose={() => setPreviewViewer({...previewViewer, isOpen: false})} 
                urls={previewViewer.urls} 
                initialIndex={previewViewer.index}
                title="Podgląd załącznika" 
            />

            {confirmation.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 text-center">
                        <AlertTriangle size={48} className="text-red-500 mx-auto mb-4"/>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmation.title}</h3>
                        <p className="text-sm text-slate-500 mb-6">{confirmation.message}</p>
                        <div className="flex gap-3 w-full"><Button fullWidth variant="ghost" onClick={() => setConfirmation(prev => ({...prev, isOpen: false}))}>Anuluj</Button><Button fullWidth variant="danger" onClick={() => { confirmation.onConfirm(); setConfirmation(prev => ({...prev, isOpen: false})); }}>{confirmation.actionLabel}</Button></div>
                    </div>
                </div>
            )}
        </div>
    );
};
