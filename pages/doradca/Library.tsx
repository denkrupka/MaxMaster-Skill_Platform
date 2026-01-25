import React, { useState, useMemo } from 'react';
import {
  BookOpen, Video, FileText, Link as LinkIcon, Search, ExternalLink,
  ChevronDown, ChevronUp, Folder, X, Download, ZoomIn, ChevronRight,
  Building2, Filter, Type, Paperclip
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { LibraryResource, Company } from '../../types';
import { DocumentViewerModal } from '../../components/DocumentViewerModal';

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
  onClick: () => void;
}

const ResourceRow: React.FC<ResourceRowProps> = ({ resource, onClick }) => {
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
            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
              {resource.type === 'video' ? 'Wideo' : resource.type === 'pdf' ? 'PDF' : resource.type === 'link' ? 'Link' : 'Mieszany'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 text-slate-300 group-hover:text-blue-400 transition-colors self-center">
        <ChevronRight size={20} />
      </div>
    </div>
  );
};

export const DoradcaLibrary: React.FC = () => {
  const { state } = useAppContext();
  const { libraryResources, skills, companies, systemConfig } = state;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [selectedResource, setSelectedResource] = useState<LibraryResource | null>(null);
  const [galleryViewer, setGalleryViewer] = useState<{isOpen: boolean, urls: string[], index: number}>({
    isOpen: false, urls: [], index: 0
  });

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Get all active resources
  const allResources = useMemo(() => libraryResources.filter(r => !r.is_archived), [libraryResources]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: allResources.length,
      videos: allResources.filter(r => r.type === 'video').length,
      pdfs: allResources.filter(r => r.type === 'pdf').length,
      links: allResources.filter(r => r.type === 'link').length,
      categories: systemConfig.skillCategories?.length || 0
    };
  }, [allResources, systemConfig.skillCategories]);

  // Filter resources
  const filteredResources = useMemo(() => {
    return allResources.filter(res => {
      const matchesSearch = res.title.toLowerCase().includes(search.toLowerCase()) ||
                            res.description?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = selectedCategory === 'all' ||
        (res.categories?.includes(selectedCategory)) ||
        (res.category === selectedCategory);

      const matchesType = selectedType === 'all' || res.type === selectedType;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [allResources, search, selectedCategory, selectedType]);

  // Categorize resources
  const categorizedResources = useMemo(() => {
    const groups: Record<string, LibraryResource[]> = {};

    filteredResources.forEach(res => {
      const cats = (res.categories && res.categories.length > 0)
        ? res.categories
        : [res.category || (systemConfig.skillCategories?.[systemConfig.skillCategories.length-1] || 'INNE')];

      cats.forEach(c => {
        if (!groups[c]) groups[c] = [];
        if (!groups[c].find(r => r.id === res.id)) groups[c].push(res);
      });
    });

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
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-slate-800 px-6 py-4 flex justify-between items-center text-white">
            <div>
              <h3 className="text-xl font-bold">{selectedResource.title}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {(selectedResource.skill_ids || []).map(sid => {
                  const s = skills.find(sk => sk.id === sid);
                  return s ? (
                    <span key={sid} className="bg-blue-600/20 text-blue-400 text-[10px] font-medium px-2 py-0.5 rounded">
                      {s.name_pl}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <button onClick={() => setSelectedResource(null)} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-all">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto bg-white flex-1 space-y-6">
            {selectedResource.description && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><FileText size={14}/> Opis</h4>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">{selectedResource.description}</div>
              </div>
            )}

            {embedUrl && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Video size={14}/> Wideo</h4>
                <div className="aspect-video bg-black rounded-xl overflow-hidden">
                  <iframe src={embedUrl} className="w-full h-full" allowFullScreen title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                </div>
              </div>
            )}

            {selectedResource.textContent && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Type size={14}/> Treść</h4>
                <div className="prose max-w-none p-4 bg-slate-50 border border-slate-100 rounded-xl whitespace-pre-wrap text-slate-700">{selectedResource.textContent}</div>
              </div>
            )}

            {(allImages.length > 0 || files.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Paperclip size={14}/> Załączniki</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {files.map((url, i) => {
                    const isImg = url.match(/\.(jpeg|jpg|gif|png)$/i);
                    const isPdf = url.toLowerCase().includes('.pdf');
                    return (
                      <div key={i} className="group relative h-32 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all">
                        {isImg ? (
                          <div className="w-full h-full cursor-pointer" onClick={() => openGallery(allImages, allImages.indexOf(url))}>
                            <img src={url} alt={`Attach ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ZoomIn className="text-white" size={24} /></div>
                          </div>
                        ) : (
                          <a href={url} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-white transition-colors">
                            {isPdf ? <FileText size={32} className="text-orange-500"/> : <Folder size={32} className="text-blue-500"/>}
                            <span className="text-[10px] font-medium px-2 text-center truncate w-full">{url.split('/').pop()?.substring(0, 20) || 'Dokument'}</span>
                            <Download size={14} className="text-slate-300" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedResource.url && (
              <a href={selectedResource.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-600 hover:text-white transition-all group">
                <div className="flex items-center gap-3"><LinkIcon size={18}/><span className="font-medium">Link zewnętrzny</span></div>
                <ExternalLink size={18}/>
              </a>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <Button onClick={() => setSelectedResource(null)}>Zamknij</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Biblioteka Materiałów</h1>
        <p className="text-slate-500 mt-1">
          Przegląd wszystkich materiałów szkoleniowych i instrukcji
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Wszystkich</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.videos}</p>
              <p className="text-xs text-slate-500">Wideo</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.pdfs}</p>
              <p className="text-xs text-slate-500">PDF</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.links}</p>
              <p className="text-xs text-slate-500">Linki</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Folder className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.categories}</p>
              <p className="text-xs text-slate-500">Kategorii</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Szukaj materiałów..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <select
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">Wszystkie kategorie</option>
              {systemConfig.skillCategories?.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="all">Wszystkie typy</option>
              <option value="video">Wideo</option>
              <option value="pdf">PDF</option>
              <option value="link">Link</option>
              <option value="mixed">Mieszany</option>
            </select>
          </div>
        </div>

        {(search || selectedCategory !== 'all' || selectedType !== 'all') && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Filter size={14} />
            <span>Znaleziono: {filteredResources.length} materiałów</span>
            <button
              onClick={() => { setSearch(''); setSelectedCategory('all'); setSelectedType('all'); }}
              className="text-blue-600 hover:underline ml-2"
            >
              Wyczyść filtry
            </button>
          </div>
        )}
      </div>

      {/* Categorized List */}
      <div className="space-y-4">
        {categorizedResources.sortedKeys.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Brak materiałów pasujących do wyszukiwania</p>
          </div>
        ) : (
          categorizedResources.sortedKeys.map(category => {
            const resources = categorizedResources.groups[category];
            const isOpen = !!openCategories[category];

            return (
              <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-5 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
                >
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Folder size={18} className="text-slate-400" />
                    {category}
                    <span className="text-slate-400 text-sm font-normal ml-2">({resources.length})</span>
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
