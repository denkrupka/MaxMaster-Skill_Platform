import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Loader2, Pencil, Trash2, X, Check, RefreshCw,
  Wrench, Package, Monitor, FileText, Link2, ChevronDown, BookOpen,
  Settings, AlertCircle, ChevronRight, ClipboardList, GripVertical,
  Layers, FolderOpen
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
} from '../../types';

// ============ Типы для вкладок ============
type TabType = 'work_types' | 'materials' | 'equipment' | 'slownik';

const TABS: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'work_types', label: 'Robocizna', icon: Wrench },
  { id: 'materials', label: 'Materiały', icon: Package },
  { id: 'equipment', label: 'Sprzęt', icon: Monitor },
  { id: 'slownik', label: 'Słownik', icon: BookOpen },
];

// ============ Единицы измерения ============
const UNITS = [
  { value: 'szt', label: 'szt. (штуки)' },
  { value: 'm', label: 'm (метры)' },
  { value: 'm2', label: 'm² (кв.м)' },
  { value: 'm3', label: 'm³ (куб.м)' },
  { value: 'kg', label: 'kg (кг)' },
  { value: 'kpl', label: 'kpl. (комплект)' },
  { value: 'godz', label: 'godz. (часы)' },
  { value: 'mb', label: 'mb (п.м)' },
  { value: 'op', label: 'op. (упаковка)' },
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

// ============ Категории материалов ============
const MATERIAL_CATEGORIES = [
  { value: 'kable', label: 'Кабели' },
  { value: 'osprzet', label: 'Электрофурнитура' },
  { value: 'rozdzielnice', label: 'Щиты' },
  { value: 'systemy', label: 'Крепления' },
  { value: 'ochrona', label: 'Защита' },
  { value: 'oswietlenie', label: 'Освещение' },
  { value: 'teletechnika', label: 'Слаботочка' },
  { value: 'inne', label: 'Прочее' },
];

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
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
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

    try {
      if (editingMaterial.id) {
        const { error } = await supabase
          .from('kosztorys_materials')
          .update({
            code: editingMaterial.code,
            name: editingMaterial.name,
            category: editingMaterial.category,
            unit: editingMaterial.unit,
            description: editingMaterial.description,
            manufacturer: editingMaterial.manufacturer,
            default_price: editingMaterial.default_price,
            is_active: editingMaterial.is_active,
          })
          .eq('id', editingMaterial.id);

        if (error) throw error;
        showNotification('Materiał zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_materials')
          .insert({
            code: editingMaterial.code,
            name: editingMaterial.name,
            category: editingMaterial.category,
            unit: editingMaterial.unit,
            description: editingMaterial.description,
            manufacturer: editingMaterial.manufacturer,
            default_price: editingMaterial.default_price || 0,
            is_active: editingMaterial.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Materiał dodany', 'success');
      }

      setMaterialDialog(false);
      setEditingMaterial(null);
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

  const filteredMaterials = useMemo(() =>
    materials.filter(m =>
      m.code?.toLowerCase().includes(materialSearch.toLowerCase()) ||
      m.name?.toLowerCase().includes(materialSearch.toLowerCase())
    ), [materials, materialSearch]);

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
                {UNITS.map(u => (
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
  const renderMaterialsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={materialSearch}
            onChange={(e) => setMaterialSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingMaterial({ is_active: true, default_price: 0 });
            setMaterialDialog(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj materiał
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
            {filteredMaterials.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{m.code}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{m.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                    {MATERIAL_CATEGORIES.find(c => c.value === m.category)?.label || m.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{m.manufacturer || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{m.unit}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">
                  {m.default_price?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {m.is_active ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditingMaterial(m);
                      setMaterialDialog(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm({ type: 'material', id: m.id })}
                    className="p-1 text-slate-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredMaterials.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Brak materiałów
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Material Dialog */}
      <Modal
        isOpen={materialDialog}
        onClose={() => setMaterialDialog(false)}
        title={editingMaterial?.id ? 'Edytuj materiał' : 'Dodaj materiał'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
              <input
                type="text"
                value={editingMaterial?.code || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria</label>
              <select
                value={editingMaterial?.category || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {MATERIAL_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingMaterial?.name || ''}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Producent</label>
              <input
                type="text"
                value={editingMaterial?.manufacturer || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka</label>
              <select
                value={editingMaterial?.unit || ''}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, unit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz...</option>
                {UNITS.map(u => (
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
              value={editingMaterial?.default_price || ''}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, default_price: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingMaterial?.description || ''}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="mat-active"
              checked={editingMaterial?.is_active ?? true}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300"
            />
            <label htmlFor="mat-active" className="ml-2 text-sm text-slate-700">Aktywny</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setMaterialDialog(false)}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveMaterial}
            disabled={saving || !editingMaterial?.code || !editingMaterial?.name}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>
    </div>
  );

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
                {UNITS.map(u => (
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
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie kartoteką</h1>
          <p className="text-sm text-slate-500 mt-1">
            Zarządzanie robocizną, materiałami i sprzętem
          </p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
            <stat.icon className={`w-8 h-8 ${stat.color}`} />
            <div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

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
              {activeTab === 'materials' && renderMaterialsTab()}
              {activeTab === 'equipment' && renderEquipmentTab()}
              {activeTab === 'slownik' && (
                <div>
                  {/* Słownik sub-tabs */}
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
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
