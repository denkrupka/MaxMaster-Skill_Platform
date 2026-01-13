
import React, { useState, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, ExternalLink, FileText, Video, Link as LinkIcon, ChevronDown, ChevronUp, ChevronRight, X, Archive, RotateCcw, AlertTriangle, Image as ImageIcon, Type, Sparkles, Layers, Save, Camera, Paperclip, FileCheck, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { LibraryResource, SkillCategory, Skill, SkillStatus } from '../../types';
import { uploadDocument } from '../../lib/supabase';

export const HRLibraryPage = () => {
    const { state, addLibraryResource, updateLibraryResource, deleteLibraryResource } = useAppContext();
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
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
    };

    // Data Processing: Hierarchy Category -> Skill -> Resources
    const hierarchy = useMemo(() => {
        const groups: Record<string, Record<string, LibraryResource[]>> = {};
        const resources = state.libraryResources.filter(r => viewMode === 'archived' ? r.is_archived : !r.is_archived);

        Object.values(SkillCategory).forEach(cat => {
            groups[cat] = {};
        });

        resources.forEach(res => {
            const resourceCategories = (res.categories && res.categories.length > 0) 
                ? res.categories 
                : [res.category || SkillCategory.INNE];

            resourceCategories.forEach(cat => {
                if (!groups[cat]) groups[cat] = {};

                const relevantSkills = res.skill_ids?.filter(sid => {
                    const skill = state.skills.find(s => s.id === sid);
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
    }, [state.libraryResources, viewMode, state.skills]);

    // Actions
    const handleOpenEditor = (res?: LibraryResource) => {
        setLocalFiles([]);
        if (res) {
            setEditingResource({ ...res, categories: res.categories || [res.category] });
        } else {
            setEditingResource({ 
                title: '', 
                description: '',
                type: 'mixed', 
                category: SkillCategory.INNE, 
                categories: [SkillCategory.INNE],
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
        if (!editingResource?.title) return;
        
        setIsUploading(true);
        const resourceId = editingResource.id || crypto.randomUUID();

        // Upload local files
        const uploadedUrls: string[] = [...(editingResource.file_urls || [])];
        if (localFiles.length > 0) {
            for (const file of localFiles) {
                const url = await uploadDocument(file, 'library/' + resourceId);
                if (url) uploadedUrls.push(url);
            }
        }

        const selectedSkillIds = editingResource.skill_ids || [];
        const derivedCategories = new Set<SkillCategory>();
        
        selectedSkillIds.forEach(sid => {
            const skill = state.skills.find(s => s.id === sid);
            if (skill) {
                derivedCategories.add(skill.category);
            }
        });

        const cats = derivedCategories.size > 0 
            ? Array.from(derivedCategories) 
            : [SkillCategory.INNE];

        const resourceToSave = {
            ...editingResource,
            id: editingResource.id || resourceId,
            categories: cats,
            category: cats[0],
            file_urls: uploadedUrls,
            imageUrl: uploadedUrls.find(u => u.match(/\.(jpeg|jpg|gif|png)$/i)) || editingResource.imageUrl,
            url: uploadedUrls[0] || editingResource.url
        } as LibraryResource;

        if (editingResource.id) {
            updateLibraryResource(editingResource.id, resourceToSave);
        } else {
            addLibraryResource(resourceToSave);
        }
        setIsUploading(false);
        setIsEditorOpen(false);
        setEditingResource(null);
        setLocalFiles([]);
    };

    const handleArchiveResource = (res: LibraryResource) => {
        setConfirmation({
            isOpen: true,
            title: "Archiwizacja Materiału",
            message: "Czy na pewno chcesz usunąć ten materiał? Zostanie on przeniesiony do archiwum.",
            actionLabel: "Usuń (Archiwizuj)",
            onConfirm: () => {
                updateLibraryResource(res.id, { is_archived: true });
                setIsDetailOpen(false);
                setSelectedResource(null);
            }
        });
    };

    const handleRestoreResource = (res: LibraryResource) => {
        setConfirmation({
            isOpen: true,
            title: "Przywracanie Materiału",
            message: "Czy na pewno chcesz przywrócić ten materiał z archiwum?",
            actionLabel: "Przywróć",
            onConfirm: () => {
                updateLibraryResource(res.id, { is_archived: false });
            }
        });
    };

    const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setLocalFiles(prev => [...prev, ...files]);
        }
    };

    const removeLocalFile = (index: number) => {
        setLocalFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeRemoteFile = (url: string) => {
        if (editingResource) {
            setEditingResource({
                ...editingResource,
                file_urls: (editingResource.file_urls || []).filter(u => u !== url)
            });
        }
    };

    const toggleSkillSelection = (skillId: string) => {
        if (!editingResource) return;
        const currentSkills = editingResource.skill_ids || [];
        if (currentSkills.includes(skillId)) {
            setEditingResource({ ...editingResource, skill_ids: currentSkills.filter(id => id !== skillId) });
        } else {
            setEditingResource({ ...editingResource, skill_ids: [...currentSkills, skillId] });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {viewMode === 'active' ? 'Biblioteka Materiałów' : 'Archiwum Materiałów'}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {viewMode === 'active' ? 'Zarządzaj bazą wiedzy i materiałami szkoleniowymi.' : 'Przeglądaj usunięte materiały.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {viewMode === 'active' ? (
                        <>
                            <Button variant="secondary" onClick={() => setViewMode('archived')}>
                                <Archive size={18} className="mr-2"/> Archiwum
                            </Button>
                            <Button onClick={() => handleOpenEditor()}>
                                <Plus size={18} className="mr-2"/> Dodaj Materiał
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={() => setViewMode('active')}>
                            <RotateCcw size={18} className="mr-2"/> Wróć do Biblioteki
                        </Button>
                    )}
                </div>
            </div>

            {/* Hierarchical List */}
            <div className="space-y-4">
                {Object.keys(hierarchy).map(cat => (
                    <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <button 
                            className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
                            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                        >
                            <span className="font-bold text-slate-800">{cat}</span>
                            <div className="flex items-center gap-3">
                                {activeCategory === cat ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                            </div>
                        </button>
                        
                        {activeCategory === cat && (
                            <div className="divide-y divide-slate-100 border-t border-slate-100">
                                {Object.keys(hierarchy[cat]).map(skillId => {
                                    const skill = state.skills.find(s => s.id === skillId);
                                    const skillName = skill ? skill.name_pl : (skillId === 'general' ? 'Ogólne' : 'Nieznana umiejętność');
                                    const resources = hierarchy[cat][skillId];
                                    
                                    if (resources.length === 0) return null;

                                    return (
                                        <div key={skillId} className="bg-white">
                                            <button 
                                                className="w-full px-6 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors pl-10"
                                                onClick={() => setActiveSkillId(activeSkillId === skillId ? null : skillId)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-medium ${skill ? 'text-slate-700' : 'text-slate-500 italic'}`}>{skillName}</span>
                                                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{resources.length}</span>
                                                </div>
                                                {activeSkillId === skillId ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                                            </button>

                                            {activeSkillId === skillId && (
                                                <div className="bg-slate-50/50">
                                                    {resources.map(res => (
                                                        <div 
                                                            key={res.id} 
                                                            className="px-6 py-3 pl-16 border-t border-slate-100 flex justify-between items-center hover:bg-blue-50 cursor-pointer transition-colors group"
                                                            onClick={() => {
                                                                setSelectedResource(res);
                                                                setIsDetailOpen(true);
                                                            }}
                                                        >
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-slate-900 font-medium">{res.title}</span>
                                                                    {viewMode === 'archived' && <span className="text-xs border border-slate-300 text-slate-500 px-1 rounded">Zarchiwizowany</span>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-slate-400">
                                                                {res.videoUrl && <Video size={16} />}
                                                                {(res.imageUrl || (res.file_urls && res.file_urls.length > 0)) && <ImageIcon size={16} />}
                                                                {res.textContent && <Type size={16} />}
                                                                {res.url && <LinkIcon size={16} />}
                                                                <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity ml-4"/>
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
                ))}
            </div>

            {/* --- Resource Detail Modal --- */}
            {isDetailOpen && selectedResource && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start p-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{selectedResource.title}</h2>
                            </div>
                            <button onClick={() => setIsDetailOpen(false)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {selectedResource.description && (
                                <div className="mb-6 text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    {selectedResource.description}
                                </div>
                            )}

                            <div className="space-y-6">
                                {selectedResource.videoUrl && (
                                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                        {getYoutubeEmbedUrl(selectedResource.videoUrl) ? (
                                            <iframe 
                                                src={getYoutubeEmbedUrl(selectedResource.videoUrl)!} 
                                                className="w-full h-full" 
                                                allowFullScreen 
                                                title="Video preview"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-white">Nieprawidłowy link wideo</div>
                                        )}
                                    </div>
                                )}

                                {selectedResource.imageUrl && !selectedResource.file_urls?.includes(selectedResource.imageUrl) && (
                                    <img src={selectedResource.imageUrl} alt="Preview" className="max-w-full rounded-lg border border-slate-200 shadow-sm" />
                                )}

                                {selectedResource.file_urls && selectedResource.file_urls.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {selectedResource.file_urls.map((url, i) => (
                                            <div key={i} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                                {url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                                                    <img src={url} alt="Resource file" className="w-full h-40 object-cover cursor-pointer" onClick={() => window.open(url, '_blank')} />
                                                ) : (
                                                    <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-400">
                                                        <FileText size={48}/>
                                                        <span className="text-xs font-bold truncate px-4 w-full text-center">{url.split('/').pop()}</span>
                                                        <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-bold hover:underline">Pobierz plik</a>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {selectedResource.textContent && (
                                    <div className="prose max-w-none p-4 bg-white border border-slate-200 rounded-lg whitespace-pre-wrap">
                                        {selectedResource.textContent}
                                    </div>
                                )}

                                {selectedResource.url && (
                                    <a href={selectedResource.url} target="_blank" rel="noreferrer" className="flex items-center p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors break-all group">
                                        <ExternalLink size={18} className="mr-2 flex-shrink-0 group-hover:scale-110 transition-transform"/> 
                                        <span className="font-medium">{selectedResource.url}</span>
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50 rounded-b-xl">
                            {viewMode === 'active' ? (
                                <div className="flex gap-2">
                                    <Button variant="danger" onClick={() => handleArchiveResource(selectedResource)}>
                                        <Trash2 size={18} className="mr-2"/> Usuń
                                    </Button>
                                    <Button onClick={() => handleOpenEditor(selectedResource)}>
                                        <Edit size={18} className="mr-2"/> Edytuj
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={() => handleRestoreResource(selectedResource)}>
                                    <RotateCcw size={18} className="mr-2"/> Przywróć z Archiwum
                                </Button>
                            )}
                            <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>Zamknij</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- REFINED EDITOR MODAL (AS PER SCREENSHOT) --- */}
            {isEditorOpen && editingResource && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in zoom-in duration-300">
                        {/* Header - Dark & Professional */}
                        <div className="bg-[#1A1C1E] px-6 py-5 flex justify-between items-center text-white">
                            <div>
                                <h2 className="text-xl font-black tracking-tight leading-tight">
                                    {editingResource.id ? 'Edytuj Materiał' : 'Dodaj Nowy Materiał'}
                                </h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">BAZA WIEDZY I STANDARDY</p>
                            </div>
                            <button onClick={() => setIsEditorOpen(false)} className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-full transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-hide bg-white">
                            {/* Material Name */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">NAZWA MATERIAŁU</label>
                                <input 
                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                    value={editingResource.title} 
                                    onChange={e => setEditingResource({...editingResource, title: e.target.value})} 
                                    placeholder="np. Instrukcja montażu gniazdek"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">OPIS</label>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-inner" 
                                    rows={2}
                                    value={editingResource.description || ''} 
                                    onChange={e => setEditingResource({...editingResource, description: e.target.value})}
                                    placeholder="Krótki opis, czego dotyczy materiał..."
                                />
                            </div>

                            {/* Skills Association */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 flex items-center gap-1.5">
                                    <Layers size={14}/> POWIĄZANE UMIEJĘTNOŚCI
                                </label>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-36 overflow-y-auto shadow-inner">
                                    {Object.values(SkillCategory).map(cat => {
                                        const skills = state.skills.filter(s => s.category === cat && !s.is_archived);
                                        if (skills.length === 0) return null;
                                        return (
                                            <div key={cat} className="mb-4 last:mb-0">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] px-2 py-1 mb-1 border-b border-slate-200/50">{cat}</div>
                                                <div className="space-y-0.5">
                                                    {skills.map(skill => {
                                                        const isSelected = editingResource.skill_ids?.includes(skill.id);
                                                        return (
                                                            <label key={skill.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all group ${isSelected ? 'bg-white shadow-sm border border-slate-100' : 'hover:bg-white/50'}`}>
                                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-slate-700 border-slate-700 text-white' : 'bg-white border-slate-300'}`}>
                                                                    {isSelected && <FileCheck size={12}/>}
                                                                </div>
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="hidden"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleSkillSelection(skill.id)}
                                                                />
                                                                <span className={`text-[13px] font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600'} group-hover:text-slate-900`}>{skill.name_pl}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Content & Links */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TREŚĆ I LINKI</h4>
                                
                                <div className="space-y-3">
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Video size={16}/></div>
                                        <input 
                                            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                                            placeholder="Link do YouTube..." 
                                            value={editingResource.videoUrl || ''} 
                                            onChange={e => setEditingResource({...editingResource, videoUrl: e.target.value})} 
                                        />
                                    </div>

                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><LinkIcon size={16}/></div>
                                        <input 
                                            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                                            placeholder="Inny link zewnętrzny..." 
                                            value={editingResource.url || ''} 
                                            onChange={e => setEditingResource({...editingResource, url: e.target.value})} 
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 py-3 rounded-xl text-[11px] font-black uppercase text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm group"
                                            disabled={isUploading}
                                        >
                                            {isUploading ? <Loader2 size={16} className="animate-spin"/> : <Paperclip size={16} className="group-hover:rotate-12 transition-transform"/>}
                                            {editingResource.id ? 'Załącz więcej plików' : 'Dodaj obrazy lub PDF'}
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" multiple onChange={handleFilesSelect} />

                                        {/* File Previews List */}
                                        {(localFiles.length > 0 || (editingResource.file_urls && editingResource.file_urls.length > 0)) && (
                                            <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto scrollbar-hide pr-1">
                                                {/* Remote Files */}
                                                {editingResource.file_urls?.map((url, i) => (
                                                    <div key={'rem-'+i} className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded-xl group/file transition-all">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <FileCheck size={14} className="text-blue-600 shrink-0"/>
                                                            <span className="text-[11px] font-bold text-blue-800 truncate">{url.split('/').pop()}</span>
                                                        </div>
                                                        <button onClick={() => removeRemoteFile(url)} className="text-red-400 hover:text-red-600 transition-colors p-1 bg-white rounded-full shadow-sm opacity-0 group-hover/file:opacity-100"><X size={12}/></button>
                                                    </div>
                                                ))}
                                                {/* Local Files */}
                                                {localFiles.map((file, i) => (
                                                    <div key={'loc-'+i} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-xl group/file transition-all">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <Paperclip size={14} className="text-slate-400 shrink-0"/>
                                                            <span className="text-[11px] font-bold text-slate-700 truncate">{file.name}</span>
                                                        </div>
                                                        <button onClick={() => removeLocalFile(i)} className="text-red-300 hover:text-red-500 transition-colors p-1"><X size={12}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer - White Background */}
                        <div className="p-5 bg-white border-t border-slate-100 flex justify-end items-center gap-8">
                            <button 
                                onClick={() => setIsEditorOpen(false)} 
                                className="text-[11px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors tracking-widest"
                            >
                                ANULUJ
                            </button>
                            <Button 
                                onClick={handleSaveResource} 
                                disabled={!editingResource.title || isUploading}
                                className="h-11 px-10 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 transition-all active:scale-95"
                            >
                                {isUploading ? <Loader2 size={18} className="animate-spin mr-2"/> : <Sparkles size={18} className="mr-2"/>}
                                ZAPISZ MATERIAŁ
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmation.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmation.title}</h3>
                            <p className="text-sm text-slate-500 mb-6">{confirmation.message}</p>
                            <div className="flex gap-3 w-full">
                                <Button fullWidth variant="ghost" onClick={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}>
                                    Anuluj
                                </Button>
                                <Button fullWidth variant="danger" onClick={() => {
                                    confirmation.onConfirm();
                                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                                }}>
                                    {confirmation.actionLabel}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
