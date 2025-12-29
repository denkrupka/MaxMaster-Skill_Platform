
import React, { useState, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, ExternalLink, FileText, Video, Link as LinkIcon, ChevronDown, ChevronUp, ChevronRight, X, Archive, RotateCcw, AlertTriangle, Image as ImageIcon, Type } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { LibraryResource, SkillCategory, Skill } from '../../types';

export const HRLibraryPage = () => {
    const { state, addLibraryResource, updateLibraryResource, deleteLibraryResource } = useAppContext();
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    
    // Accordion State
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [activeSkillId, setActiveSkillId] = useState<string | null>(null);

    // Modal States
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<Partial<LibraryResource> | null>(null);
    
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

        // Initialize Categories
        Object.values(SkillCategory).forEach(cat => {
            groups[cat] = {};
        });

        // Populate Hierarchy
        // A resource can belong to multiple categories and multiple skills.
        resources.forEach(res => {
            // Use categories array if present, otherwise fallback to single category or INNE
            const resourceCategories = (res.categories && res.categories.length > 0) 
                ? res.categories 
                : [res.category || SkillCategory.INNE];

            resourceCategories.forEach(cat => {
                if (!groups[cat]) groups[cat] = {};

                // Find skills linked to this resource that belong to this category
                const relevantSkills = res.skill_ids?.filter(sid => {
                    const skill = state.skills.find(s => s.id === sid);
                    return skill?.category === cat;
                }) || [];

                if (relevantSkills.length === 0) {
                    // If no specific skill in this category is linked, place under "General" for this category
                    if (!groups[cat]['general']) groups[cat]['general'] = [];
                    // Avoid duplicates if array references are same? Memo handles this but let's be safe
                    if (!groups[cat]['general'].includes(res)) {
                        groups[cat]['general'].push(res);
                    }
                } else {
                    // Place under each relevant skill
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
                textContent: '',
                skill_ids: [],
                is_archived: false
            });
        }
        setIsEditorOpen(true);
        if(isDetailOpen) setIsDetailOpen(false); // Close details if editing from details
    };

    const handleSaveResource = () => {
        if (!editingResource?.title) return;
        
        // Derive categories from selected skills
        const selectedSkillIds = editingResource.skill_ids || [];
        const derivedCategories = new Set<SkillCategory>();
        
        selectedSkillIds.forEach(sid => {
            const skill = state.skills.find(s => s.id === sid);
            if (skill) {
                derivedCategories.add(skill.category);
            }
        });

        // Ensure at least one category is selected, default to INNE if no skills
        const cats = derivedCategories.size > 0 
            ? Array.from(derivedCategories) 
            : [SkillCategory.INNE];

        const resourceToSave = {
            ...editingResource,
            categories: cats,
            // Primary category for legacy compatibility - use the first one
            category: cats[0] 
        } as LibraryResource;

        if (editingResource.id) {
            updateLibraryResource(editingResource.id, resourceToSave);
        } else {
            addLibraryResource(resourceToSave);
        }
        setIsEditorOpen(false);
        setEditingResource(null);
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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingResource) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditingResource({ ...editingResource, imageUrl: reader.result as string });
            };
            reader.readAsDataURL(file);
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
                        {/* Level 1: Category */}
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
                                {/* Level 2: Skills (and General) */}
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

                                            {/* Level 3: Resources List */}
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
                                                                <div className="flex flex-wrap gap-2 mt-1">
                                                                     {res.categories?.map(c => (
                                                                         <span key={c} className="text-xs text-slate-500 bg-white border px-1 rounded">{c}</span>
                                                                     ))}
                                                                     {res.skill_ids.map(sid => {
                                                                         const s = state.skills.find(sk => sk.id === sid);
                                                                         if (!s) return null;
                                                                         return <span key={sid} className="text-xs text-blue-600 bg-blue-100/50 px-1 rounded">{s.name_pl}</span>
                                                                     })}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-slate-400">
                                                                {res.videoUrl && <Video size={16} />}
                                                                {res.imageUrl && <ImageIcon size={16} />}
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
                                {Object.keys(hierarchy[cat]).length === 0 && (
                                    <div className="p-6 text-center text-slate-400 text-sm">Brak materiałów w tej kategorii.</div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {Object.keys(hierarchy).every(cat => Object.keys(hierarchy[cat]).length === 0) && (
                     <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400">
                         {viewMode === 'active' ? 'Brak materiałów. Dodaj pierwszy materiał!' : 'Archiwum jest puste.'}
                     </div>
                )}
            </div>

            {/* --- Resource Detail Modal --- */}
            {isDetailOpen && selectedResource && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start p-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{selectedResource.title}</h2>
                                <div className="flex flex-wrap gap-2 mt-2">
                                     {selectedResource.categories?.map(c => (
                                          <span key={c} className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded font-bold">{c}</span>
                                     ))}
                                     {selectedResource.skill_ids.map(sid => {
                                         const s = state.skills.find(sk => sk.id === sid);
                                         return s ? <span key={sid} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{s.name_pl}</span> : null;
                                     })}
                                </div>
                            </div>
                            <button onClick={() => setIsDetailOpen(false)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {selectedResource.description && (
                                <div className="mb-6 text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    {selectedResource.description}
                                </div>
                            )}

                            {/* Content Previews */}
                            <div className="space-y-6">
                                {/* Video */}
                                {selectedResource.videoUrl && (
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Video size={18}/> Wideo</h4>
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
                                    </div>
                                )}

                                {/* Image */}
                                {selectedResource.imageUrl && (
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><ImageIcon size={18}/> Obraz</h4>
                                        <img src={selectedResource.imageUrl} alt="Preview" className="max-w-full rounded-lg border border-slate-200 shadow-sm" />
                                    </div>
                                )}

                                {/* Text */}
                                {selectedResource.textContent && (
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Type size={18}/> Treść</h4>
                                        <div className="prose max-w-none p-4 bg-white border border-slate-200 rounded-lg whitespace-pre-wrap">
                                            {selectedResource.textContent}
                                        </div>
                                    </div>
                                )}

                                {/* External Link - ALWAYS VISIBLE IF PRESENT */}
                                {selectedResource.url && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><LinkIcon size={18}/> Link zewnętrzny</h4>
                                        <a href={selectedResource.url} target="_blank" rel="noreferrer" className="flex items-center p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors break-all group">
                                            <ExternalLink size={18} className="mr-2 flex-shrink-0 group-hover:scale-110 transition-transform"/> 
                                            <span className="font-medium">{selectedResource.url}</span>
                                        </a>
                                    </div>
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

            {/* --- Editor Modal --- */}
            {isEditorOpen && editingResource && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold">{editingResource.id ? 'Edytuj Materiał' : 'Dodaj Nowy Materiał'}</h2>
                            <button onClick={() => setIsEditorOpen(false)}><X size={24} className="text-slate-400"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nazwa Materiału</label>
                                    <input 
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={editingResource.title} 
                                        onChange={e => setEditingResource({...editingResource, title: e.target.value})} 
                                        placeholder="np. Instrukcja montażu gniazdek"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Opis</label>
                                    <textarea 
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                        rows={2}
                                        value={editingResource.description || ''} 
                                        onChange={e => setEditingResource({...editingResource, description: e.target.value})}
                                        placeholder="Krótki opis, czego dotyczy materiał..."
                                    />
                                </div>
                            </div>

                            {/* Skills Association */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Powiązane Umiejętności</label>
                                <div className="max-h-40 overflow-y-auto space-y-2 border bg-white p-2 rounded">
                                    {Object.values(SkillCategory).map(cat => {
                                        const skills = state.skills.filter(s => s.category === cat);
                                        if (skills.length === 0) return null;
                                        return (
                                            <div key={cat}>
                                                <div className="text-xs font-bold text-slate-400 uppercase mt-2 mb-1">{cat}</div>
                                                {skills.map(skill => (
                                                    <label key={skill.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={editingResource.skill_ids?.includes(skill.id)}
                                                            onChange={() => toggleSkillSelection(skill.id)}
                                                            className="rounded text-blue-600"
                                                        />
                                                        <span className="text-sm">{skill.name_pl}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Content Types */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900 border-b pb-2">Treść Materiału</h3>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2"><Video size={16}/> Link do YouTube (Film)</label>
                                    <input 
                                        className="w-full border p-2 rounded" 
                                        placeholder="https://www.youtube.com/watch?v=..." 
                                        value={editingResource.videoUrl || ''} 
                                        onChange={e => setEditingResource({...editingResource, videoUrl: e.target.value})} 
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2"><ImageIcon size={16}/> Obraz</label>
                                    <div className="flex items-center gap-4">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                        />
                                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>Wybierz plik</Button>
                                        {editingResource.imageUrl && <span className="text-xs text-green-600 font-bold">Obraz załadowany</span>}
                                        {editingResource.imageUrl && (
                                            <img src={editingResource.imageUrl} alt="preview" className="h-10 w-10 object-cover rounded border" />
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2"><Type size={16}/> Treść Tekstowa</label>
                                    <textarea 
                                        className="w-full border p-2 rounded" 
                                        rows={5}
                                        value={editingResource.textContent || ''} 
                                        onChange={e => setEditingResource({...editingResource, textContent: e.target.value})}
                                        placeholder="Wpisz treść szkoleniową..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2"><LinkIcon size={16}/> Inny Link (Opcjonalnie)</label>
                                    <input 
                                        className="w-full border p-2 rounded" 
                                        placeholder="https://..." 
                                        value={editingResource.url || ''} 
                                        onChange={e => setEditingResource({...editingResource, url: e.target.value})} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
                            <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>Anuluj</Button>
                            <Button onClick={handleSaveResource}>Zapisz</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmation.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
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
