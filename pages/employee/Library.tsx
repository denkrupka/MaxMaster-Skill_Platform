
import React, { useMemo, useState } from 'react';
import { BookOpen, Video, FileText, Link as LinkIcon, Search, ExternalLink, Star, Lightbulb, CheckCircle, Clock, ChevronDown, ChevronUp, Briefcase, Folder } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { SkillCategory, SkillStatus, LibraryResource } from '../../types';

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

interface ResourceRowProps { 
    resource: LibraryResource; 
    badges?: Badge[]; 
}

const ResourceRow: React.FC<ResourceRowProps> = ({ resource, badges = [] }) => {
    const { state } = useAppContext();
    const { skills } = state;

    return (
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors gap-4 group border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-4 flex-1">
                <div className="flex-shrink-0">
                    <ResourceIcon type={resource.type} />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 text-sm md:text-base group-hover:text-blue-700 transition-colors">{resource.title}</h4>
                    {resource.description && <p className="text-xs text-slate-500 line-clamp-1">{resource.description}</p>}
                    
                    <div className="flex flex-wrap gap-2 mt-1.5">
                        {/* Skill Tags */}
                        {resource.skill_ids?.map(sid => {
                            const s = skills.find(sk => sk.id === sid);
                            return s ? <span key={sid} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{s.name_pl}</span> : null;
                        })}
                        {/* Context Badges */}
                        {badges.map((b, idx) => (
                            <span key={idx} className={`text-[10px] px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${b.color}`}>
                                <b.icon size={10} /> {b.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="flex-shrink-0 ml-14 md:ml-0">
                <a 
                    href={resource.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors shadow-sm"
                >
                    {resource.type === 'video' ? 'Oglądaj' : 'Otwórz'}
                    <ExternalLink size={14}/>
                </a>
            </div>
        </div>
    );
};

export const EmployeeLibrary = () => {
    const { state } = useAppContext();
    const { libraryResources, skills, userSkills, currentUser } = state;
    const [filter, setFilter] = useState('');
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

    if (!currentUser) return null;

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };

    // --- LOGIC: HELPER FUNCTIONS ---

    const getResourceContext = (resource: LibraryResource) => {
        const linkedSkillIds = resource.skill_ids || [];
        if (linkedSkillIds.length === 0) return { badges: [], isRecommended: false, priority: 0 };

        let isPracticeNeeded = false;
        let isTestNeeded = false;
        let isConfirmed = false;

        linkedSkillIds.forEach(sid => {
            const userSkill = userSkills.find(us => us.user_id === currentUser.id && us.skill_id === sid);
            const status = userSkill?.status || SkillStatus.PENDING;

            if (status === SkillStatus.THEORY_PASSED || status === SkillStatus.PRACTICE_PENDING) {
                isPracticeNeeded = true;
            } else if (status === SkillStatus.PENDING || status === SkillStatus.FAILED) {
                isTestNeeded = true;
            } else if (status === SkillStatus.CONFIRMED) {
                isConfirmed = true;
            }
        });

        const badges: Badge[] = [];
        let priority = 0; // Higher is better for recommendation

        if (isPracticeNeeded) {
            badges.push({ label: 'Wymagane do praktyki', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock });
            priority = 2;
        }
        if (isTestNeeded) {
            badges.push({ label: 'Pomaga zdać test', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Lightbulb });
            if (priority < 1) priority = 1;
        }
        if (isConfirmed && !isPracticeNeeded && !isTestNeeded) {
            priority = -1; 
        }

        return { badges, isRecommended: priority > 0, priority };
    };

    // --- DATA PREPARATION ---

    // 1. All Active Resources
    const allResources = useMemo(() => {
        return libraryResources.filter(r => !r.is_archived);
    }, [libraryResources]);

    // 2. Filtered for Display
    const filteredResources = useMemo(() => {
        return allResources.filter(res => {
            const matchesSearch = res.title.toLowerCase().includes(filter.toLowerCase()) || 
                                  res.description?.toLowerCase().includes(filter.toLowerCase());
            return matchesSearch;
        });
    }, [allResources, filter]);

    // 3. Special Categories Data
    const recommendations = useMemo(() => {
        return allResources
            .map(res => ({ ...res, ctx: getResourceContext(res) }))
            .filter(item => item.ctx.isRecommended)
            .sort((a, b) => b.ctx.priority - a.ctx.priority)
            .slice(0, 4); // Top 4
    }, [allResources, userSkills, currentUser.id]);

    const teczkaStanowiskowa = useMemo(() => {
        return filteredResources.filter(r => r.category === SkillCategory.TECZKA || r.categories?.includes(SkillCategory.TECZKA));
    }, [filteredResources]);

    const teczkaPracownicza = useMemo(() => {
        return filteredResources.filter(r => r.category === SkillCategory.TECZKA_PRACOWNICZA || r.categories?.includes(SkillCategory.TECZKA_PRACOWNICZA));
    }, [filteredResources]);

    // 4. Categorized (Excluding Specials)
    const categorizedResources = useMemo(() => {
        const groups: Record<string, LibraryResource[]> = {};
        const excludedCats = [SkillCategory.TECZKA, SkillCategory.TECZKA_PRACOWNICZA];

        filteredResources.forEach(res => {
            const cats = (res.categories && res.categories.length > 0) ? res.categories : [res.category || SkillCategory.INNE];
            cats.forEach(c => {
                if (excludedCats.includes(c as SkillCategory)) return;

                if (!groups[c]) groups[c] = [];
                if (!groups[c].find(r => r.id === res.id)) {
                    groups[c].push(res);
                }
            });
        });

        const sortedKeys = Object.keys(groups).sort((a,b) => {
            if(a === SkillCategory.INNE) return 1;
            if(b === SkillCategory.INNE) return -1;
            return a.localeCompare(b);
        });

        return { groups, sortedKeys };
    }, [filteredResources]);

    // --- RENDERERS ---

    const CollapsibleSection = ({ 
        id, title, icon: Icon, resources, colorClass 
    }: { 
        id: string, title: string, icon: any, resources: LibraryResource[], colorClass: string 
    }) => {
        if (resources.length === 0) return null;
        
        return (
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button 
                    onClick={() => toggleCategory(id)}
                    className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Icon className={colorClass} size={20}/> {title}
                        <span className="text-slate-400 text-xs font-normal">({resources.length})</span>
                    </h2>
                    {openCategories[id] ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>

                {openCategories[id] && (
                    <div className="divide-y divide-slate-100">
                        {resources.map(res => (
                            <ResourceRow key={res.id} resource={res} badges={id === 'recommended' ? (res as any).ctx.badges : []} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Baza Wiedzy</h1>
            <p className="text-slate-500 mb-8">Materiały szkoleniowe, instrukcje i standardy firmowe.</p>

            {/* Special Sections */}
            {!filter && (
                <div className="mb-10">
                    <h3 className="text-slate-900 font-bold text-lg mb-4 pl-1">Ogólne</h3>
                    
                    <CollapsibleSection 
                        id="recommended" 
                        title="Polecane dla Ciebie" 
                        icon={Star} 
                        resources={recommendations as any[]} 
                        colorClass="text-yellow-500 fill-yellow-500" 
                    />
                    
                    <CollapsibleSection 
                        id="teczka" 
                        title="Teczka Stanowiskowa" 
                        icon={Briefcase} 
                        resources={teczkaStanowiskowa} 
                        colorClass="text-blue-600" 
                    />

                    <CollapsibleSection 
                        id="teczka_pracownicza" 
                        title="Teczka Pracownicza" 
                        icon={Folder} 
                        resources={teczkaPracownicza} 
                        colorClass="text-purple-600" 
                    />
                </div>
            )}

            {/* Umiejętności Header - Moved Above Search */}
            <h3 className="text-slate-900 font-bold text-lg mb-4 pl-1">Umiejętności</h3>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Szukaj materiałów, instrukcji..." 
                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>

            {/* Filtered Special Sections (if searching) */}
            {filter && (
                <div className="mb-6 space-y-4">
                    {teczkaStanowiskowa.length > 0 && <CollapsibleSection id="teczka" title="Teczka Stanowiskowa" icon={Briefcase} resources={teczkaStanowiskowa} colorClass="text-blue-600" />}
                    {teczkaPracownicza.length > 0 && <CollapsibleSection id="teczka_pracownicza" title="Teczka Pracownicza" icon={Folder} resources={teczkaPracownicza} colorClass="text-purple-600" />}
                </div>
            )}

            {/* Categorized List (Collapsible) - Framed */}
            <div className="space-y-4 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                {categorizedResources.sortedKeys.length === 0 && filteredResources.length === 0 ? (
                     <div className="text-center py-8 text-slate-400">
                        Nie znaleziono materiałów pasujących do wyszukiwania.
                    </div>
                ) : (
                    categorizedResources.sortedKeys.map(category => {
                        const resources = categorizedResources.groups[category];
                        if (resources.length === 0) return null;
                        const isOpen = !!openCategories[category];

                        return (
                            <div key={category} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <button 
                                    onClick={() => toggleCategory(category)}
                                    className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
                                >
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                        {category} 
                                        <span className="text-slate-400 text-xs font-normal">({resources.length})</span>
                                    </h3>
                                    {isOpen ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                                </button>

                                {isOpen && (
                                    <div className="divide-y divide-slate-100">
                                        {resources.map(res => {
                                            const ctx = getResourceContext(res);
                                            return <ResourceRow key={res.id} resource={res} badges={ctx.badges} />;
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
