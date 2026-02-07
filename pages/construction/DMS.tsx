import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, FolderOpen, File, FileText, FileImage, FileVideo,
  Upload, Download, Trash2, Pencil, MoreVertical, Grid, List,
  ChevronRight, ChevronDown, Star, Clock, Users, Lock, Eye, Share2,
  ArrowLeft, Loader2, X, Check, Filter, Home
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Project, DMSFolder, DMSFile } from '../../types';

interface FolderWithChildren extends DMSFolder {
  children?: FolderWithChildren[];
  files?: DMSFile[];
  isExpanded?: boolean;
}

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
};

export const DMSPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, users } = state;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [folders, setFolders] = useState<FolderWithChildren[]>([]);
  const [currentFolder, setCurrentFolder] = useState<DMSFolder | null>(null);
  const [currentFiles, setCurrentFiles] = useState<DMSFile[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<DMSFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DMSFolder | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (currentUser) loadProjects();
  }, [currentUser]);

  useEffect(() => {
    if (selectedProject) loadFolders();
  }, [selectedProject]);

  useEffect(() => {
    if (currentFolder || selectedProject) loadCurrentFolderContent();
  }, [currentFolder]);

  const loadProjects = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('created_at', { ascending: false });
      if (data) setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    if (!selectedProject || !currentUser) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('dms_folders')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('project_id', selectedProject.id)
        .is('deleted_at', null)
        .order('name');

      if (data) {
        const folderMap = new Map<string, FolderWithChildren>();
        data.forEach(f => {
          folderMap.set(f.id, { ...f, children: [], isExpanded: false });
        });

        data.forEach(f => {
          if (f.parent_id && folderMap.has(f.parent_id)) {
            folderMap.get(f.parent_id)!.children!.push(folderMap.get(f.id)!);
          }
        });

        const rootFolders = data.filter(f => !f.parent_id).map(f => folderMap.get(f.id)!);
        setFolders(rootFolders);
      }
    } catch (err) {
      console.error('Error loading folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentFolderContent = async () => {
    if (!selectedProject || !currentUser) return;
    try {
      const query = supabase
        .from('dms_files')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .eq('project_id', selectedProject.id)
        .eq('is_current_version', true)
        .is('deleted_at', null);

      if (currentFolder) {
        query.eq('folder_id', currentFolder.id);
      } else {
        query.is('folder_id', null);
      }

      const { data } = await query.order('name');
      if (data) setCurrentFiles(data);
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  const navigateToFolder = (folder: DMSFolder | null) => {
    setCurrentFolder(folder);
    if (folder) {
      // Build breadcrumb
      const newBreadcrumb = [...breadcrumb];
      const existingIndex = newBreadcrumb.findIndex(f => f.id === folder.id);
      if (existingIndex >= 0) {
        newBreadcrumb.splice(existingIndex + 1);
      } else {
        newBreadcrumb.push(folder);
      }
      setBreadcrumb(newBreadcrumb);
    } else {
      setBreadcrumb([]);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!search) return currentFiles;
    return currentFiles.filter(f =>
      f.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [currentFiles, search]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Nieznany';
  };

  // Project selection
  if (!selectedProject) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dokumenty</h1>
          <p className="text-slate-600 mt-1">Wybierz projekt, aby zarządzać dokumentami</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: project.color + '20' }}
                >
                  <FolderOpen className="w-5 h-5" style={{ color: project.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-500">{project.code || 'Brak kodu'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // DMS view
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => { setSelectedProject(null); setCurrentFolder(null); setBreadcrumb([]); }}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{selectedProject.name}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <button onClick={() => navigateToFolder(null)} className="hover:text-blue-600">
              <Home className="w-4 h-4" />
            </button>
            {breadcrumb.map((folder, i) => (
              <React.Fragment key={folder.id}>
                <ChevronRight className="w-4 h-4" />
                <button
                  onClick={() => navigateToFolder(folder)}
                  className="hover:text-blue-600"
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={() => { setEditingFolder(null); setShowFolderModal(true); }}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <Plus className="w-4 h-4" />
          Folder
        </button>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload className="w-4 h-4" />
          Wgraj pliki
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Szukaj plików..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl"
        />
      </div>

      {/* Folders */}
      {!currentFolder && folders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 mb-3">Foldery</h2>
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-2'}>
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => navigateToFolder(folder)}
                className={viewMode === 'grid'
                  ? 'p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition text-center'
                  : 'w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition'
                }
              >
                <FolderOpen className="w-8 h-8 text-amber-500 mx-auto mb-2" style={viewMode === 'list' ? { margin: 0 } : undefined} />
                <span className={`font-medium text-slate-900 ${viewMode === 'grid' ? 'block truncate' : 'flex-1 text-left'}`}>
                  {folder.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subfolders in current folder */}
      {currentFolder && folders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 mb-3">Podfoldery</h2>
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-2'}>
            {folders.filter(f => f.parent_id === currentFolder.id).map(folder => (
              <button
                key={folder.id}
                onClick={() => navigateToFolder(folder)}
                className={viewMode === 'grid'
                  ? 'p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition text-center'
                  : 'w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition'
                }
              >
                <FolderOpen className="w-8 h-8 text-amber-500" />
                <span className="font-medium text-slate-900 truncate">{folder.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div>
        <h2 className="text-sm font-medium text-slate-500 mb-3">Pliki</h2>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <File className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">Brak plików w tym folderze</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Wgraj pierwszy plik
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFiles.map(file => {
              const FileIcon = getFileIcon(file.mime_type);
              return (
                <div
                  key={file.id}
                  className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition cursor-pointer"
                >
                  <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center mb-3">
                    {file.thumbnail_url ? (
                      <img src={file.thumbnail_url} alt={file.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <FileIcon className="w-12 h-12 text-slate-400" />
                    )}
                  </div>
                  <p className="font-medium text-slate-900 truncate text-sm">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
            {filteredFiles.map(file => {
              const FileIcon = getFileIcon(file.mime_type);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-4 p-3 hover:bg-slate-50 cursor-pointer"
                >
                  <FileIcon className="w-8 h-8 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{file.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatFileSize(file.size)} • Wersja {file.version} • {getUserName(file.created_by_id)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-slate-200 rounded-lg">
                      <Download className="w-4 h-4 text-slate-400" />
                    </button>
                    <button className="p-2 hover:bg-slate-200 rounded-lg">
                      <Share2 className="w-4 h-4 text-slate-400" />
                    </button>
                    <button className="p-2 hover:bg-slate-200 rounded-lg">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DMSPage;
