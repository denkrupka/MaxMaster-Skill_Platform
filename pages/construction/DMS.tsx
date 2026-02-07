import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, FolderOpen, File, FileText, FileImage, FileVideo,
  Upload, Download, Trash2, Pencil, MoreVertical, Grid, List,
  ChevronRight, ChevronDown, Star, Clock, Users, Lock, Eye, Share2,
  ArrowLeft, Loader2, X, Check, Filter, Home, Save, Link as LinkIcon,
  Copy
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
  const [allFolders, setAllFolders] = useState<DMSFolder[]>([]);
  const [folders, setFolders] = useState<FolderWithChildren[]>([]);
  const [currentFolder, setCurrentFolder] = useState<DMSFolder | null>(null);
  const [currentFiles, setCurrentFiles] = useState<DMSFile[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<DMSFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const [editingFolder, setEditingFolder] = useState<DMSFolder | null>(null);
  const [selectedFile, setSelectedFile] = useState<DMSFile | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Folder form
  const [folderForm, setFolderForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) loadProjects();
  }, [currentUser]);

  useEffect(() => {
    if (selectedProject) loadFolders();
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) loadCurrentFolderContent();
  }, [currentFolder, selectedProject]);

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
        setAllFolders(data);
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
      const buildBreadcrumb = (folderId: string): DMSFolder[] => {
        const f = allFolders.find(x => x.id === folderId);
        if (!f) return [];
        if (f.parent_id) {
          return [...buildBreadcrumb(f.parent_id), f];
        }
        return [f];
      };
      setBreadcrumb(buildBreadcrumb(folder.id));
    } else {
      setBreadcrumb([]);
    }
  };

  const getSubfolders = () => {
    if (!currentFolder) {
      return allFolders.filter(f => !f.parent_id);
    }
    return allFolders.filter(f => f.parent_id === currentFolder.id);
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

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pl-PL');

  // Folder CRUD
  const handleSaveFolder = async () => {
    if (!currentUser || !selectedProject || !folderForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingFolder) {
        await supabase
          .from('dms_folders')
          .update({
            name: folderForm.name.trim(),
            description: folderForm.description
          })
          .eq('id', editingFolder.id);
      } else {
        await supabase
          .from('dms_folders')
          .insert({
            company_id: currentUser.company_id,
            project_id: selectedProject.id,
            parent_id: currentFolder?.id || null,
            name: folderForm.name.trim(),
            description: folderForm.description,
            created_by_id: currentUser.id
          });
      }
      setShowFolderModal(false);
      setEditingFolder(null);
      setFolderForm({ name: '', description: '' });
      await loadFolders();
    } catch (err) {
      console.error('Error saving folder:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async (folder: DMSFolder) => {
    if (!confirm(`Czy na pewno chcesz usunąć folder "${folder.name}" i wszystkie pliki w nim?`)) return;
    try {
      await supabase
        .from('dms_folders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', folder.id);
      await loadFolders();
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  // File upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!currentUser || !selectedProject || uploadFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        // Upload to storage
        const fileName = `${selectedProject.id}/${currentFolder?.id || 'root'}/${Date.now()}_${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('dms')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('dms')
          .getPublicUrl(fileName);

        // Create file record
        await supabase
          .from('dms_files')
          .insert({
            company_id: currentUser.company_id,
            project_id: selectedProject.id,
            folder_id: currentFolder?.id || null,
            name: file.name,
            original_name: file.name,
            file_url: urlData?.publicUrl,
            storage_path: fileName,
            size: file.size,
            mime_type: file.type,
            version: 1,
            is_current_version: true,
            created_by_id: currentUser.id
          });
      }

      setShowUploadModal(false);
      setUploadFiles([]);
      await loadCurrentFolderContent();
    } catch (err) {
      console.error('Error uploading files:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file: DMSFile) => {
    if (!confirm(`Czy na pewno chcesz usunąć plik "${file.name}"?`)) return;
    try {
      await supabase
        .from('dms_files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', file.id);
      await loadCurrentFolderContent();
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  const handleDownload = (file: DMSFile) => {
    if (file.file_url) {
      window.open(file.file_url, '_blank');
    }
  };

  const copyShareLink = (file: DMSFile) => {
    if (file.file_url) {
      navigator.clipboard.writeText(file.file_url);
      alert('Link skopiowany!');
    }
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

  // File detail modal
  if (selectedFile) {
    const FileIcon = getFileIcon(selectedFile.mime_type);
    return (
      <div className="p-6">
        <button
          onClick={() => setSelectedFile(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Powrót do listy
        </button>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Preview */}
          <div className="h-96 bg-slate-100 flex items-center justify-center">
            {selectedFile.mime_type?.startsWith('image/') && selectedFile.file_url ? (
              <img src={selectedFile.file_url} alt={selectedFile.name} className="max-h-full max-w-full object-contain" />
            ) : (
              <FileIcon className="w-24 h-24 text-slate-300" />
            )}
          </div>

          {/* Info */}
          <div className="p-6">
            <h1 className="text-xl font-bold text-slate-900 mb-4">{selectedFile.name}</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Rozmiar</p>
                <p className="font-medium text-slate-900">{formatFileSize(selectedFile.size)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Typ</p>
                <p className="font-medium text-slate-900">{selectedFile.mime_type || 'Nieznany'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Wersja</p>
                <p className="font-medium text-slate-900">{selectedFile.version}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Dodany</p>
                <p className="font-medium text-slate-900">{formatDate(selectedFile.created_at)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDownload(selectedFile)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Pobierz
              </button>
              <button
                onClick={() => copyShareLink(selectedFile)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Share2 className="w-4 h-4" />
                Udostępnij link
              </button>
              <button
                onClick={() => { handleDeleteFile(selectedFile); setSelectedFile(null); }}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Usuń
              </button>
            </div>
          </div>
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
          onClick={() => {
            setEditingFolder(null);
            setFolderForm({ name: '', description: '' });
            setShowFolderModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <Plus className="w-4 h-4" />
          Folder
        </button>
        <button
          onClick={() => {
            setUploadFiles([]);
            setShowUploadModal(true);
          }}
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
      {getSubfolders().length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 mb-3">Foldery</h2>
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'space-y-2'}>
            {getSubfolders().map(folder => (
              <div
                key={folder.id}
                className={viewMode === 'grid'
                  ? 'p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition text-center cursor-pointer group'
                  : 'w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition cursor-pointer group'
                }
                onClick={() => navigateToFolder(folder)}
              >
                <FolderOpen className={`w-8 h-8 text-amber-500 ${viewMode === 'grid' ? 'mx-auto mb-2' : ''}`} />
                <span className={`font-medium text-slate-900 ${viewMode === 'grid' ? 'block truncate' : 'flex-1 text-left truncate'}`}>
                  {folder.name}
                </span>
                <div className={`${viewMode === 'grid' ? 'flex justify-center gap-1 mt-2' : 'flex gap-1'} opacity-0 group-hover:opacity-100`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolder(folder);
                      setFolderForm({ name: folder.name, description: folder.description || '' });
                      setShowFolderModal(true);
                    }}
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    <Pencil className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
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
              onClick={() => {
                setUploadFiles([]);
                setShowUploadModal(true);
              }}
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
                  className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                    {file.thumbnail_url ? (
                      <img src={file.thumbnail_url} alt={file.name} className="w-full h-full object-cover rounded-lg" />
                    ) : file.mime_type?.startsWith('image/') && file.file_url ? (
                      <img src={file.file_url} alt={file.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <FileIcon className="w-12 h-12 text-slate-400" />
                    )}
                  </div>
                  <p className="font-medium text-slate-900 truncate text-sm">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <Download className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyShareLink(file); }}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <Share2 className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
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
                  className="flex items-center gap-4 p-3 hover:bg-slate-50 cursor-pointer group"
                  onClick={() => setSelectedFile(file)}
                >
                  <FileIcon className="w-8 h-8 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{file.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatFileSize(file.size)} • v{file.version} • {getUserName(file.created_by_id)} • {formatDate(file.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                      className="p-2 hover:bg-slate-200 rounded-lg"
                    >
                      <Download className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyShareLink(file); }}
                      className="p-2 hover:bg-slate-200 rounded-lg"
                    >
                      <Share2 className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                      className="p-2 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {editingFolder ? 'Edytuj folder' : 'Nowy folder'}
              </h2>
              <button onClick={() => setShowFolderModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
                <input
                  type="text"
                  value={folderForm.name}
                  onChange={e => setFolderForm({ ...folderForm, name: e.target.value })}
                  placeholder="np. Dokumentacja projektowa"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={folderForm.description}
                  onChange={e => setFolderForm({ ...folderForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveFolder}
                disabled={!folderForm.name.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingFolder ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Wgraj pliki</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-600">
                <span className="font-medium">Lokalizacja: </span>
                {currentFolder ? breadcrumb.map(f => f.name).join(' / ') : 'Katalog główny'}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-center"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">Kliknij aby wybrać pliki</p>
                  <p className="text-xs text-slate-400 mt-1">lub przeciągnij i upuść</p>
                </button>
              </div>
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Wybrane pliki ({uploadFiles.length})</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {uploadFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                        <File className="w-4 h-4 text-slate-400" />
                        <span className="flex-1 text-sm truncate">{file.name}</span>
                        <span className="text-xs text-slate-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button
                          onClick={() => setUploadFiles(uploadFiles.filter((_, j) => j !== i))}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleUpload}
                disabled={uploadFiles.length === 0 || uploading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Wgraj ({uploadFiles.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DMSPage;
