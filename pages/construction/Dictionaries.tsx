import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Loader2, Pencil, Trash2, X, Check, RefreshCw,
  Wrench, Package, Monitor, FileText, Link2, ChevronDown, BookOpen,
  Settings, AlertCircle, ChevronRight, ClipboardList, GripVertical,
  Layers, FolderOpen, Store, Grid3X3, List, ExternalLink, ChevronLeft,
  Image as ImageIcon, Upload, Eye, ArrowUp, ArrowDown
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type {
  KosztorysWorkType,
  KosztorysMaterial,
  KosztorysEquipment,
  KosztorysTemplateTask,
  KosztorysMappingRule,
  KosztorysFormType,
  KosztorysFormTemplateDB,
  KosztorysFormRoomGroupDB,
  KosztorysFormRoomDB,
  KosztorysFormWorkCategoryDB,
  KosztorysFormWorkTypeDB,
  KosztorysWorkTypeRecord,
  WholesalerIntegration,
} from '../../types';
import { WholesalerIntegrationModal } from './WholesalerIntegrationModal';
import { TIMIntegrator } from './TIMIntegrator';
import { OninenIntegrator } from './OninenIntegrator';

// ============ Типы для вкладок ============
type TabType = 'work_types' | 'materials' | 'equipment' | 'slownik';

const TABS: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'work_types', label: 'Robocizna', icon: Wrench },
  { id: 'materials', label: 'Materiały', icon: Package },
  { id: 'equipment', label: 'Sprzęt', icon: Monitor },
  { id: 'slownik', label: 'Słownik', icon: BookOpen },
];

// ============ Единицы измерения (дефолтные, на польском) ============
const DEFAULT_UNITS = [
  { value: 'szt.', label: 'szt. (sztuki)' },
  { value: 'm', label: 'm (metry)' },
  { value: 'm²', label: 'm² (metry kwadratowe)' },
  { value: 'm³', label: 'm³ (metry sześcienne)' },
  { value: 'kg', label: 'kg (kilogramy)' },
  { value: 'kpl.', label: 'kpl. (komplet)' },
  { value: 'godz.', label: 'godz. (godziny)' },
  { value: 'mb', label: 'mb (metry bieżące)' },
  { value: 'op.', label: 'op. (opakowanie)' },
  { value: 'l', label: 'l (litry)' },
  { value: 't', label: 't (tony)' },
];

// ============ Категории работ ============
const WORK_CATEGORIES = [
  { value: 'PRZYG', label: 'Podготовительные' },
  { value: 'TRASY', label: 'Кабельные трассы' },
  { value: 'OKAB', label: 'Кабелирование' },
  { value: 'MONT', label: 'Монтаж' },
  { value: 'URUCH', label: 'Пусконаладка' },
  { value: 'ZEWN', label: 'Внешние работы' },
  { value: 'SPRZET', label: 'Оборудование' },
  { value: 'INNE', label: 'Прочее' },
];

// ============ Категории материалов — теперь динамические (user-created) ============

// ============ Типы формуляров ============
const FORM_TYPES: { value: KosztorysFormType; label: string }[] = [
  { value: 'MIESZK-IE', label: 'MIESZK-IE (Жилые - электрика)' },
  { value: 'MIESZK-IT', label: 'MIESZK-IT (Жилые - телеком)' },
  { value: 'PREM-IE', label: 'PREM-IE (Промышленные - электрика)' },
  { value: 'PREM-IT', label: 'PREM-IT (Промышленные - телеком)' },
];

// ============ Компонент Modal ============
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  zIndex?: number;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', zIndex }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: zIndex || 50 }}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-500 bg-opacity-75" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} w-full`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
};

