
import React, { useMemo, useState } from 'react';
import { 
    BookOpen, Video, FileText, Link as LinkIcon, Search, ExternalLink, 
    Star, Lightbulb, Clock, ChevronDown, ChevronUp, Briefcase, Folder, 
    X, ImageIcon, Type, Paperclip, FileCheck, Download, ZoomIn, ChevronRight
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillStatus, LibraryResource } from '../../types';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

interface Badge {
    label: string;
    color: string;
    icon: any;
}

const ResourceIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'video': return <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Video size={20}/></div>;
        case 'pdf': return <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><FileText size={20}/></div>;
        default: return <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><BookOpen size={20}/></div>;
    }
};

const getYoutubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
};

interface ResourceRowProps { 
    resource: LibraryResource; 
    badges?: Badge[]; 
    onClick: () => void;
}

const ResourceRow: React.FC<ResourceRowProps> = ({ resource, badges = [], onClick }) => {
    const { state } = useAppContext();
    const { skills } = state;

    return (
        <div 
            onClick={onClick}
            className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-all gap-4 group border-b border-slate-100 last:border-0 relative overflow-hidden"
        >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-4 flex-1">
                <div className="flex-shrink-0 group-hover:scale-110 transition-transform">
                    <ResourceIcon type={resource.type} />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base group-hover:text-blue-700 transition-colors">{resource.title}</h4>
                    {resource.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{resource.description}</p>}
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                        {resource.skill_ids?.map(sid => {
                            const s = skills.find(sk => sk.id === sid);
                            return s ? <span key={sid} className="text-[9px] bg-white text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase tracking-tighter">{s.name_pl}</span> : null;
                        })}
                        {badges.map((b, idx) => (
                            <span key={idx} className={`text-[9px] px-2 py-0.5 rounded font-black border flex items-center gap-1 uppercase tracking-tighter ${b.color}`}>
                                <b.icon size={10} /> {b.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0 text-slate-300 group-hover:text-blue-400 transition-colors self-center">
                <ChevronRight size={20} />
            </div>
        </div>
    );
};

export const EmployeeLibrary = () => {
    const { state } = useAppContext();
    const { libraryResources, skills, userSkills, currentUser, systemConfig } = state;
    const [filter, setFilter] = useState('');
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        'recommended': false
    });
    const [selectedResource, setSelectedResource] = useState<LibraryResource | null>(null);
    const [galleryViewer, setGalleryViewer] = useState<{isOpen: boolean, urls: string[], index: number}>({ 
        isOpen: false, urls: [], index: 0 
    });

    if (!currentUser) return null;

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };

    const getResourceContext = (resource: LibraryResource) => {
        const linkedSkillIds = resource.skill_ids || [];
        if (linkedSkillIds.length === 0) return { badges: [], isRecommended: false, priority: 0 };

        let isPracticeNeeded = false;
        let isTestNeeded = false;

        linkedSkillIds.forEach(sid => {
            const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === sid);
            const status = userSkill?.status || SkillStatus.PENDING;

            if (status === SkillStatus.THEORY_PASSED || status === SkillStatus.PRACTICE_PENDING) {
                isPracticeNeeded = true;
            } else if (status === SkillStatus.PENDING || status === SkillStatus.FAILED) {
                isTestNeeded = true;
            }
        });

        const badges: Badge[] = [];
        let priority = 0;

        if (isPracticeNeeded) {
            badges.push({ label: 'Do praktyki', color: 'bg-orange-50 text-orange-600 border-orange-100', icon: Clock });
            priority = 2;
        }
        if (isTestNeeded) {
            badges.push({ label: 'Do testu', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Lightbulb });
            if (priority < 1) priority = 1;
        }

        return { badges, isRecommended: priority > 0, priority };
    };

    const allResources = useMemo(() => libraryResources.filter(r => !r.is_archived), [libraryResources]);

    const filteredResources = useMemo(() => {
        return allResources.filter(res => {
            const matchesSearch = res.title.toLowerCase().includes(filter.toLowerCase()) || 
                                  res.description?.toLowerCase().includes(filter.toLowerCase());
            return matchesSearch;
        });
    }, [allResources, filter]);

    const recommendations = useMemo(() => {
        return allResources
            .map(res => ({ ...res, ctx: getResourceContext(res) }))
            .filter(item => item.ctx.isRecommended)
            .sort((a, b) => b.ctx.priority - a.ctx.priority)
            .slice(0, 4);
    }, [allResources, userSkills, currentUser.id]);

    const categorizedResources = useMemo(() => {
        const groups: Record<string, LibraryResource[]> = {};
        
        // Define special categories that might be hidden or treated differently if needed
        // but generally we now follow systemConfig.skillCategories
        const specialCats = ["TECZKA STANOWISKOWA", "TECZKA PRACOWNICZA"];

        filteredResources.forEach(res => {
            const cats = (res.categories && res.categories.length > 0) ? res.categories : [res.category || (systemConfig.skillCategories[systemConfig.skillCategories.length-1] || 'INNE')];
            cats.forEach(c => {
                if (!groups[c]) groups[c] = [];
                if (!groups[c].find(r => r.id === res.id)) groups[c].push(res);
            });
        });

        // Use categories from system config as the base for sorting
        const sortedKeys = (systemConfig.skillCategories || []).filter(k => !!groups[k]);

        return { groups, sortedKeys };
    }, [filteredResources, systemConfig.skillCategories]);

    const openGallery = (urls: string[], index: number) => {
        setGalleryViewer({ isOpen: true, urls, index });
    };

    const renderDetailModal = () => {
        if (!selectedResource) return null;

        const embedUrl = getYoutubeEmbedUrl(selectedResource.videoUrl);
        const files = selectedResource.file_urls || [];
        const allImages = [...files, selectedResource.imageUrl].filter(u => u && u.match(/\.(jpeg|jpg|gif|png)$/i)) as string[];

        return (
            <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedResource(null)}>
                <div 
                    className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in duration-300"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="bg-[#1A1C1E] px-8 py-6 flex justify-between items-center text-white">
                        <div>
                            <h3 className="text-2xl font-black tracking-tight leading-tight uppercase">{selectedResource.title}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {(selectedResource.skill_ids || []).map(sid => {
                                    const s = skills.find(sk => sk.id === sid);
                                    return s ? (
                                        <span key={sid} className="bg-blue-600/20 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-blue-500/30">
                                            {s.name_pl}
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        </div>
                        <button onClick={() => setSelectedResource(null)} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
                            <X size={28} />
                        </button>
                    </div>

                    <div className="p-8 overflow-y-auto bg-white flex-1 space-y-8 scrollbar-hide">
                        {selectedResource.description && (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><FileText size={14}/> Krótki opis</h4>
                                <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 font-medium italic shadow-inner">{selectedResource.description}</div>
                            </div>
                        )}

                        {embedUrl && (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Video size={14}/> INSTRUKCJA WIDEO</h4>
                                <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-1 ring-slate-200">
                                    <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Video instruction" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                                </div>
                            </div>
                        )}

                        {selectedResource.textContent && (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Type size={14}/> TREŚĆ MATERIAŁU</h4>
                                <div className="prose max-w-none p-8 bg-slate-50 border border-slate-100 rounded-[32px] whitespace-pre-wrap text-slate-700 font-medium leading-relaxed shadow-inner break-words text-base">{selectedResource.textContent}</div>
                            </div>
                        )}

                        {(allImages.length > 0 || files.length > 0) && (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Paperclip size={14}/> ZAŁĄCZNIKI I DOKUMENTACJA</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {files.map((url, i) => {
                                        const isImg = url.match(/\.(jpeg|jpg|gif|png)$/i);
                                        const isPdf = url.toLowerCase().includes('.pdf');
                                        return (
                                            <div key={i} className="group relative h-40 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-400 transition-all shadow-sm">
                                                {isImg ? (
                                                    <div className="w-full h-full cursor-pointer" onClick={() => openGallery(allImages, allImages.indexOf(url))}>
                                                        <img src={url} alt={`Attach ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ZoomIn className="text-white" size={32} /></div>
                                                    </div>
                                                ) : (
                                                    <a href={url} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400 hover:bg-white transition-colors">
                                                        {isPdf ? <FileText size={48} className="text-orange-500"/> : <Folder size={48} className="text-blue-500"/>}
                                                        <span className="text-[9px] font-black px-4 text-center truncate w-full uppercase tracking-tighter">{url.split('/').pop()?.split('_')[0] || 'DOKUMENT'}</span>
                                                        <Download size={16} className="text-slate-300" />
                                                    </a>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {selectedResource.url && (
                            <div className="pt-4">
                                <a href={selectedResource.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-600 hover:text-white transition-all group shadow-sm border border-blue-100">
                                    <div className="flex items-center gap-3"><LinkIcon size={20} className="group-hover:rotate-12 transition-transform"/><span className="font-black uppercase text-xs tracking-widest">Link zewnętrzny (Przejdź)</span></div>
                                    <ExternalLink size={20}/>
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <Button onClick={() => setSelectedResource(null)} className="px-12 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20">Zamknij materiał</Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 max-w-5xl mx-auto pb-32">
            <div className="mb-12">
                <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight uppercase">Baza Wiedzy</h1>
                <p className="text-slate-500 font-medium">Standardy wykonawcze, instrukcje i materiały MaxMaster.</p>
            </div>

            {/* Special Categories */}
            {!filter && (
                <div className="mb-12">
                    {recommendations.length > 0 && (
                        <div className="mb-8 bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
                            <button 
                                onClick={() => toggleCategory('recommended')}
                                className="w-full px-8 py-5 flex justify-between items-center bg-yellow-50 border-b border-yellow-100 transition-colors hover:bg-yellow-100/50"
                            >
                                <h3 className="font-black text-yellow-800 flex items-center gap-3 uppercase text-xs tracking-widest">
                                    <Star size={18} fill="currentColor"/> Polecane dla Ciebie
                                </h3>
                                {openCategories['recommended'] ? <ChevronUp size={20} className="text-yellow-600"/> : <ChevronDown size={20} className="text-yellow-600"/>}
                            </button>
                            {openCategories['recommended'] && (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {recommendations.map(res => (
                                        <ResourceRow 
                                            key={res.id} 
                                            resource={res} 
                                            onClick={() => setSelectedResource(res)}
                                            badges={(res as any).ctx.badges} 
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center gap-4 mb-8">
                <div className="h-px bg-slate-200 flex-1"></div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kategorie wiedzy</h3>
                <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-10">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input 
                    type="text" 
                    placeholder="Szukaj instrukcji, norm, materiałów..." 
                    className="w-full pl-16 pr-6 py-5 bg-[#333333] text-white rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-2xl font-medium text-lg placeholder:text-slate-500"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>

            {/* Categorized List */}
            <div className="space-y-6">
                {categorizedResources.sortedKeys.length === 0 ? (
                     <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-slate-200 text-slate-400 font-bold italic">
                        Brak materiałów pasujących do wyszukiwania.
                    </div>
                ) : (
                    categorizedResources.sortedKeys.map(category => {
                        const resources = categorizedResources.groups[category];
                        const isOpen = !!openCategories[category];

                        return (
                            <div key={category} className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
                                <button 
                                    onClick={() => toggleCategory(category)}
                                    className="w-full px-8 py-5 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100 transition-colors border-b border-slate-100"
                                >
                                    <h3 className="font-black text-slate-700 flex items-center gap-3 uppercase text-xs tracking-widest">
                                        {category} 
                                        <span className="text-slate-400 text-[10px] font-bold ml-2">({resources.length})</span>
                                    </h3>
                                    {isOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                                </button>

                                {isOpen && (
                                    <div className="divide-y divide-slate-100 bg-white">
                                        {resources.map(res => (
                                            <ResourceRow 
                                                key={res.id} 
                                                resource={res} 
                                                onClick={() => setSelectedResource(res)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {renderDetailModal()}
            
            <DocumentViewerModal 
                isOpen={galleryViewer.isOpen} 
                onClose={() => setGalleryViewer({...galleryViewer, isOpen: false})} 
                urls={galleryViewer.urls} 
                initialIndex={galleryViewer.index}
                title="Galeria materiału" 
            />
        </div>
    );
};