export const DictionariesPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [activeTab, setActiveTab] = useState<TabType>('work_types');
  const [slownikSubTab, setSlownikSubTab] = useState<'rodzaj_prac' | 'wall_types'>('rodzaj_prac');
  const [materialsSubTab, setMaterialsSubTab] = useState<'own' | string>('own');
  const [equipmentSubTab, setEquipmentSubTab] = useState<'own' | string>('own');
  const [slownikMainSubTab, setSlownikMainSubTab] = useState<'own' | string>('own');
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [integrations, setIntegrations] = useState<WholesalerIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ============ Типы работ ============
  const [workTypes, setWorkTypes] = useState<KosztorysWorkType[]>([]);
  const [workTypeDialog, setWorkTypeDialog] = useState(false);
  const [editingWorkType, setEditingWorkType] = useState<Partial<KosztorysWorkType> | null>(null);
  const [workTypeSearch, setWorkTypeSearch] = useState('');

  // ============ Материалы ============
  const [materials, setMaterials] = useState<KosztorysMaterial[]>([]);
  const [materialDialog, setMaterialDialog] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Partial<KosztorysMaterial> | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');

  // ============ Расширенные состояния для каталога Własny ============
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; sort_order: number; parent_id?: string | null }[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{ id: string; name: string; parent_id?: string | null } | null>(null);
  const [deleteMaterialConfirm, setDeleteMaterialConfirm] = useState<{ id: string; name: string } | null>(null);
  const [addSubcategoryParentId, setAddSubcategoryParentId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [customManufacturers, setCustomManufacturers] = useState<{ id: string; name: string }[]>([]);
  const [customUnits, setCustomUnits] = useState<{ id: string; value: string; label: string }[]>([]);
  const [materialViewMode, setMaterialViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMaterialCategory, setSelectedMaterialCategory] = useState<string | null>(null);
  const [detailMaterial, setDetailMaterial] = useState<KosztorysMaterial | null>(null);
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newManufacturerName, setNewManufacturerName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddManufacturer, setShowAddManufacturer] = useState(false);
  const [newUnitValue, setNewUnitValue] = useState('');
  const [newUnitLabel, setNewUnitLabel] = useState('');
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [materialImages, setMaterialImages] = useState<string[]>([]);
  const [wholesalerPrices, setWholesalerPrices] = useState<Array<{ wholesaler: string; catalogPrice: number | null; purchasePrice: number | null; stock: number | null; url?: string }>>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [addToCatalogModal, setAddToCatalogModal] = useState<{ product: any; wholesaler: string } | null>(null);
  const [priceSyncMode, setPriceSyncMode] = useState<'fixed' | 'synced'>('fixed');

  // ============ Оборудование ============
  const [equipment, setEquipment] = useState<KosztorysEquipment[]>([]);
  const [equipmentDialog, setEquipmentDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Partial<KosztorysEquipment> | null>(null);
  const [equipmentSearch, setEquipmentSearch] = useState('');

  // ============ Шаблонные задания ============
  const [templateTasks, setTemplateTasks] = useState<any[]>([]);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<KosztorysTemplateTask> | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplateMaterials, setSelectedTemplateMaterials] = useState<{ material_id: string; quantity: number }[]>([]);
  const [selectedTemplateEquipment, setSelectedTemplateEquipment] = useState<{ equipment_id: string; quantity: number }[]>([]);

  // ============ Правила маппинга ============
  const [mappingRules, setMappingRules] = useState<any[]>([]);
  const [mappingDialog, setMappingDialog] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Partial<KosztorysMappingRule> | null>(null);
  const [mappingSearch, setMappingSearch] = useState('');

  // ============ Delete confirmations ============
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string } | null>(null);

  // ============ Rodzaj prac (request work types) ============
  const [requestWorkTypes, setRequestWorkTypes] = useState<KosztorysWorkTypeRecord[]>([]);
  const [requestWorkTypeDialog, setRequestWorkTypeDialog] = useState(false);
  const [editingRequestWorkType, setEditingRequestWorkType] = useState<Partial<KosztorysWorkTypeRecord> | null>(null);
  const [requestWorkTypeSearch, setRequestWorkTypeSearch] = useState('');

  // ============ Wall types (rodzaje ścian) ============
  const [wallTypes, setWallTypes] = useState<{ id: string; code: string; name: string; wall_category: string; is_active: boolean }[]>([]);
  const [wallTypeDialog, setWallTypeDialog] = useState(false);
  const [editingWallType, setEditingWallType] = useState<{ id?: string; code: string; name: string; wall_category: string; is_active: boolean } | null>(null);
  const [wallTypeSearch, setWallTypeSearch] = useState('');

  // ============ Formularze (form templates) ============
  const [formTemplates, setFormTemplates] = useState<KosztorysFormTemplateDB[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<KosztorysFormTemplateDB | null>(null);
  const [formRoomGroups, setFormRoomGroups] = useState<KosztorysFormRoomGroupDB[]>([]);
  const [formRooms, setFormRooms] = useState<KosztorysFormRoomDB[]>([]);
  const [formWorkCategories, setFormWorkCategories] = useState<KosztorysFormWorkCategoryDB[]>([]);
  const [formWorkTypesDB, setFormWorkTypesDB] = useState<KosztorysFormWorkTypeDB[]>([]);
  const [formTemplateDialog, setFormTemplateDialog] = useState(false);
  const [roomGroupDialog, setRoomGroupDialog] = useState(false);
  const [roomDialog, setRoomDialog] = useState(false);
  const [workCategoryDialog, setWorkCategoryDialog] = useState(false);
  const [workTypeDBDialog, setWorkTypeDBDialog] = useState(false);
  const [editingFormTemplate, setEditingFormTemplate] = useState<Partial<KosztorysFormTemplateDB> | null>(null);
  const [editingRoomGroup, setEditingRoomGroup] = useState<Partial<KosztorysFormRoomGroupDB> | null>(null);
  const [editingRoom, setEditingRoom] = useState<Partial<KosztorysFormRoomDB> | null>(null);
  const [editingWorkCategory, setEditingWorkCategory] = useState<Partial<KosztorysFormWorkCategoryDB> | null>(null);
  const [editingWorkTypeDB, setEditingWorkTypeDB] = useState<Partial<KosztorysFormWorkTypeDB> | null>(null);
  const [selectedRoomGroup, setSelectedRoomGroup] = useState<KosztorysFormRoomGroupDB | null>(null);
  const [selectedWorkCategory, setSelectedWorkCategory] = useState<KosztorysFormWorkCategoryDB | null>(null);

  // ============ Загрузка данных ============
  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser]);

  const loadIntegrations = async () => {
    if (!currentUser?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('wholesaler_integrations')
        .select('*')
        .eq('company_id', currentUser.company_id);
      if (!error) setIntegrations(data || []);
    } catch (err) {
      console.error('Error loading integrations:', err);
    }
  };

  const loadCustomCategories = async () => {
    if (!currentUser?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('kosztorys_custom_categories')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('sort_order', { ascending: true });
      if (!error) setCustomCategories(data || []);
    } catch (err) {
      console.error('Error loading custom categories:', err);
    }
  };

  const loadCustomManufacturers = async () => {
    if (!currentUser?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('kosztorys_custom_manufacturers')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('name', { ascending: true });
      if (!error) setCustomManufacturers(data || []);
    } catch (err) {
      console.error('Error loading custom manufacturers:', err);
    }
  };

  const loadCustomUnits = async () => {
    if (!currentUser?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('kosztorys_custom_units')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('sort_order', { ascending: true });
      if (!error && data && data.length > 0) {
        setCustomUnits(data);
      } else {
        // Initialize with default Polish units
        setCustomUnits(DEFAULT_UNITS.map((u, i) => ({ id: `default-${i}`, value: u.value, label: u.label })));
      }
    } catch (err) {
      console.error('Error loading custom units:', err);
      setCustomUnits(DEFAULT_UNITS.map((u, i) => ({ id: `default-${i}`, value: u.value, label: u.label })));
    }
  };

  const handleAddCustomCategory = async (parentId?: string | null) => {
    if (!newCategoryName.trim() || !currentUser?.company_id) return;
    try {
      const { error } = await supabase
        .from('kosztorys_custom_categories')
        .insert({
          company_id: currentUser.company_id,
          name: newCategoryName.trim(),
          sort_order: customCategories.length,
          parent_id: parentId || null,
        });
      if (error) throw error;
      setNewCategoryName('');
      setShowAddCategory(false);
      setAddSubcategoryParentId(null);
      if (parentId) setExpandedCategories(prev => new Set([...prev, parentId]));
      await loadCustomCategories();
      showNotification('Kategoria dodana', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Błąd', 'error');
    }
  };

  const handleRenameCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;
    try {
      const { error } = await supabase
        .from('kosztorys_custom_categories')
        .update({ name: editingCategoryName.trim() })
        .eq('id', id);
      if (error) throw error;

      // Update materials that reference old name
      const oldCat = customCategories.find(c => c.id === id);
      if (oldCat && oldCat.name !== editingCategoryName.trim()) {
        await supabase
          .from('kosztorys_materials')
          .update({ category: editingCategoryName.trim() })
          .eq('category', oldCat.name)
          .eq('company_id', currentUser?.company_id);
      }

      setEditingCategoryId(null);
      setEditingCategoryName('');
      await loadCustomCategories();
      await loadMaterials();
      showNotification('Kategoria zmieniona', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Błąd', 'error');
    }
  };

  const handleDeleteCustomCategory = async (id: string) => {
    const cat = customCategories.find(c => c.id === id);
    if (!cat) return;

    try {
      // Find parent category name (materials move there)
      const parentCat = cat.parent_id ? customCategories.find(c => c.id === cat.parent_id) : null;
      const newCategory = parentCat?.name || null;

      // Move materials to parent category
      await supabase
        .from('kosztorys_materials')
        .update({ category: newCategory })
        .eq('category', cat.name)
        .eq('company_id', currentUser?.company_id);

      // Move subcategories to parent
      await supabase
        .from('kosztorys_custom_categories')
        .update({ parent_id: cat.parent_id || null })
        .eq('parent_id', id);

      // Delete the category
      const { error } = await supabase.from('kosztorys_custom_categories').delete().eq('id', id);
      if (error) throw error;

      setDeleteCategoryConfirm(null);
      if (selectedMaterialCategory === cat.name) setSelectedMaterialCategory(null);
      await loadCustomCategories();
      await loadMaterials();
      showNotification('Kategoria usunięta', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Błąd', 'error');
    }
  };

  // Build category tree helper
  const getCategoryChildren = (parentId: string | null): typeof customCategories =>
    customCategories.filter(c => (c.parent_id || null) === parentId);

  const getCategoryMaterialCount = (catName: string): number => {
    const cat = customCategories.find(c => c.name === catName);
    if (!cat) return 0;
    const directCount = materials.filter(m => m.category === catName).length;
    const children = customCategories.filter(c => c.parent_id === cat.id);
    return directCount + children.reduce((sum, ch) => sum + getCategoryMaterialCount(ch.name), 0);
  };

  const handleAddCustomManufacturer = async () => {
    if (!newManufacturerName.trim() || !currentUser?.company_id) return;
    try {
      const { error } = await supabase
        .from('kosztorys_custom_manufacturers')
        .insert({ company_id: currentUser.company_id, name: newManufacturerName.trim() });
      if (error) throw error;
      setNewManufacturerName('');
      setShowAddManufacturer(false);
      await loadCustomManufacturers();
      showNotification('Producent dodany', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Błąd', 'error');
    }
  };

  const handleDeleteCustomManufacturer = async (id: string) => {
    try {
      const { error } = await supabase.from('kosztorys_custom_manufacturers').delete().eq('id', id);
      if (error) throw error;
      await loadCustomManufacturers();
      showNotification('Producent usunięty', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Błąd', 'error');
    }
  };

  const handleAddCustomUnit = async () => {
    if (!newUnitValue.trim() || !newUnitLabel.trim() || !currentUser?.company_id) return;
    try {
      const { error } = await supabase
        .from('kosztorys_custom_units')
        .insert({ company_id: currentUser.company_id, value: newUnitValue.trim(), label: newUnitLabel.trim(), sort_order: customUnits.length });
      if (error) throw error;
      setNewUnitValue('');
      setNewUnitLabel('');
      setShowAddUnit(false);
      await loadCustomUnits();
      showNotification('Jednostka dodana', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Błąd', 'error');
    }
  };

  const handleDeleteCustomUnit = async (id: string) => {
    if (id.startsWith('default-')) return;
    try {
      const { error } = await supabase.from('kosztorys_custom_units').delete().eq('id', id);
      if (error) throw error;
      await loadCustomUnits();
      showNotification('Jednostka usunięta', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Błąd', 'error');
    }
  };

  const generateMaterialCode = () => {
    const prefix = 'MAT';
    let maxNum = 0;
    materials.forEach(m => {
      const match = m.code?.match(/^MAT-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    const num = String(maxNum + 1).padStart(5, '0');
    return `${prefix}-${num}`;
  };

  // ============ Добавление продукта из гуртовни в каталог Власный ============
  const handleAddToOwnCatalog = (product: any) => {
    setAddToCatalogModal({ product, wholesaler: product.wholesaler });
    setPriceSyncMode('fixed');
  };

  const handleConfirmAddToOwnCatalog = async () => {
    if (!addToCatalogModal || !currentUser) return;
    setSaving(true);
    const p = addToCatalogModal.product;
    const code = generateMaterialCode();

    try {
      const materialData: any = {
        code,
        name: p.name,
        category: null,
        unit: p.unit || 'szt.',
        description: p.description || null,
        manufacturer: p.manufacturer || null,
        default_price: p.price || 0,
        is_active: true,
        company_id: currentUser.company_id,
        ean: p.ean || null,
        sku: p.sku || null,
        catalog_price: p.catalogPrice || null,
        purchase_price: p.price || 0,
        images: p.image ? JSON.stringify([p.image]) : '[]',
        source_wholesaler: addToCatalogModal.wholesaler,
        source_wholesaler_url: p.url || null,
        price_sync_mode: priceSyncMode,
      };

      const { error } = await supabase
        .from('kosztorys_materials')
        .insert(materialData);

      if (error) throw error;

      // Also add manufacturer to custom manufacturers if present
      if (p.manufacturer && currentUser.company_id) {
        const alreadyExists = customManufacturers.some(m => m.name === p.manufacturer);
        if (!alreadyExists) {
          await supabase
            .from('kosztorys_custom_manufacturers')
            .upsert({ company_id: currentUser.company_id, name: p.manufacturer }, { onConflict: 'company_id,name' });
          await loadCustomManufacturers();
        }
      }

      showNotification('Materiał dodany do katalogu Własnego', 'success');
      setAddToCatalogModal(null);
      await loadMaterials();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas dodawania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadWorkTypes(),
        loadMaterials(),
        loadEquipment(),
        loadTemplateTasks(),
        loadMappingRules(),
        loadRequestWorkTypes(),
        loadFormTemplates(),
        loadWallTypes(),
        loadIntegrations(),
        loadCustomCategories(),
        loadCustomManufacturers(),
        loadCustomUnits(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Błąd podczas ładowania danych', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_work_types')
        .select('*')
        .order('category', { ascending: true })
        .order('code', { ascending: true });

      if (error) throw error;
      setWorkTypes(data || []);
    } catch (err) {
      console.error('Error loading work types:', err);
      setWorkTypes([]);
    }
  };

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_materials')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      console.error('Error loading materials:', err);
      setMaterials([]);
    }
  };

  const loadEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_equipment')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setEquipment(data || []);
    } catch (err) {
      console.error('Error loading equipment:', err);
      setEquipment([]);
    }
  };

  const loadTemplateTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_template_tasks')
        .select(`
          *,
          work_type:kosztorys_work_types(*),
          materials:kosztorys_template_task_materials(
            *,
            material:kosztorys_materials(*)
          ),
          equipment:kosztorys_template_task_equipment(
            *,
            equipment:kosztorys_equipment(*)
          )
        `)
        .order('code', { ascending: true });

      if (error) throw error;
      setTemplateTasks(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setTemplateTasks([]);
    }
  };

  const loadMappingRules = async () => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_mapping_rules')
        .select(`
          *,
          template_task:kosztorys_template_tasks(*)
        `)
        .order('form_type', { ascending: true })
        .order('room_code', { ascending: true });

      if (error) throw error;
      setMappingRules(data || []);
    } catch (err) {
      console.error('Error loading mapping rules:', err);
      setMappingRules([]);
    }
  };

  // Load request work types (Rodzaj prac for multi-select in requests)
  const loadRequestWorkTypes = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('kosztorys_work_types')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('code', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setRequestWorkTypes(data || []);
    } catch (err) {
      console.error('Error loading request work types:', err);
      setRequestWorkTypes([]);
    }
  };

  // Load wall types (Rodzaje ścian)
  const loadWallTypes = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('kosztorys_wall_types')
        .select('*')
        .eq('company_id', currentUser.company_id)
        .order('wall_category')
        .order('name');

      if (error) throw error;
      setWallTypes(data || []);
    } catch (err) {
      console.error('Error loading wall types:', err);
      setWallTypes([]);
    }
  };

  // Load form templates (Formularze)
  const loadFormTemplates = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('kosztorys_form_templates_db')
        .select(`
          *,
          room_groups:kosztorys_form_room_groups_db(
            *,
            rooms:kosztorys_form_rooms_db(*)
          ),
          work_categories:kosztorys_form_work_categories_db(
            *,
            work_types:kosztorys_form_work_types_db(*)
          )
        `)
        .eq('company_id', currentUser.company_id)
        .order('form_type', { ascending: true });

      if (error) throw error;
      setFormTemplates(data || []);
    } catch (err) {
      console.error('Error loading form templates:', err);
      setFormTemplates([]);
    }
  };

  const loadFormTemplateDetails = async (templateId: string) => {
    try {
      // Load room groups
      const { data: roomGroups } = await supabase
        .from('kosztorys_form_room_groups_db')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');
      setFormRoomGroups(roomGroups || []);

      // Load rooms for all groups
      if (roomGroups && roomGroups.length > 0) {
        const groupIds = roomGroups.map(g => g.id);
        const { data: rooms } = await supabase
          .from('kosztorys_form_rooms_db')
          .select('*')
          .in('group_id', groupIds)
          .order('sort_order');
        setFormRooms(rooms || []);
      } else {
        setFormRooms([]);
      }

      // Load work categories
      const { data: categories } = await supabase
        .from('kosztorys_form_work_categories_db')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');
      setFormWorkCategories(categories || []);

      // Load work types for all categories
      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id);
        const { data: workTypesData } = await supabase
          .from('kosztorys_form_work_types_db')
          .select('*')
          .in('category_id', categoryIds)
          .order('sort_order');
        setFormWorkTypesDB(workTypesData || []);
      } else {
        setFormWorkTypesDB([]);
      }
    } catch (err) {
      console.error('Error loading form template details:', err);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // ============ CRUD для типов работ ============
  const handleSaveWorkType = async () => {
    if (!editingWorkType || !currentUser) return;
    setSaving(true);

    try {
      if (editingWorkType.id) {
        const { error } = await supabase
          .from('kosztorys_work_types')
          .update({
            code: editingWorkType.code,
            name: editingWorkType.name,
            category: editingWorkType.category,
            unit: editingWorkType.unit,
            description: editingWorkType.description,
            labor_hours: editingWorkType.labor_hours,
            is_active: editingWorkType.is_active,
          })
          .eq('id', editingWorkType.id);

        if (error) throw error;
        showNotification('Typ pracy zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_work_types')
          .insert({
            code: editingWorkType.code,
            name: editingWorkType.name,
            category: editingWorkType.category,
            unit: editingWorkType.unit,
            description: editingWorkType.description,
            labor_hours: editingWorkType.labor_hours || 0,
            is_active: editingWorkType.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Typ pracy dodany', 'success');
      }

      setWorkTypeDialog(false);
      setEditingWorkType(null);
      await loadWorkTypes();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kosztorys_work_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Typ pracy usunięty', 'success');
      await loadWorkTypes();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
    setShowDeleteConfirm(null);
  };

  // ============ CRUD для материалов ============
  const handleSaveMaterial = async () => {
    if (!editingMaterial || !currentUser) return;
    setSaving(true);

    const code = autoGenerateCode && !editingMaterial.id ? generateMaterialCode() : editingMaterial.code;

    try {
      const materialData: any = {
        code,
        name: editingMaterial.name,
        category: editingMaterial.category,
        unit: editingMaterial.unit,
        description: editingMaterial.description,
        manufacturer: editingMaterial.manufacturer,
        default_price: (editingMaterial as any).purchase_price || editingMaterial.default_price || 0,
        is_active: editingMaterial.is_active,
        ean: (editingMaterial as any).ean || null,
        sku: (editingMaterial as any).sku || null,
        catalog_price: (editingMaterial as any).catalog_price || null,
        purchase_price: (editingMaterial as any).purchase_price || (editingMaterial as any).default_price || 0,
        images: materialImages.length > 0 ? JSON.stringify(materialImages) : '[]',
        source_wholesaler: (editingMaterial as any).source_wholesaler || null,
        source_wholesaler_url: (editingMaterial as any).source_wholesaler_url || null,
        price_sync_mode: (editingMaterial as any).price_sync_mode || 'fixed',
      };

      if (editingMaterial.id) {
        const { error } = await supabase
          .from('kosztorys_materials')
          .update(materialData)
          .eq('id', editingMaterial.id);

        if (error) throw error;
        showNotification('Materiał zaktualizowany', 'success');
      } else {
        materialData.company_id = currentUser.company_id;
        const { error } = await supabase
          .from('kosztorys_materials')
          .insert(materialData);

        if (error) throw error;
        showNotification('Materiał dodany', 'success');
      }

      setMaterialDialog(false);
      setEditingMaterial(null);
      setMaterialImages([]);
      setAutoGenerateCode(true);
      await loadMaterials();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kosztorys_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Materiał usunięty', 'success');
      await loadMaterials();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
    setShowDeleteConfirm(null);
  };

  // ============ CRUD для оборудования ============
  const handleSaveEquipment = async () => {
    if (!editingEquipment || !currentUser) return;
    setSaving(true);

    try {
      if (editingEquipment.id) {
        const { error } = await supabase
          .from('kosztorys_equipment')
          .update({
            code: editingEquipment.code,
            name: editingEquipment.name,
            category: editingEquipment.category,
            unit: editingEquipment.unit,
            description: editingEquipment.description,
            manufacturer: editingEquipment.manufacturer,
            default_price: editingEquipment.default_price,
            is_active: editingEquipment.is_active,
          })
          .eq('id', editingEquipment.id);

        if (error) throw error;
        showNotification('Sprzęt zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_equipment')
          .insert({
            code: editingEquipment.code,
            name: editingEquipment.name,
            category: editingEquipment.category,
            unit: editingEquipment.unit,
            description: editingEquipment.description,
            manufacturer: editingEquipment.manufacturer,
            default_price: editingEquipment.default_price || 0,
            is_active: editingEquipment.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Sprzęt dodany', 'success');
      }

      setEquipmentDialog(false);
      setEditingEquipment(null);
      await loadEquipment();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kosztorys_equipment')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Sprzęt usunięty', 'success');
      await loadEquipment();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
    setShowDeleteConfirm(null);
  };

  // ============ CRUD для шаблонных заданий ============
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !currentUser) return;
    setSaving(true);

    try {
      let templateId = editingTemplate.id;

      if (templateId) {
        const { error } = await supabase
          .from('kosztorys_template_tasks')
          .update({
            code: editingTemplate.code,
            name: editingTemplate.name,
            description: editingTemplate.description,
            work_type_id: editingTemplate.work_type_id,
            base_quantity: editingTemplate.base_quantity,
            labor_hours: editingTemplate.labor_hours,
            is_active: editingTemplate.is_active,
          })
          .eq('id', templateId);

        if (error) throw error;

        // Удаляем старые материалы и оборудование
        await supabase.from('kosztorys_template_task_materials').delete().eq('template_task_id', templateId);
        await supabase.from('kosztorys_template_task_equipment').delete().eq('template_task_id', templateId);
      } else {
        const { data, error } = await supabase
          .from('kosztorys_template_tasks')
          .insert({
            code: editingTemplate.code,
            name: editingTemplate.name,
            description: editingTemplate.description,
            work_type_id: editingTemplate.work_type_id,
            base_quantity: editingTemplate.base_quantity || 1,
            labor_hours: editingTemplate.labor_hours || 0,
            is_active: editingTemplate.is_active ?? true,
            company_id: currentUser.company_id,
          })
          .select()
          .single();

        if (error) throw error;
        templateId = data.id;
      }

      // Добавляем материалы
      const validMaterials = selectedTemplateMaterials.filter(m => m.material_id);
      if (validMaterials.length > 0) {
        const materialsToInsert = validMaterials.map(m => ({
          template_task_id: templateId,
          material_id: m.material_id,
          quantity: m.quantity,
        }));

        const { error } = await supabase
          .from('kosztorys_template_task_materials')
          .insert(materialsToInsert);

        if (error) throw error;
      }

      // Добавляем оборудование
      const validEquipment = selectedTemplateEquipment.filter(e => e.equipment_id);
      if (validEquipment.length > 0) {
        const equipmentToInsert = validEquipment.map(e => ({
          template_task_id: templateId,
          equipment_id: e.equipment_id,
          quantity: e.quantity,
        }));

        const { error } = await supabase
          .from('kosztorys_template_task_equipment')
          .insert(equipmentToInsert);

        if (error) throw error;
      }

      showNotification(editingTemplate.id ? 'Szablon zaktualizowany' : 'Szablon dodany', 'success');
      setTemplateDialog(false);
      setEditingTemplate(null);
      setSelectedTemplateMaterials([]);
      setSelectedTemplateEquipment([]);
      await loadTemplateTasks();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kosztorys_template_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Szablon usunięty', 'success');
      await loadTemplateTasks();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
    setShowDeleteConfirm(null);
  };

  // ============ CRUD для правил маппинга ============
  const handleSaveMapping = async () => {
    if (!editingMapping || !currentUser) return;
    setSaving(true);

    try {
      if (editingMapping.id) {
        const { error } = await supabase
          .from('kosztorys_mapping_rules')
          .update({
            form_type: editingMapping.form_type,
            room_code: editingMapping.room_code,
            work_code: editingMapping.work_code,
            template_task_id: editingMapping.template_task_id,
            multiplier: editingMapping.multiplier,
            conditions: editingMapping.conditions,
            priority: editingMapping.priority,
            is_active: editingMapping.is_active,
          })
          .eq('id', editingMapping.id);

        if (error) throw error;
        showNotification('Reguła zaktualizowana', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_mapping_rules')
          .insert({
            form_type: editingMapping.form_type,
            room_code: editingMapping.room_code,
            work_code: editingMapping.work_code,
            template_task_id: editingMapping.template_task_id,
            multiplier: editingMapping.multiplier || 1,
            conditions: editingMapping.conditions || {},
            priority: editingMapping.priority || 0,
            is_active: editingMapping.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Reguła dodana', 'success');
      }

      setMappingDialog(false);
      setEditingMapping(null);
      await loadMappingRules();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kosztorys_mapping_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Reguła usunięta', 'success');
      await loadMappingRules();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
    setShowDeleteConfirm(null);
  };

  // ============ Фильтрация данных ============
  const filteredWorkTypes = useMemo(() =>
    workTypes.filter(wt =>
      wt.code?.toLowerCase().includes(workTypeSearch.toLowerCase()) ||
      wt.name?.toLowerCase().includes(workTypeSearch.toLowerCase())
    ), [workTypes, workTypeSearch]);

  // Collect all category names in subtree (for filtering when parent selected)
  const getCategorySubtreeNames = (catName: string): string[] => {
    const cat = customCategories.find(c => c.name === catName);
    if (!cat) return [catName];
    const children = customCategories.filter(c => c.parent_id === cat.id);
    return [catName, ...children.flatMap(ch => getCategorySubtreeNames(ch.name))];
  };

  const filteredMaterials = useMemo(() =>
    materials.filter(m => {
      const matchesSearch = !materialSearch ||
        m.code?.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.name?.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.ean?.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.sku?.toLowerCase().includes(materialSearch.toLowerCase()) ||
        m.manufacturer?.toLowerCase().includes(materialSearch.toLowerCase());
      let matchesCategory = true;
      if (selectedMaterialCategory === '__none__') {
        matchesCategory = !m.category;
      } else if (selectedMaterialCategory) {
        const validNames = getCategorySubtreeNames(selectedMaterialCategory);
        matchesCategory = validNames.includes(m.category || '');
      }
      return matchesSearch && matchesCategory;
    }), [materials, materialSearch, selectedMaterialCategory, customCategories]);

  const filteredEquipment = useMemo(() =>
    equipment.filter(e =>
      e.code?.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
      e.name?.toLowerCase().includes(equipmentSearch.toLowerCase())
    ), [equipment, equipmentSearch]);

  const filteredTemplates = useMemo(() =>
    templateTasks.filter(t =>
      t.code?.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.name?.toLowerCase().includes(templateSearch.toLowerCase())
    ), [templateTasks, templateSearch]);

  const filteredMappings = useMemo(() =>
    mappingRules.filter(m =>
      m.room_code?.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.work_code?.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.form_type?.toLowerCase().includes(mappingSearch.toLowerCase())
    ), [mappingRules, mappingSearch]);

  // Filtered request work types
  const filteredRequestWorkTypes = useMemo(() =>
    requestWorkTypes.filter(wt =>
      wt.name?.toLowerCase().includes(requestWorkTypeSearch.toLowerCase()) ||
      wt.code?.toLowerCase().includes(requestWorkTypeSearch.toLowerCase())
    ), [requestWorkTypes, requestWorkTypeSearch]);

  // ============ CRUD for request work types ============
  const handleSaveRequestWorkType = async () => {
    if (!editingRequestWorkType || !currentUser) return;
    setSaving(true);

    try {
      if (editingRequestWorkType.id) {
        const { error } = await supabase
          .from('kosztorys_work_types')
          .update({
            code: editingRequestWorkType.code,
            name: editingRequestWorkType.name,
            description: editingRequestWorkType.description,
            is_active: editingRequestWorkType.is_active,
          })
          .eq('id', editingRequestWorkType.id);

        if (error) throw error;
        showNotification('Rodzaj prac zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_work_types')
          .insert({
            code: editingRequestWorkType.code,
            name: editingRequestWorkType.name,
            description: editingRequestWorkType.description,
            is_active: editingRequestWorkType.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Rodzaj prac dodany', 'success');
      }

      setRequestWorkTypeDialog(false);
      setEditingRequestWorkType(null);
      await loadRequestWorkTypes();
    } catch (error: any) {
      console.error('Error saving request work type:', error);
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequestWorkType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kosztorys_work_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Rodzaj prac usunięty', 'success');
      await loadRequestWorkTypes();
    } catch (error: any) {
      console.error('Error deleting request work type:', error);
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
  };

  // ============ Wall types filtered ============
  const filteredWallTypes = useMemo(() =>
    wallTypes.filter(wt =>
      wt.name?.toLowerCase().includes(wallTypeSearch.toLowerCase()) ||
      wt.code?.toLowerCase().includes(wallTypeSearch.toLowerCase())
    ), [wallTypes, wallTypeSearch]);

  // ============ CRUD for wall types ============
  const handleSaveWallType = async () => {
    if (!editingWallType || !currentUser) return;
    setSaving(true);

    try {
      if (editingWallType.id) {
        const { error } = await supabase
          .from('kosztorys_wall_types')
          .update({
            code: editingWallType.code,
            name: editingWallType.name,
            wall_category: editingWallType.wall_category,
            is_active: editingWallType.is_active,
          })
          .eq('id', editingWallType.id);

        if (error) throw error;
        showNotification('Rodzaj ściany zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_wall_types')
          .insert({
            code: editingWallType.code,
            name: editingWallType.name,
            wall_category: editingWallType.wall_category,
            is_active: editingWallType.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Rodzaj ściany dodany', 'success');
      }

      setWallTypeDialog(false);
      setEditingWallType(null);
      await loadWallTypes();
    } catch (error: any) {
      console.error('Error saving wall type:', error);
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWallType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('kosztorys_wall_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Rodzaj ściany usunięty', 'success');
      await loadWallTypes();
    } catch (error: any) {
      console.error('Error deleting wall type:', error);
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
  };

  // ============ CRUD for form templates ============
  const handleSaveFormTemplate = async () => {
    if (!editingFormTemplate || !currentUser) return;
    setSaving(true);

    try {
      if (editingFormTemplate.id) {
        const { error } = await supabase
          .from('kosztorys_form_templates_db')
          .update({
            form_type: editingFormTemplate.form_type,
            title: editingFormTemplate.title,
            object_type: editingFormTemplate.object_type,
            is_active: editingFormTemplate.is_active,
          })
          .eq('id', editingFormTemplate.id);

        if (error) throw error;
        showNotification('Formularz zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_form_templates_db')
          .insert({
            form_type: editingFormTemplate.form_type,
            title: editingFormTemplate.title,
            object_type: editingFormTemplate.object_type,
            is_active: editingFormTemplate.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Formularz dodany', 'success');
      }

      setFormTemplateDialog(false);
      setEditingFormTemplate(null);
      await loadFormTemplates();
    } catch (error: any) {
      console.error('Error saving form template:', error);
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoomGroup = async () => {
    if (!editingRoomGroup || !selectedTemplate) return;
    setSaving(true);

    try {
      if (editingRoomGroup.id) {
        const { error } = await supabase
          .from('kosztorys_form_room_groups_db')
          .update({
            code: editingRoomGroup.code,
            name: editingRoomGroup.name,
            color: editingRoomGroup.color,
            sort_order: editingRoomGroup.sort_order || 0,
          })
          .eq('id', editingRoomGroup.id);

        if (error) throw error;
        showNotification('Grupa pomieszczeń zaktualizowana', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_form_room_groups_db')
          .insert({
            template_id: selectedTemplate.id,
            code: editingRoomGroup.code,
            name: editingRoomGroup.name,
            color: editingRoomGroup.color || '#f59e0b',
            sort_order: formRoomGroups.length,
          });

        if (error) throw error;
        showNotification('Grupa pomieszczeń dodana', 'success');
      }

      setRoomGroupDialog(false);
      setEditingRoomGroup(null);
      await loadFormTemplateDetails(selectedTemplate.id);
    } catch (error: any) {
      console.error('Error saving room group:', error);
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoom = async () => {
    if (!editingRoom || !selectedRoomGroup) return;
    setSaving(true);

    try {
      if (editingRoom.id) {
        const { error } = await supabase
          .from('kosztorys_form_rooms_db')
          .update({
            code: editingRoom.code,
            name: editingRoom.name,
            sort_order: editingRoom.sort_order || 0,
          })
          .eq('id', editingRoom.id);

        if (error) throw error;
        showNotification('Pomieszczenie zaktualizowane', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_form_rooms_db')
          .insert({
            group_id: selectedRoomGroup.id,
            code: editingRoom.code,
            name: editingRoom.name,
            sort_order: formRooms.filter(r => r.group_id === selectedRoomGroup.id).length,
          });

        if (error) throw error;
        showNotification('Pomieszczenie dodane', 'success');
      }

      setRoomDialog(false);
      setEditingRoom(null);
      if (selectedTemplate) {
        await loadFormTemplateDetails(selectedTemplate.id);
      }
    } catch (error: any) {
      console.error('Error saving room:', error);
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkCategory = async () => {
    if (!editingWorkCategory || !selectedTemplate) return;
    setSaving(true);

    try {
      if (editingWorkCategory.id) {
        const { error } = await supabase
          .from('kosztorys_form_work_categories_db')
          .update({
            code: editingWorkCategory.code,
            name: editingWorkCategory.name,
            color: editingWorkCategory.color,
            sort_order: editingWorkCategory.sort_order || 0,
          })
          .eq('id', editingWorkCategory.id);

        if (error) throw error;
        showNotification('Kategoria prac zaktualizowana', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_form_work_categories_db')
          .insert({
            template_id: selectedTemplate.id,
            code: editingWorkCategory.code,
            name: editingWorkCategory.name,
            color: editingWorkCategory.color || '#3b82f6',
            sort_order: formWorkCategories.length,
          });

        if (error) throw error;
        showNotification('Kategoria prac dodana', 'success');
      }

      setWorkCategoryDialog(false);
      setEditingWorkCategory(null);
      await loadFormTemplateDetails(selectedTemplate.id);
    } catch (error: any) {
      console.error('Error saving work category:', error);
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkTypeDB = async () => {
    if (!editingWorkTypeDB || !selectedWorkCategory) return;
    setSaving(true);

    try {
      if (editingWorkTypeDB.id) {
        const { error } = await supabase
          .from('kosztorys_form_work_types_db')
          .update({
            code: editingWorkTypeDB.code,
            name: editingWorkTypeDB.name,
            description: editingWorkTypeDB.description,
            sort_order: editingWorkTypeDB.sort_order || 0,
          })
          .eq('id', editingWorkTypeDB.id);

        if (error) throw error;
        showNotification('Typ pracy zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_form_work_types_db')
          .insert({
            category_id: selectedWorkCategory.id,
            code: editingWorkTypeDB.code,
            name: editingWorkTypeDB.name,
            description: editingWorkTypeDB.description,
            sort_order: formWorkTypesDB.filter(wt => wt.category_id === selectedWorkCategory.id).length,
          });

        if (error) throw error;
        showNotification('Typ pracy dodany', 'success');
      }

      setWorkTypeDBDialog(false);
      setEditingWorkTypeDB(null);
      if (selectedTemplate) {
        await loadFormTemplateDetails(selectedTemplate.id);
      }
    } catch (error: any) {
      console.error('Error saving work type:', error);
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ============ Render Rodzaj Prac Tab ============
  const renderRodzajPracTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={requestWorkTypeSearch}
            onChange={(e) => setRequestWorkTypeSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingRequestWorkType({ is_active: true });
            setRequestWorkTypeDialog(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Dodaj rodzaj prac
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Kod</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Nazwa</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Opis</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequestWorkTypes.map(wt => (
              <tr key={wt.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-sm">{wt.code}</td>
                <td className="px-4 py-3 font-medium">{wt.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{wt.description || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    wt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {wt.is_active ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => {
                        setEditingRequestWorkType(wt);
                        setRequestWorkTypeDialog(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm({ type: 'request_work_type', id: wt.id })}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRequestWorkTypes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Brak rodzajów prac. Kliknij "Dodaj rodzaj prac" aby dodać nowy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Request Work Type Dialog */}
      <Modal
        isOpen={requestWorkTypeDialog}
        onClose={() => {
          setRequestWorkTypeDialog(false);
          setEditingRequestWorkType(null);
        }}
        title={editingRequestWorkType?.id ? 'Edytuj rodzaj prac' : 'Nowy rodzaj prac'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
            <input
              type="text"
              value={editingRequestWorkType?.code || ''}
              onChange={(e) => setEditingRequestWorkType(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. IE, IT, HVAC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingRequestWorkType?.name || ''}
              onChange={(e) => setEditingRequestWorkType(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. IE - Elektryka"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingRequestWorkType?.description || ''}
              onChange={(e) => setEditingRequestWorkType(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Opcjonalny opis"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rwt-active"
              checked={editingRequestWorkType?.is_active ?? true}
              onChange={(e) => setEditingRequestWorkType(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="rwt-active" className="text-sm text-slate-700">Aktywny</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setRequestWorkTypeDialog(false);
                setEditingRequestWorkType(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveRequestWorkType}
              disabled={saving || !editingRequestWorkType?.code || !editingRequestWorkType?.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );

  // ============ Render Wall Types Tab ============
  const renderWallTypesTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={wallTypeSearch}
            onChange={(e) => setWallTypeSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingWallType({ code: '', name: '', wall_category: 'external', is_active: true });
            setWallTypeDialog(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Dodaj rodzaj ściany
        </button>
      </div>

      {/* External walls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Ściany zewnętrzne</h3>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Kod</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Nazwa</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWallTypes.filter(wt => wt.wall_category === 'external').map(wt => (
                <tr key={wt.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-sm">{wt.code}</td>
                  <td className="px-4 py-3 font-medium">{wt.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      wt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {wt.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingWallType(wt);
                          setWallTypeDialog(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm({ type: 'wall_type', id: wt.id })}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredWallTypes.filter(wt => wt.wall_category === 'external').length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Brak ścian zewnętrznych.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Internal walls */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Ściany wewnętrzne</h3>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Kod</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Nazwa</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWallTypes.filter(wt => wt.wall_category === 'internal').map(wt => (
                <tr key={wt.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-sm">{wt.code}</td>
                  <td className="px-4 py-3 font-medium">{wt.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      wt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {wt.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingWallType(wt);
                          setWallTypeDialog(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm({ type: 'wall_type', id: wt.id })}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredWallTypes.filter(wt => wt.wall_category === 'internal').length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Brak ścian wewnętrznych.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wall Type Dialog */}
      <Modal
        isOpen={wallTypeDialog}
        onClose={() => {
          setWallTypeDialog(false);
          setEditingWallType(null);
        }}
        title={editingWallType?.id ? 'Edytuj rodzaj ściany' : 'Nowy rodzaj ściany'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria *</label>
            <select
              value={editingWallType?.wall_category || 'external'}
              onChange={(e) => setEditingWallType(prev => prev ? { ...prev, wall_category: e.target.value } : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="external">Ściana zewnętrzna</option>
              <option value="internal">Ściana wewnętrzna</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
            <input
              type="text"
              value={editingWallType?.code || ''}
              onChange={(e) => setEditingWallType(prev => prev ? { ...prev, code: e.target.value.toLowerCase().replace(/\s+/g, '_') } : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. cegla, gipskarton"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingWallType?.name || ''}
              onChange={(e) => setEditingWallType(prev => prev ? { ...prev, name: e.target.value } : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. Cegła ceramiczna"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wt-active"
              checked={editingWallType?.is_active ?? true}
              onChange={(e) => setEditingWallType(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="wt-active" className="text-sm text-slate-700">Aktywny</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setWallTypeDialog(false);
                setEditingWallType(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveWallType}
              disabled={saving || !editingWallType?.code || !editingWallType?.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );

  // ============ Render Formularze Tab ============
  const renderFormularzeTab = () => (
    <div>
      {!selectedTemplate ? (
        // Template list view
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Szablony formularzy</h3>
            <button
              onClick={() => {
                setEditingFormTemplate({ is_active: true });
                setFormTemplateDialog(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Dodaj formularz
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formTemplates.map(template => (
              <div
                key={template.id}
                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => {
                  setSelectedTemplate(template);
                  loadFormTemplateDetails(template.id);
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{template.form_type}</h4>
                    <p className="text-sm text-slate-500 mt-1">{template.title}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    template.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {template.is_active ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <FolderOpen className="w-4 h-4" />
                    {template.room_groups?.length || 0} grup
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-4 h-4" />
                    {template.work_categories?.length || 0} kategorii
                  </span>
                </div>
              </div>
            ))}
            {formTemplates.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                Brak formularzy. Kliknij "Dodaj formularz" aby utworzyć nowy.
              </div>
            )}
          </div>
        </div>
      ) : (
        // Template editor view
        <div>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => {
                setSelectedTemplate(null);
                setFormRoomGroups([]);
                setFormRooms([]);
                setFormWorkCategories([]);
                setFormWorkTypesDB([]);
                setSelectedRoomGroup(null);
                setSelectedWorkCategory(null);
              }}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{selectedTemplate.form_type}</h3>
              <p className="text-sm text-slate-500">{selectedTemplate.title}</p>
            </div>
            <button
              onClick={() => {
                setEditingFormTemplate(selectedTemplate);
                setFormTemplateDialog(true);
              }}
              className="ml-auto p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Left panel - Room groups */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-semibold text-slate-900">Grupy pomieszczeń</h4>
                <button
                  onClick={() => {
                    setEditingRoomGroup({});
                    setRoomGroupDialog(true);
                  }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {formRoomGroups.map(group => (
                  <div key={group.id}>
                    <div
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${
                        selectedRoomGroup?.id === group.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedRoomGroup(selectedRoomGroup?.id === group.id ? null : group)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color || '#f59e0b' }}
                        />
                        <span className="font-medium">{group.name}</span>
                        <span className="text-xs text-slate-400">({group.code})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoomGroup(group);
                            setRoomGroupDialog(true);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition ${
                          selectedRoomGroup?.id === group.id ? 'rotate-90' : ''
                        }`} />
                      </div>
                    </div>
                    {selectedRoomGroup?.id === group.id && (
                      <div className="bg-slate-50 border-t border-slate-100">
                        <div className="px-4 py-2 flex justify-between items-center border-b border-slate-100">
                          <span className="text-xs font-medium text-slate-500">POMIESZCZENIA</span>
                          <button
                            onClick={() => {
                              setEditingRoom({});
                              setRoomDialog(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {formRooms.filter(r => r.group_id === group.id).map(room => (
                          <div
                            key={room.id}
                            className="px-6 py-2 flex items-center justify-between hover:bg-slate-100"
                          >
                            <span className="text-sm">{room.name}</span>
                            <button
                              onClick={() => {
                                setEditingRoom(room);
                                setRoomDialog(true);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {formRooms.filter(r => r.group_id === group.id).length === 0 && (
                          <div className="px-6 py-2 text-xs text-slate-400">Brak pomieszczeń</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {formRoomGroups.length === 0 && (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">
                    Brak grup pomieszczeń
                  </div>
                )}
              </div>
            </div>

            {/* Right panel - Work categories */}
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-semibold text-slate-900">Kategorie prac</h4>
                <button
                  onClick={() => {
                    setEditingWorkCategory({});
                    setWorkCategoryDialog(true);
                  }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {formWorkCategories.map(category => (
                  <div key={category.id}>
                    <div
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${
                        selectedWorkCategory?.id === category.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedWorkCategory(selectedWorkCategory?.id === category.id ? null : category)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color || '#3b82f6' }}
                        />
                        <span className="font-medium">{category.name}</span>
                        <span className="text-xs text-slate-400">({category.code})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkCategory(category);
                            setWorkCategoryDialog(true);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition ${
                          selectedWorkCategory?.id === category.id ? 'rotate-90' : ''
                        }`} />
                      </div>
                    </div>
                    {selectedWorkCategory?.id === category.id && (
                      <div className="bg-slate-50 border-t border-slate-100">
                        <div className="px-4 py-2 flex justify-between items-center border-b border-slate-100">
                          <span className="text-xs font-medium text-slate-500">TYPY PRAC</span>
                          <button
                            onClick={() => {
                              setEditingWorkTypeDB({});
                              setWorkTypeDBDialog(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {formWorkTypesDB.filter(wt => wt.category_id === category.id).map(workType => (
                          <div
                            key={workType.id}
                            className="px-6 py-2 flex items-center justify-between hover:bg-slate-100"
                          >
                            <span className="text-sm">{workType.name}</span>
                            <button
                              onClick={() => {
                                setEditingWorkTypeDB(workType);
                                setWorkTypeDBDialog(true);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {formWorkTypesDB.filter(wt => wt.category_id === category.id).length === 0 && (
                          <div className="px-6 py-2 text-xs text-slate-400">Brak typów prac</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {formWorkCategories.length === 0 && (
                  <div className="px-4 py-8 text-center text-slate-400 text-sm">
                    Brak kategorii prac
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Template Dialog */}
      <Modal
        isOpen={formTemplateDialog}
        onClose={() => {
          setFormTemplateDialog(false);
          setEditingFormTemplate(null);
        }}
        title={editingFormTemplate?.id ? 'Edytuj formularz' : 'Nowy formularz'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Typ formularza *</label>
            <select
              value={editingFormTemplate?.form_type || ''}
              onChange={(e) => setEditingFormTemplate(prev => ({ ...prev, form_type: e.target.value as KosztorysFormType }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wybierz typ...</option>
              {FORM_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł *</label>
            <input
              type="text"
              value={editingFormTemplate?.title || ''}
              onChange={(e) => setEditingFormTemplate(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. Formularz mieszkania - elektryka"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Typ obiektu</label>
            <input
              type="text"
              value={editingFormTemplate?.object_type || ''}
              onChange={(e) => setEditingFormTemplate(prev => ({ ...prev, object_type: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. residential, industrial"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ft-active"
              checked={editingFormTemplate?.is_active ?? true}
              onChange={(e) => setEditingFormTemplate(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="ft-active" className="text-sm text-slate-700">Aktywny</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setFormTemplateDialog(false);
                setEditingFormTemplate(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveFormTemplate}
              disabled={saving || !editingFormTemplate?.form_type || !editingFormTemplate?.title}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz
            </button>
          </div>
        </div>
      </Modal>

      {/* Room Group Dialog */}
      <Modal
        isOpen={roomGroupDialog}
        onClose={() => {
          setRoomGroupDialog(false);
          setEditingRoomGroup(null);
        }}
        title={editingRoomGroup?.id ? 'Edytuj grupę' : 'Nowa grupa pomieszczeń'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
            <input
              type="text"
              value={editingRoomGroup?.code || ''}
              onChange={(e) => setEditingRoomGroup(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. GARAZ, KLATKI"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingRoomGroup?.name || ''}
              onChange={(e) => setEditingRoomGroup(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. Garaż podziemny"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kolor</label>
            <input
              type="color"
              value={editingRoomGroup?.color || '#f59e0b'}
              onChange={(e) => setEditingRoomGroup(prev => ({ ...prev, color: e.target.value }))}
              className="w-full h-10 rounded-lg cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setRoomGroupDialog(false);
                setEditingRoomGroup(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveRoomGroup}
              disabled={saving || !editingRoomGroup?.code || !editingRoomGroup?.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz
            </button>
          </div>
        </div>
      </Modal>

      {/* Room Dialog */}
      <Modal
        isOpen={roomDialog}
        onClose={() => {
          setRoomDialog(false);
          setEditingRoom(null);
        }}
        title={editingRoom?.id ? 'Edytuj pomieszczenie' : 'Nowe pomieszczenie'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
            <input
              type="text"
              value={editingRoom?.code || ''}
              onChange={(e) => setEditingRoom(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. GARAZ_OSW"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingRoom?.name || ''}
              onChange={(e) => setEditingRoom(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. Oświetlenie podstawowe"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setRoomDialog(false);
                setEditingRoom(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveRoom}
              disabled={saving || !editingRoom?.code || !editingRoom?.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz
            </button>
          </div>
        </div>
      </Modal>

      {/* Work Category Dialog */}
      <Modal
        isOpen={workCategoryDialog}
        onClose={() => {
          setWorkCategoryDialog(false);
          setEditingWorkCategory(null);
        }}
        title={editingWorkCategory?.id ? 'Edytuj kategorię' : 'Nowa kategoria prac'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
            <input
              type="text"
              value={editingWorkCategory?.code || ''}
              onChange={(e) => setEditingWorkCategory(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. OKAB, MONT"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingWorkCategory?.name || ''}
              onChange={(e) => setEditingWorkCategory(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. Okablowanie"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kolor</label>
            <input
              type="color"
              value={editingWorkCategory?.color || '#3b82f6'}
              onChange={(e) => setEditingWorkCategory(prev => ({ ...prev, color: e.target.value }))}
              className="w-full h-10 rounded-lg cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setWorkCategoryDialog(false);
                setEditingWorkCategory(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveWorkCategory}
              disabled={saving || !editingWorkCategory?.code || !editingWorkCategory?.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz
            </button>
          </div>
        </div>
      </Modal>

      {/* Work Type DB Dialog */}
      <Modal
        isOpen={workTypeDBDialog}
        onClose={() => {
          setWorkTypeDBDialog(false);
          setEditingWorkTypeDB(null);
        }}
        title={editingWorkTypeDB?.id ? 'Edytuj typ pracy' : 'Nowy typ pracy'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
            <input
              type="text"
              value={editingWorkTypeDB?.code || ''}
              onChange={(e) => setEditingWorkTypeDB(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. KABEL_YKY"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingWorkTypeDB?.name || ''}
              onChange={(e) => setEditingWorkTypeDB(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. Kabel YKY 5x10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingWorkTypeDB?.description || ''}
              onChange={(e) => setEditingWorkTypeDB(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Opcjonalny opis"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setWorkTypeDBDialog(false);
                setEditingWorkTypeDB(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveWorkTypeDB}
              disabled={saving || !editingWorkTypeDB?.code || !editingWorkTypeDB?.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Zapisz
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );

  // ============ Render Work Types Tab ============
  const renderWorkTypesTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={workTypeSearch}
            onChange={(e) => setWorkTypeSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingWorkType({ is_active: true, labor_hours: 1 });
            setWorkTypeDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj typ pracy
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nazwa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kategoria</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jednostka</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">R-g</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Akcje</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredWorkTypes.map((wt) => (
              <tr key={wt.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{wt.code}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{wt.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                    {WORK_CATEGORIES.find(c => c.value === wt.category)?.label || wt.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{wt.unit}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">{wt.labor_hours}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${wt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {wt.is_active ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingWorkType(wt);
                      setWorkTypeDialog(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm({ type: 'workType', id: wt.id })}
                    className="p-1 text-slate-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredWorkTypes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Brak typów prac
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Work Type Dialog */}
      <Modal
        isOpen={workTypeDialog}
        onClose={() => setWorkTypeDialog(false)}
        title={editingWorkType?.id ? 'Edytuj typ pracy' : 'Dodaj typ pracy'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
              <input
                type="text"
                value={editingWorkType?.code || ''}
                onChange={(e) => setEditingWorkType({ ...editingWorkType, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria</label>
              <select
                value={editingWorkType?.category || ''}
                onChange={(e) => setEditingWorkType({ ...editingWorkType, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {WORK_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingWorkType?.name || ''}
              onChange={(e) => setEditingWorkType({ ...editingWorkType, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka</label>
              <select
                value={editingWorkType?.unit || ''}
                onChange={(e) => setEditingWorkType({ ...editingWorkType, unit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {DEFAULT_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">R-g (godz.)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={editingWorkType?.labor_hours || ''}
                onChange={(e) => setEditingWorkType({ ...editingWorkType, labor_hours: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingWorkType?.description || ''}
              onChange={(e) => setEditingWorkType({ ...editingWorkType, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="wt-active"
              checked={editingWorkType?.is_active ?? true}
              onChange={(e) => setEditingWorkType({ ...editingWorkType, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300"
            />
            <label htmlFor="wt-active" className="ml-2 text-sm text-slate-700">Aktywny</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setWorkTypeDialog(false)}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveWorkType}
            disabled={saving || !editingWorkType?.code || !editingWorkType?.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>
    </div>
  );

  // ============ Render Materials Tab ============
  const renderMaterialsTab = () => {
    const mat = editingMaterial as any;
    const isCodeRequired = !autoGenerateCode;
    const canSaveMaterial = editingMaterial?.name && ((editingMaterial as any).purchase_price > 0 || editingMaterial.default_price) && (autoGenerateCode || editingMaterial.code);

    return (
    <div>
      {/* ===== Onninen-style layout ===== */}
      <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 320px)', minHeight: 500 }}>
        {/* Left sidebar: Categories */}
        <div className="w-60 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategorie</span>
            <button
              onClick={() => { setShowAddCategory(true); setAddSubcategoryParentId(null); setNewCategoryName(''); }}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
              title="Dodaj kategorię"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-1">
            {/* "All" */}
            <button
              onClick={() => setSelectedMaterialCategory(null)}
              className={`w-full text-left flex items-center gap-1.5 py-1.5 px-2.5 text-xs rounded transition-colors ${
                !selectedMaterialCategory ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 opacity-40" />
              <span className="truncate">Wszystkie</span>
              <span className="ml-auto text-[10px] text-slate-400">{materials.length}</span>
            </button>

            {/* Recursive category tree */}
            {(() => {
              const renderCatNode = (cat: typeof customCategories[0], depth: number): React.ReactNode => {
                const children = getCategoryChildren(cat.id);
                const hasChildren = children.length > 0;
                const isExpanded = expandedCategories.has(cat.id);
                const isEditing = editingCategoryId === cat.id;
                const isAddingSub = addSubcategoryParentId === cat.id;
                const directCount = materials.filter(m => m.category === cat.name).length;
                const totalCount = getCategoryMaterialCount(cat.name);

                return (
                  <div key={cat.id}>
                    {isEditing ? (
                      /* ---- Inline rename mode ---- */
                      <div className="px-1.5 py-1" style={{ paddingLeft: 6 + depth * 14 }}>
                        <input
                          autoFocus
                          value={editingCategoryName}
                          onChange={e => setEditingCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameCategory(cat.id);
                            if (e.key === 'Escape') { setEditingCategoryId(null); setEditingCategoryName(''); }
                          }}
                          className="w-full px-2 py-1 text-xs border border-blue-400 rounded focus:ring-1 focus:ring-blue-500 mb-1"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRenameCategory(cat.id)}
                            className="flex-1 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700"
                          >
                            Zapisz
                          </button>
                          <button
                            onClick={() => setDeleteCategoryConfirm({ id: cat.id, name: cat.name, parent_id: cat.parent_id })}
                            className="py-0.5 px-2 bg-red-50 text-red-600 rounded text-[10px] hover:bg-red-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }}
                            className="flex-1 py-0.5 border border-slate-300 rounded text-[10px] hover:bg-slate-50"
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ---- Normal category row ---- */
                      <div className="group flex items-center" style={{ paddingLeft: depth * 14 }}>
                        <button
                          onClick={() => {
                            setSelectedMaterialCategory(cat.name);
                            if (hasChildren) {
                              setExpandedCategories(prev => {
                                const next = new Set(prev);
                                if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id);
                                return next;
                              });
                            }
                          }}
                          className={`flex-1 text-left flex items-center gap-1 py-1.5 px-2 text-xs rounded transition-colors min-w-0 ${
                            selectedMaterialCategory === cat.name
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {hasChildren ? (
                            <ChevronRight className={`w-3 h-3 flex-shrink-0 opacity-40 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          ) : (
                            <span className="w-3 flex-shrink-0" />
                          )}
                          <FolderOpen className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
                          <span className="truncate">{cat.name}</span>
                          <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">{totalCount}</span>
                        </button>

                        {/* Edit + Add sub buttons */}
                        <div className="flex items-center gap-0.5 pr-1 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategoryId(cat.id);
                              setEditingCategoryName(cat.name);
                            }}
                            className="p-0.5 text-slate-400 hover:text-blue-600 rounded"
                            title="Edytuj kategorię"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddSubcategoryParentId(cat.id);
                              setShowAddCategory(false);
                              setNewCategoryName('');
                              setExpandedCategories(prev => new Set([...prev, cat.id]));
                            }}
                            className="p-0.5 text-slate-400 hover:text-green-600 rounded"
                            title="Dodaj podkategorię"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Children */}
                    {isExpanded && hasChildren && children.map(child => renderCatNode(child, depth + 1))}

                    {/* Add subcategory inline form */}
                    {isAddingSub && (
                      <div className="px-1.5 py-1" style={{ paddingLeft: 12 + (depth + 1) * 14 }}>
                        <input
                          autoFocus
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddCustomCategory(cat.id);
                            if (e.key === 'Escape') { setAddSubcategoryParentId(null); setNewCategoryName(''); }
                          }}
                          placeholder="Nazwa podkategorii..."
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 mb-1"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => handleAddCustomCategory(cat.id)} className="flex-1 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700">Dodaj</button>
                          <button onClick={() => { setAddSubcategoryParentId(null); setNewCategoryName(''); }} className="flex-1 py-0.5 border border-slate-300 rounded text-[10px] hover:bg-slate-50">Anuluj</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return getCategoryChildren(null).map(cat => renderCatNode(cat, 0));
            })()}

            {/* Uncategorized */}
            {materials.some(m => !m.category) && (
              <button
                onClick={() => setSelectedMaterialCategory('__none__')}
                className={`w-full text-left flex items-center gap-1.5 py-1.5 px-2.5 text-xs rounded transition-colors ${
                  selectedMaterialCategory === '__none__' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 opacity-40" />
                <span className="truncate">Bez kategorii</span>
                <span className="ml-auto text-[10px] text-slate-400">{materials.filter(m => !m.category).length}</span>
              </button>
            )}
          </div>

          {/* Add root category inline form */}
          {showAddCategory && !addSubcategoryParentId && (
            <div className="px-2 py-2 border-t border-slate-200">
              <input
                autoFocus
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddCustomCategory(null);
                  if (e.key === 'Escape') { setShowAddCategory(false); setNewCategoryName(''); }
                }}
                placeholder="Nazwa kategorii..."
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-1 mt-1">
                <button onClick={() => handleAddCustomCategory(null)} className="flex-1 py-1 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700">Dodaj</button>
                <button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="flex-1 py-1 border border-slate-300 rounded text-[10px] hover:bg-slate-50">Anuluj</button>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 bg-white">
            <div className="flex-1 max-w-md flex items-center bg-slate-100 rounded-lg px-3 border border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={materialSearch}
                onChange={e => setMaterialSearch(e.target.value)}
                placeholder="Szukaj materiałów..."
                className="flex-1 bg-transparent border-none px-2.5 py-2 text-sm outline-none text-slate-700 placeholder-slate-400"
              />
              {materialSearch && (
                <button onClick={() => setMaterialSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-1 bg-slate-100 rounded p-0.5">
              <button
                onClick={() => setMaterialViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${materialViewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMaterialViewMode('list')}
                className={`p-1.5 rounded transition-colors ${materialViewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs text-slate-400 whitespace-nowrap">{filteredMaterials.length} materiałów</span>

            <button
              onClick={() => {
                setEditingMaterial({ is_active: true, default_price: 0 } as any);
                setAutoGenerateCode(true);
                setMaterialImages([]);
                setMaterialDialog(true);
              }}
              className="ml-auto flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Dodaj materiał
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Package className="w-12 h-12 text-slate-200 mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Własny katalog materiałów</h3>
                <p className="text-sm text-slate-400 max-w-sm">
                  {materialSearch ? `Brak wyników dla «${materialSearch}»` : 'Dodaj materiały ręcznie lub importuj z gurtowni.'}
                </p>
              </div>
            ) : materialViewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredMaterials.map(m => {
                  const imgs = (() => { try { return JSON.parse((m as any).images || '[]'); } catch { return []; } })();
                  return (
                    <div
                      key={m.id}
                      onClick={() => setDetailMaterial(m)}
                      className="bg-white rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                    >
                      <div className="h-32 bg-slate-50 flex items-center justify-center border-b border-slate-100">
                        {imgs.length > 0 ? (
                          <img src={imgs[0]} alt="" className="max-w-[85%] max-h-28 object-contain" />
                        ) : (
                          <Package className="w-10 h-10 text-slate-200" />
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="text-[10px] text-slate-400 font-mono">{m.code}</div>
                        <div className="text-xs font-medium text-slate-800 mt-0.5 line-clamp-2 min-h-[32px]">{m.name}</div>
                        {m.manufacturer && <div className="text-[10px] text-slate-400 mt-0.5">{m.manufacturer}</div>}
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                          {((m as any).purchase_price || m.default_price) ? (
                            <span className="text-sm font-bold text-blue-600">
                              {((m as any).purchase_price || m.default_price)?.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">zł</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                          <span className={`px-1.5 py-0.5 text-[10px] rounded ${m.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {m.is_active ? 'Aktywny' : 'Nieaktywny'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMaterials.map(m => {
                  const imgs = (() => { try { return JSON.parse((m as any).images || '[]'); } catch { return []; } })();
                  return (
                    <div
                      key={m.id}
                      onClick={() => setDetailMaterial(m)}
                      className="bg-white rounded-lg border border-slate-200 p-2.5 flex items-center gap-3 cursor-pointer hover:border-blue-400 transition-colors"
                    >
                      <div className="w-14 h-14 bg-slate-50 rounded flex items-center justify-center flex-shrink-0">
                        {imgs.length > 0 ? (
                          <img src={imgs[0]} alt="" className="max-w-[90%] max-h-[90%] object-contain" />
                        ) : (
                          <Package className="w-6 h-6 text-slate-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800 truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.code}{m.manufacturer ? ` · ${m.manufacturer}` : ''}</div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${m.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {m.is_active ? 'Aktywny' : 'Nieaktywny'}
                        </span>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {((m as any).purchase_price || m.default_price) ? (
                          <span className="text-sm font-bold text-blue-600">{((m as any).purchase_price || m.default_price)?.toFixed(2)} zł</span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Product Detail Modal ===== */}
      {detailMaterial && (() => {
        const dm = detailMaterial as any;
        const imgs = (() => { try { return JSON.parse(dm.images || '[]'); } catch { return []; } })();
        return (
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto bg-black/40 backdrop-blur-sm" onClick={() => setDetailMaterial(null)}>
            <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingMaterial(dm);
                      setAutoGenerateCode(false);
                      setMaterialImages(imgs);
                      setMaterialDialog(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edytuj
                  </button>
                  <button
                    onClick={() => setDeleteMaterialConfirm({ id: dm.id, name: dm.name })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Usuń
                  </button>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {dm.code}{dm.ean ? ` · EAN: ${dm.ean}` : ''}{dm.sku ? ` · SKU: ${dm.sku}` : ''}
                </span>
                <button onClick={() => setDetailMaterial(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex flex-wrap">
                {/* Image */}
                <div className="w-64 min-h-[220px] bg-slate-50 flex items-center justify-center p-4">
                  {imgs.length > 0 ? (
                    <img src={imgs[0]} alt="" className="max-w-[90%] max-h-52 object-contain" />
                  ) : (
                    <Package className="w-14 h-14 text-slate-200" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-5 min-w-[260px]">
                  <h2 className="text-base font-semibold text-slate-900 mb-2 leading-tight">{dm.name}</h2>
                  {dm.manufacturer && <p className="text-xs text-slate-500">Producent: <span className="font-medium text-slate-700">{dm.manufacturer}</span></p>}
                  {dm.category && <p className="text-xs text-slate-400 mt-0.5">Kategoria: {dm.category}</p>}

                  {/* Price block */}
                  <div className="mt-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    {(dm.purchase_price || dm.default_price) ? (
                      <>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cena zakupu</div>
                        <div className="text-xl font-bold text-blue-600">
                          {(dm.purchase_price || dm.default_price)?.toFixed(2)} <span className="text-sm font-normal">zł netto</span>
                          {dm.catalog_price && dm.catalog_price > 0 && (dm.purchase_price || dm.default_price) < dm.catalog_price && (
                            <span className="ml-2 text-sm font-semibold text-green-600">
                              -{((dm.catalog_price - (dm.purchase_price || dm.default_price)) / dm.catalog_price * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                        {dm.catalog_price != null && (
                          <div className="mt-1 text-xs text-slate-400">
                            Cena katalogowa: <span className="line-through">{dm.catalog_price?.toFixed(2)} zł</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-slate-400">Cena niedostępna</div>
                    )}
                  </div>

                  {/* Meta badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {dm.unit && (
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">Jedn.: <b>{dm.unit}</b></span>
                    )}
                    {dm.source_wholesaler && (
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                        Źródło: <b>{dm.source_wholesaler === 'tim' ? 'TIM' : dm.source_wholesaler === 'oninen' ? 'Onninen' : dm.source_wholesaler}</b>
                      </span>
                    )}
                    {dm.source_wholesaler && (
                      dm.price_sync_mode === 'synced'
                        ? <span className="px-2 py-0.5 bg-yellow-100 rounded text-[10px] text-yellow-700">Synchronizacja cen</span>
                        : <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500">Cena nie synchronizowana</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] ${dm.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {dm.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price & Availability Table from wholesalers */}
              {(dm.ean || dm.sku) && (
                <div className="px-5 pb-4">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">Ceny i dostępność w hurtowniach</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-500 font-medium">Hurtownia</th>
                          <th className="px-3 py-2 text-right text-slate-500 font-medium">Cena katalogowa</th>
                          <th className="px-3 py-2 text-right text-slate-500 font-medium">Cena zakupu</th>
                          <th className="px-3 py-2 text-center text-slate-500 font-medium">Dostępność</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingPrices ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600 mx-auto" />
                            </td>
                          </tr>
                        ) : wholesalerPrices.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                              Brak danych z hurtowni. Kliknij aby wyszukać.
                            </td>
                          </tr>
                        ) : (
                          wholesalerPrices.map((wp, idx) => {
                            const prices = wholesalerPrices.filter(p => p.purchasePrice != null).map(p => p.purchasePrice!);
                            const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
                            const worstPrice = prices.length > 1 ? Math.max(...prices) : null;
                            const isBest = bestPrice != null && wp.purchasePrice === bestPrice && prices.length > 1;
                            const isWorst = worstPrice != null && wp.purchasePrice === worstPrice && worstPrice !== bestPrice;
                            return (
                              <tr key={idx} className={`${isBest ? 'bg-green-50' : isWorst ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                <td className="px-3 py-2 font-medium text-slate-700">{wp.wholesaler}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{wp.catalogPrice?.toFixed(2) ?? '—'} zł</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-800">{wp.purchasePrice?.toFixed(2) ?? '—'} zł</td>
                                <td className="px-3 py-2 text-center">
                                  {wp.stock != null ? (
                                    <span className={`px-1.5 py-0.5 rounded ${wp.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                      {wp.stock > 0 ? `${wp.stock} szt.` : 'Brak'}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  {wp.url && (
                                    <a href={wp.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Description */}
              {dm.description && (
                <div className="px-5 pb-4">
                  <h4 className="text-xs font-semibold text-slate-600 mb-1.5">Opis</h4>
                  <div className="text-xs text-slate-500 leading-relaxed prose prose-xs max-w-none" dangerouslySetInnerHTML={{ __html: dm.description }} />
                </div>
              )}

              {/* All images */}
              {imgs.length > 1 && (
                <div className="px-5 pb-4">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">Zdjęcia</h4>
                  <div className="flex gap-2 flex-wrap">
                    {imgs.map((img: string, i: number) => (
                      <div key={i} className="w-20 h-20 bg-slate-50 rounded border border-slate-200 flex items-center justify-center">
                        <img src={img} alt="" className="max-w-[90%] max-h-[90%] object-contain" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===== Material Dialog (Dodaj / Edytuj materiał) ===== */}
      <Modal
        isOpen={materialDialog}
        onClose={() => { setMaterialDialog(false); setEditingMaterial(null); setMaterialImages([]); }}
        title={editingMaterial?.id ? 'Edytuj materiał' : 'Dodaj materiał'}
        size="lg"
        zIndex={75}
      >
        <div className="space-y-4">
          {/* Aktywny checkbox at top left */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mat-active-top"
              checked={editingMaterial?.is_active ?? true}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300"
            />
            <label htmlFor="mat-active-top" className="text-sm font-medium text-slate-700">Aktywny</label>
          </div>

          {/* Code + auto-generate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Kod materiału {isCodeRequired ? '*' : ''}</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateCode}
                  onChange={(e) => setAutoGenerateCode(e.target.checked)}
                  className="h-3.5 w-3.5 text-blue-600 rounded border-slate-300"
                  disabled={!!editingMaterial?.id}
                />
                Generuj automatycznie
              </label>
            </div>
            <input
              type="text"
              value={autoGenerateCode && !editingMaterial?.id ? '(automatycznie)' : editingMaterial?.code || ''}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, code: e.target.value })}
              disabled={autoGenerateCode && !editingMaterial?.id}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="np. MAT-00001"
            />
          </div>

          {/* Nazwa */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingMaterial?.name || ''}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nazwa materiału"
            />
          </div>

          {/* Kategoria dropdown + add */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria</label>
            <div className="flex gap-1.5">
              <select
                value={editingMaterial?.category || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, category: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz kategorię...</option>
                {(() => {
                  const renderOpts = (parentId: string | null, depth: number): React.ReactNode[] =>
                    getCategoryChildren(parentId).map(cat => [
                      <option key={cat.id} value={cat.name}>{'—'.repeat(depth) + (depth ? ' ' : '') + cat.name}</option>,
                      ...renderOpts(cat.id, depth + 1),
                    ]).flat();
                  const customCatNames = new Set(customCategories.map(c => c.name));
                  const extraCats = [...new Set(materials.map(m => m.category).filter((c): c is string => !!c && !customCatNames.has(c)))];
                  return [
                    ...renderOpts(null, 0),
                    ...extraCats.map(name => (
                      <option key={`extra-${name}`} value={name}>{name}</option>
                    )),
                  ];
                })()}
              </select>
              {/* Edit selected category */}
              {editingMaterial?.category && customCategories.some(c => c.name === editingMaterial.category) && (
                <button
                  type="button"
                  onClick={() => {
                    const cat = customCategories.find(c => c.name === editingMaterial.category);
                    if (cat) {
                      setEditingCategoryId(cat.id);
                      setEditingCategoryName(cat.name);
                    }
                  }}
                  className="px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-blue-600"
                  title="Edytuj kategorię"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Add subcategory of selected */}
              {editingMaterial?.category && customCategories.some(c => c.name === editingMaterial.category) && (
                <button
                  type="button"
                  onClick={() => {
                    const cat = customCategories.find(c => c.name === editingMaterial.category);
                    if (cat) {
                      setAddSubcategoryParentId(cat.id);
                      setNewCategoryName('');
                      setExpandedCategories(prev => new Set([...prev, cat.id]));
                    }
                  }}
                  className="px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-green-600"
                  title="Dodaj podkategorię"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Add new root category */}
              <button
                type="button"
                onClick={() => { setShowAddCategory(true); setAddSubcategoryParentId(null); setNewCategoryName(''); }}
                className="px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                title="Dodaj nową kategorię"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* EAN + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">EAN</label>
              <input
                type="text"
                value={(editingMaterial as any)?.ean || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, ean: e.target.value } as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Kod EAN"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
              <input
                type="text"
                value={(editingMaterial as any)?.sku || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, sku: e.target.value } as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Kod SKU"
              />
            </div>
          </div>

          {/* Producent dropdown + add */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Producent</label>
            <div className="flex gap-2">
              <select
                value={editingMaterial?.manufacturer || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, manufacturer: e.target.value })}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz producenta...</option>
                {(() => {
                  const customNames = new Set(customManufacturers.map(m => m.name));
                  const materialMfrs = [...new Set(materials.map(m => m.manufacturer).filter((m): m is string => !!m && !customNames.has(m)))];
                  return [
                    ...customManufacturers.map(mfr => (
                      <option key={mfr.id} value={mfr.name}>{mfr.name}</option>
                    )),
                    ...materialMfrs.map(name => (
                      <option key={`mat-${name}`} value={name}>{name}</option>
                    )),
                  ];
                })()}
              </select>
              <button
                type="button"
                onClick={() => setShowAddManufacturer(true)}
                className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                title="Dodaj nowego producenta"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Jednostka dropdown + add */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka miary</label>
            <div className="flex gap-2">
              <select
                value={(editingMaterial as any)?.unit || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, unit: e.target.value } as any)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {customUnits.map(u => (
                  <option key={u.id} value={u.value}>{u.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddUnit(true)}
                className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                title="Dodaj nową jednostkę"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Price sync toggle */}
          {(editingMaterial as any)?.source_wholesaler && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="priceSyncToggle"
                checked={(editingMaterial as any)?.price_sync_mode === 'synced'}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, price_sync_mode: e.target.checked ? 'synced' : 'fixed' } as any)}
                className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
              />
              <label htmlFor="priceSyncToggle" className="text-sm text-amber-800 cursor-pointer">
                Synchronizacja ceny z hurtownią
                <span className="text-xs text-amber-600 ml-1">
                  ({(editingMaterial as any)?.source_wholesaler === 'tim' ? 'TIM' : (editingMaterial as any)?.source_wholesaler === 'oninen' ? 'Onninen' : (editingMaterial as any)?.source_wholesaler})
                </span>
              </label>
            </div>
          )}

          {/* Prices */}
          {(() => {
            const isSynced = (editingMaterial as any)?.price_sync_mode === 'synced';
            return (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cena katalogowa (PLN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isSynced}
                    value={(editingMaterial as any)?.catalog_price || ''}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, catalog_price: parseFloat(e.target.value) || null } as any)}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isSynced ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                    placeholder="Opcjonalna"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cena zakupu (PLN) *
                    {(() => {
                      const catPrice = (editingMaterial as any)?.catalog_price;
                      const buyPrice = (editingMaterial as any)?.purchase_price || editingMaterial?.default_price;
                      if (catPrice && buyPrice && catPrice > 0 && buyPrice < catPrice) {
                        const discount = ((catPrice - buyPrice) / catPrice * 100).toFixed(1);
                        return <span className="ml-2 text-xs font-normal text-green-600">-{discount}%</span>;
                      }
                      return null;
                    })()}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isSynced}
                    value={(editingMaterial as any)?.purchase_price || editingMaterial?.default_price || ''}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, purchase_price: parseFloat(e.target.value) || 0, default_price: parseFloat(e.target.value) || 0 } as any)}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isSynced ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                    placeholder="Cena zakupu netto"
                  />
                </div>
              </div>
            );
          })()}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingMaterial?.description || ''}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Opcjonalny opis materiału"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Zdjęcia materiału</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {materialImages.map((img, idx) => (
                <div key={idx} className="relative group w-20 h-20 bg-slate-50 rounded border border-slate-200 flex items-center justify-center overflow-hidden">
                  <img src={img} alt="" className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newImgs = [...materialImages];
                          [newImgs[idx - 1], newImgs[idx]] = [newImgs[idx], newImgs[idx - 1]];
                          setMaterialImages(newImgs);
                        }}
                        className="p-1 bg-white rounded text-slate-600 hover:bg-slate-100"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    {idx < materialImages.length - 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newImgs = [...materialImages];
                          [newImgs[idx], newImgs[idx + 1]] = [newImgs[idx + 1], newImgs[idx]];
                          setMaterialImages(newImgs);
                        }}
                        className="p-1 bg-white rounded text-slate-600 hover:bg-slate-100"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMaterialImages(materialImages.filter((_, i) => i !== idx))}
                      className="p-1 bg-white rounded text-red-600 hover:bg-red-50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              <label className="w-20 h-20 bg-slate-50 rounded border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-[10px] text-slate-400 mt-1">Dodaj</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (ev.target?.result) {
                          setMaterialImages(prev => [...prev, ev.target!.result as string]);
                        }
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-400">Przeciągnij aby zmienić kolejność. Pierwsze zdjęcie = miniaturka.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => { setMaterialDialog(false); setEditingMaterial(null); setMaterialImages([]); }}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveMaterial}
            disabled={saving || !canSaveMaterial}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>

      {/* Add Manufacturer Modal */}
      <Modal isOpen={showAddManufacturer} onClose={() => { setShowAddManufacturer(false); setNewManufacturerName(''); }} title="Nowy producent" size="sm">
        <div className="space-y-3">
          <input
            autoFocus
            value={newManufacturerName}
            onChange={e => setNewManufacturerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCustomManufacturer()}
            placeholder="Nazwa producenta"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAddManufacturer(false); setNewManufacturerName(''); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Anuluj</button>
            <button onClick={handleAddCustomManufacturer} disabled={!newManufacturerName.trim()} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Dodaj</button>
          </div>
        </div>
      </Modal>

      {/* Add Unit Modal */}
      <Modal isOpen={showAddUnit} onClose={() => { setShowAddUnit(false); setNewUnitValue(''); setNewUnitLabel(''); }} title="Nowa jednostka miary" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Wartość (skrót)</label>
            <input
              autoFocus
              value={newUnitValue}
              onChange={e => setNewUnitValue(e.target.value)}
              placeholder="np. szt., m², kg"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Etykieta</label>
            <input
              value={newUnitLabel}
              onChange={e => setNewUnitLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustomUnit()}
              placeholder="np. szt. (sztuki)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAddUnit(false); setNewUnitValue(''); setNewUnitLabel(''); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Anuluj</button>
            <button onClick={handleAddCustomUnit} disabled={!newUnitValue.trim() || !newUnitLabel.trim()} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Dodaj</button>
          </div>
        </div>
      </Modal>
    </div>
    );
  };

  // ============ Render Equipment Tab ============
  const renderEquipmentTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={equipmentSearch}
            onChange={(e) => setEquipmentSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingEquipment({ is_active: true, default_price: 0 });
            setEquipmentDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj sprzęt
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nazwa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kategoria</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Producent</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jednostka</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cena</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Akcje</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredEquipment.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{e.code}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{e.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                    {e.category || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{e.manufacturer || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{e.unit}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">
                  {e.default_price?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {e.is_active ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingEquipment(e);
                      setEquipmentDialog(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm({ type: 'equipment', id: e.id })}
                    className="p-1 text-slate-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredEquipment.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Brak sprzętu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Equipment Dialog */}
      <Modal
        isOpen={equipmentDialog}
        onClose={() => setEquipmentDialog(false)}
        title={editingEquipment?.id ? 'Edytuj sprzęt' : 'Dodaj sprzęt'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
              <input
                type="text"
                value={editingEquipment?.code || ''}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria</label>
              <input
                type="text"
                value={editingEquipment?.category || ''}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingEquipment?.name || ''}
              onChange={(e) => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Producent</label>
              <input
                type="text"
                value={editingEquipment?.manufacturer || ''}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka</label>
              <select
                value={editingEquipment?.unit || ''}
                onChange={(e) => setEditingEquipment({ ...editingEquipment, unit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {DEFAULT_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cena domyślna (PLN)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editingEquipment?.default_price || ''}
              onChange={(e) => setEditingEquipment({ ...editingEquipment, default_price: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingEquipment?.description || ''}
              onChange={(e) => setEditingEquipment({ ...editingEquipment, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="eq-active"
              checked={editingEquipment?.is_active ?? true}
              onChange={(e) => setEditingEquipment({ ...editingEquipment, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300"
            />
            <label htmlFor="eq-active" className="ml-2 text-sm text-slate-700">Aktywny</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setEquipmentDialog(false)}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveEquipment}
            disabled={saving || !editingEquipment?.code || !editingEquipment?.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>
    </div>
  );

  // ============ Render Templates Tab ============
  const renderTemplatesTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingTemplate({ is_active: true, base_quantity: 1, labor_hours: 1 });
            setSelectedTemplateMaterials([]);
            setSelectedTemplateEquipment([]);
            setTemplateDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj szablon
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nazwa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Typ pracy</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Materiały</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Sprzęt</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">R-g</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Akcje</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredTemplates.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{t.code}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{t.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{t.work_type?.name || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                    {t.materials?.length || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                    {t.equipment?.length || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">{t.labor_hours}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {t.is_active ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingTemplate(t);
                      setSelectedTemplateMaterials(
                        t.materials?.map((m: any) => ({
                          material_id: m.material_id,
                          quantity: m.quantity,
                        })) || []
                      );
                      setSelectedTemplateEquipment(
                        t.equipment?.map((e: any) => ({
                          equipment_id: e.equipment_id,
                          quantity: e.quantity,
                        })) || []
                      );
                      setTemplateDialog(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm({ type: 'template', id: t.id })}
                    className="p-1 text-slate-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredTemplates.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Brak szablonów
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Template Dialog */}
      <Modal
        isOpen={templateDialog}
        onClose={() => setTemplateDialog(false)}
        title={editingTemplate?.id ? 'Edytuj szablon' : 'Dodaj szablon'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
              <input
                type="text"
                value={editingTemplate?.code || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
              <input
                type="text"
                value={editingTemplate?.name || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Typ pracy</label>
              <select
                value={editingTemplate?.work_type_id || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, work_type_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {workTypes.filter(wt => wt.is_active).map(wt => (
                  <option key={wt.id} value={wt.id}>{wt.code} - {wt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ilość bazowa</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={editingTemplate?.base_quantity || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, base_quantity: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">R-g (godz.)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={editingTemplate?.labor_hours || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, labor_hours: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingTemplate?.description || ''}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Materials section */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-700">Materiały</label>
              <button
                type="button"
                onClick={() => setSelectedTemplateMaterials([...selectedTemplateMaterials, { material_id: '', quantity: 1 }])}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Dodaj materiał
              </button>
            </div>
            {selectedTemplateMaterials.map((tm, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <select
                  value={tm.material_id}
                  onChange={(e) => {
                    const updated = [...selectedTemplateMaterials];
                    updated[index].material_id = e.target.value;
                    setSelectedTemplateMaterials(updated);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Wybierz materiał...</option>
                  {materials.filter(m => m.is_active).map(m => (
                    <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tm.quantity}
                  onChange={(e) => {
                    const updated = [...selectedTemplateMaterials];
                    updated[index].quantity = parseFloat(e.target.value) || 0;
                    setSelectedTemplateMaterials(updated);
                  }}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Ilość"
                />
                <button
                  type="button"
                  onClick={() => setSelectedTemplateMaterials(selectedTemplateMaterials.filter((_, i) => i !== index))}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Equipment section */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-700">Sprzęt</label>
              <button
                type="button"
                onClick={() => setSelectedTemplateEquipment([...selectedTemplateEquipment, { equipment_id: '', quantity: 1 }])}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Dodaj sprzęt
              </button>
            </div>
            {selectedTemplateEquipment.map((te, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <select
                  value={te.equipment_id}
                  onChange={(e) => {
                    const updated = [...selectedTemplateEquipment];
                    updated[index].equipment_id = e.target.value;
                    setSelectedTemplateEquipment(updated);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Wybierz sprzęt...</option>
                  {equipment.filter(eq => eq.is_active).map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.code} - {eq.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={te.quantity}
                  onChange={(e) => {
                    const updated = [...selectedTemplateEquipment];
                    updated[index].quantity = parseFloat(e.target.value) || 0;
                    setSelectedTemplateEquipment(updated);
                  }}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Ilość"
                />
                <button
                  type="button"
                  onClick={() => setSelectedTemplateEquipment(selectedTemplateEquipment.filter((_, i) => i !== index))}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="tpl-active"
              checked={editingTemplate?.is_active ?? true}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300"
            />
            <label htmlFor="tpl-active" className="ml-2 text-sm text-slate-700">Aktywny</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setTemplateDialog(false)}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveTemplate}
            disabled={saving || !editingTemplate?.code || !editingTemplate?.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>
    </div>
  );

  // ============ Render Mapping Tab ============
  const renderMappingTab = () => (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <p className="text-sm text-blue-700">
            Reguły mapowania określają, które szablony zadań zostaną zastosowane dla poszczególnych kombinacji
            pomieszczenie + typ pracy w formularzu. Wartość w komórce formularza jest mnożona przez mnożnik.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={mappingSearch}
            onChange={(e) => setMappingSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingMapping({ is_active: true, multiplier: 1, priority: 0 });
            setMappingDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj regułę
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Formularz</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pomieszczenie</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod pracy</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Szablon</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Mnożnik</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Priorytet</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Akcje</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredMappings.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700">
                    {m.form_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.room_code}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.work_code}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {m.template_task ? `${m.template_task.code} - ${m.template_task.name}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">{m.multiplier}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">{m.priority}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {m.is_active ? 'Aktywna' : 'Nieaktywna'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingMapping(m);
                      setMappingDialog(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm({ type: 'mapping', id: m.id })}
                    className="p-1 text-slate-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredMappings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Brak reguł mapowania
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mapping Dialog */}
      <Modal
        isOpen={mappingDialog}
        onClose={() => setMappingDialog(false)}
        title={editingMapping?.id ? 'Edytuj regułę' : 'Dodaj regułę mapowania'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Typ formularza *</label>
              <select
                value={editingMapping?.form_type || ''}
                onChange={(e) => setEditingMapping({ ...editingMapping, form_type: e.target.value as KosztorysFormType })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {FORM_TYPES.map(ft => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kod pomieszczenia *</label>
              <input
                type="text"
                value={editingMapping?.room_code || ''}
                onChange={(e) => setEditingMapping({ ...editingMapping, room_code: e.target.value })}
                placeholder="np. MIESZK"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod pracy *</label>
            <input
              type="text"
              value={editingMapping?.work_code || ''}
              onChange={(e) => setEditingMapping({ ...editingMapping, work_code: e.target.value })}
              placeholder="np. OKAB-01"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Szablon zadania *</label>
            <select
              value={editingMapping?.template_task_id || ''}
              onChange={(e) => setEditingMapping({ ...editingMapping, template_task_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wybierz szablon...</option>
              {templateTasks.filter(t => t.is_active).map(t => (
                <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mnożnik</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={editingMapping?.multiplier || ''}
                onChange={(e) => setEditingMapping({ ...editingMapping, multiplier: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">Wartość formularza × mnożnik = ilość</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
              <input
                type="number"
                value={editingMapping?.priority || ''}
                onChange={(e) => setEditingMapping({ ...editingMapping, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">Wyższy = ważniejszy</p>
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="map-active"
              checked={editingMapping?.is_active ?? true}
              onChange={(e) => setEditingMapping({ ...editingMapping, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300"
            />
            <label htmlFor="map-active" className="ml-2 text-sm text-slate-700">Aktywna</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setMappingDialog(false)}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveMapping}
            disabled={saving || !editingMapping?.form_type || !editingMapping?.room_code || !editingMapping?.work_code || !editingMapping?.template_task_id}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>
    </div>
  );

  // ============ Statistics ============
  const stats = [
    { label: 'Robocizna', value: workTypes.length, icon: Wrench, color: 'text-blue-600' },
    { label: 'Materiały', value: materials.length, icon: Package, color: 'text-green-600' },
    { label: 'Sprzęt', value: equipment.length, icon: Monitor, color: 'text-orange-600' },
  ];

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {activeTab === 'work_types' && renderWorkTypesTab()}

              {activeTab === 'materials' && (
                <div>
                  {/* Sub-tabs: Własny katalog + wholesaler tabs + Integrację button */}
                  <div className="flex items-center gap-1 mb-4">
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                      <button
                        onClick={() => setMaterialsSubTab('own')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          materialsSubTab === 'own'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Własny katalog
                      </button>
                      {integrations.filter(i => i.is_active).map(integ => (
                        <button
                          key={integ.id}
                          onClick={() => setMaterialsSubTab(integ.wholesaler_id)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            materialsSubTab === integ.wholesaler_id
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {integ.wholesaler_name}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowIntegrationModal(true)}
                      className="ml-2 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Store className="w-4 h-4" />
                      Integrację
                    </button>
                  </div>
                  {materialsSubTab === 'own' && renderMaterialsTab()}
                  {materialsSubTab === 'tim' && (
                    <TIMIntegrator integrationId={integrations.find(i => i.wholesaler_id === 'tim')?.id} onAddToOwnCatalog={handleAddToOwnCatalog} />
                  )}
                  {materialsSubTab === 'oninen' && (
                    <OninenIntegrator integrationId={integrations.find(i => i.wholesaler_id === 'oninen')?.id} onAddToOwnCatalog={handleAddToOwnCatalog} />
                  )}
                </div>
              )}

              {activeTab === 'equipment' && (
                <div>
                  {/* Sub-tabs: Własny katalog + wholesaler tabs + Integrację button */}
                  <div className="flex items-center gap-1 mb-4">
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                      <button
                        onClick={() => setEquipmentSubTab('own')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          equipmentSubTab === 'own'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Własny katalog
                      </button>
                      {integrations.filter(i => i.is_active).map(integ => (
                        <button
                          key={integ.id}
                          onClick={() => setEquipmentSubTab(integ.wholesaler_id)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            equipmentSubTab === integ.wholesaler_id
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {integ.wholesaler_name}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowIntegrationModal(true)}
                      className="ml-2 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Store className="w-4 h-4" />
                      Integrację
                    </button>
                  </div>
                  {equipmentSubTab === 'own' && renderEquipmentTab()}
                  {equipmentSubTab === 'tim' && (
                    <TIMIntegrator integrationId={integrations.find(i => i.wholesaler_id === 'tim')?.id} onAddToOwnCatalog={handleAddToOwnCatalog} />
                  )}
                  {equipmentSubTab === 'oninen' && (
                    <OninenIntegrator integrationId={integrations.find(i => i.wholesaler_id === 'oninen')?.id} onAddToOwnCatalog={handleAddToOwnCatalog} />
                  )}
                </div>
              )}

              {activeTab === 'slownik' && (
                <div>
                  {/* Sub-tabs: Własny katalog + wholesaler tabs + Integrację button */}
                  <div className="flex items-center gap-1 mb-4">
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                      <button
                        onClick={() => setSlownikMainSubTab('own')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          slownikMainSubTab === 'own'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Własny katalog
                      </button>
                      {integrations.filter(i => i.is_active).map(integ => (
                        <button
                          key={integ.id}
                          onClick={() => setSlownikMainSubTab(integ.wholesaler_id)}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            slownikMainSubTab === integ.wholesaler_id
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {integ.wholesaler_name}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowIntegrationModal(true)}
                      className="ml-2 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Store className="w-4 h-4" />
                      Integrację
                    </button>
                  </div>
                  {slownikMainSubTab === 'own' && (
                    <>
                      {/* Słownik sub-tabs (Rodzaj prac / Rodzaj ścian) */}
                      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
                        <button
                          onClick={() => setSlownikSubTab('rodzaj_prac')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                            slownikSubTab === 'rodzaj_prac'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <ClipboardList className="w-4 h-4" />
                          Rodzaj prac
                        </button>
                        <button
                          onClick={() => setSlownikSubTab('wall_types')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                            slownikSubTab === 'wall_types'
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Layers className="w-4 h-4" />
                          Rodzaj ścian
                        </button>
                      </div>
                      {slownikSubTab === 'rodzaj_prac' && renderRodzajPracTab()}
                      {slownikSubTab === 'wall_types' && renderWallTypesTab()}
                    </>
                  )}
                  {slownikMainSubTab === 'tim' && (
                    <TIMIntegrator integrationId={integrations.find(i => i.wholesaler_id === 'tim')?.id} onAddToOwnCatalog={handleAddToOwnCatalog} />
                  )}
                  {slownikMainSubTab === 'oninen' && (
                    <OninenIntegrator integrationId={integrations.find(i => i.wholesaler_id === 'oninen')?.id} onAddToOwnCatalog={handleAddToOwnCatalog} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Wholesaler Integration Modal */}
      <WholesalerIntegrationModal
        isOpen={showIntegrationModal}
        onClose={() => setShowIntegrationModal(false)}
        companyId={currentUser?.company_id || ''}
        integrations={integrations}
        onIntegrationChange={loadIntegrations}
      />

      {/* Delete Category Confirmation Modal */}
      {deleteCategoryConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteCategoryConfirm(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Usunąć kategorię?</h3>
            <p className="text-sm text-slate-600 mb-1">
              Czy na pewno chcesz usunąć kategorię <span className="font-semibold">«{deleteCategoryConfirm.name}»</span>?
            </p>
            <p className="text-xs text-slate-500 mb-5">
              {deleteCategoryConfirm.parent_id
                ? `Materiały z tej kategorii zostaną przeniesione do kategorii nadrzędnej «${customCategories.find(c => c.id === deleteCategoryConfirm.parent_id)?.name || '—'}».`
                : 'Materiały z tej kategorii zostaną przeniesione do «Bez kategorii».'
              }
              {' '}Podkategorie zostaną przeniesione na wyższy poziom.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteCategoryConfirm(null)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleDeleteCustomCategory(deleteCategoryConfirm.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Usuń kategorię
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Material Confirmation Modal */}
      {deleteMaterialConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteMaterialConfirm(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Usunąć materiał?</h3>
            <p className="text-sm text-slate-600 mb-5">
              Czy na pewno chcesz usunąć materiał <span className="font-semibold">«{deleteMaterialConfirm.name}»</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteMaterialConfirm(null)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={async () => {
                  await handleDeleteMaterial(deleteMaterialConfirm.id);
                  setDeleteMaterialConfirm(null);
                  setDetailMaterial(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Usuń materiał
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Own Catalog — Price Sync Modal */}
      {addToCatalogModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAddToCatalogModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Dodaj do katalogu Własnego</h3>
            <p className="text-sm text-slate-600 mb-4">
              <span className="font-medium">{addToCatalogModal.product.name}</span>
              <br />
              <span className="text-xs text-slate-400">
                z {addToCatalogModal.wholesaler === 'tim' ? 'TIM' : 'Onninen'}
                {addToCatalogModal.product.price != null && ` · ${addToCatalogModal.product.price?.toFixed(2)} zł`}
              </span>
            </p>

            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="syncMode"
                  checked={priceSyncMode === 'fixed'}
                  onChange={() => setPriceSyncMode('fixed')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">Zapisać cenę</div>
                  <div className="text-xs text-slate-500">Cena w katalogu Własnym pozostanie taka, jaka jest teraz. Nie zmieni się przy aktualizacji cen w hurtowni.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="syncMode"
                  checked={priceSyncMode === 'synced'}
                  onChange={() => setPriceSyncMode('synced')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">Synchronizować z hurtownią</div>
                  <div className="text-xs text-slate-500">Jeśli cena w hurtowni się zmieni — cena w katalogu Własnym również się zaktualizuje automatycznie.</div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAddToCatalogModal(null)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleConfirmAddToOwnCatalog}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Dodaj do katalogu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white flex items-center gap-2`}>
          {notification.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 transition-opacity bg-slate-500 bg-opacity-75" onClick={() => setShowDeleteConfirm(null)} />
            <div className="relative bg-white rounded-lg max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Potwierdź usunięcie</h3>
              <p className="text-slate-600 mb-6">Czy na pewno chcesz usunąć ten element? Ta operacja jest nieodwracalna.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => {
                    if (showDeleteConfirm.type === 'workType') handleDeleteWorkType(showDeleteConfirm.id);
                    else if (showDeleteConfirm.type === 'material') handleDeleteMaterial(showDeleteConfirm.id);
                    else if (showDeleteConfirm.type === 'equipment') handleDeleteEquipment(showDeleteConfirm.id);
                    else if (showDeleteConfirm.type === 'template') handleDeleteTemplate(showDeleteConfirm.id);
                    else if (showDeleteConfirm.type === 'mapping') handleDeleteMapping(showDeleteConfirm.id);
                    else if (showDeleteConfirm.type === 'request_work_type') handleDeleteRequestWorkType(showDeleteConfirm.id);
                    else if (showDeleteConfirm.type === 'wall_type') handleDeleteWallType(showDeleteConfirm.id);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Usuń
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DictionariesPage;
