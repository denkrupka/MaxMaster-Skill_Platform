import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Loader2, Pencil, Trash2, X, Check, RefreshCw,
  Calendar, DollarSign, FileSpreadsheet, Upload, Download, AlertCircle,
  ChevronDown, ChevronRight, CheckCircle2, Eye
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type {
  KosztorysPriceList,
  KosztorysPriceListItem,
  KosztorysMaterial,
  KosztorysEquipment,
} from '../../types';

// Modal component
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
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};

export const PriceListsPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Price lists
  const [priceLists, setPriceLists] = useState<KosztorysPriceList[]>([]);
  const [priceListDialog, setPriceListDialog] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<Partial<KosztorysPriceList> | null>(null);
  const [search, setSearch] = useState('');

  // Price list items
  const [selectedPriceList, setSelectedPriceList] = useState<KosztorysPriceList | null>(null);
  const [priceListItems, setPriceListItems] = useState<KosztorysPriceListItem[]>([]);
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<KosztorysPriceListItem> | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'material' | 'equipment' | 'labor'>('all');

  // Reference data
  const [materials, setMaterials] = useState<KosztorysMaterial[]>([]);
  const [equipment, setEquipment] = useState<KosztorysEquipment[]>([]);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string } | null>(null);

  // Expanded price lists
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPriceLists(),
        loadMaterials(),
        loadEquipment(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Błąd podczas ładowania danych', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPriceLists = async () => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_price_lists')
        .select('*')
        .order('valid_from', { ascending: false });

      if (error) throw error;
      setPriceLists(data || []);
    } catch (err) {
      console.error('Error loading price lists:', err);
      setPriceLists([]);
    }
  };

  const loadPriceListItems = async (priceListId: string) => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_price_list_items')
        .select(`
          *,
          material:kosztorys_materials(*),
          equipment:kosztorys_equipment(*)
        `)
        .eq('price_list_id', priceListId)
        .order('item_type', { ascending: true })
        .order('item_code', { ascending: true });

      if (error) throw error;
      setPriceListItems(data || []);
    } catch (err) {
      console.error('Error loading price list items:', err);
      setPriceListItems([]);
    }
  };

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('kosztorys_materials')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

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
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      setEquipment(data || []);
    } catch (err) {
      console.error('Error loading equipment:', err);
      setEquipment([]);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // CRUD for price lists
  const handleSavePriceList = async () => {
    if (!editingPriceList || !currentUser) return;
    setSaving(true);

    try {
      if (editingPriceList.id) {
        const { error } = await supabase
          .from('kosztorys_price_lists')
          .update({
            name: editingPriceList.name,
            description: editingPriceList.description,
            valid_from: editingPriceList.valid_from,
            valid_to: editingPriceList.valid_to,
            is_active: editingPriceList.is_active,
          })
          .eq('id', editingPriceList.id);

        if (error) throw error;
        showNotification('Cennik zaktualizowany', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_price_lists')
          .insert({
            name: editingPriceList.name,
            description: editingPriceList.description,
            valid_from: editingPriceList.valid_from,
            valid_to: editingPriceList.valid_to,
            is_active: editingPriceList.is_active ?? true,
            company_id: currentUser.company_id,
          });

        if (error) throw error;
        showNotification('Cennik dodany', 'success');
      }

      setPriceListDialog(false);
      setEditingPriceList(null);
      await loadPriceLists();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePriceList = async (id: string) => {
    try {
      // First delete all items
      await supabase.from('kosztorys_price_list_items').delete().eq('price_list_id', id);

      const { error } = await supabase
        .from('kosztorys_price_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Cennik usunięty', 'success');
      await loadPriceLists();
      if (selectedPriceList?.id === id) {
        setSelectedPriceList(null);
        setPriceListItems([]);
      }
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
    setShowDeleteConfirm(null);
  };

  const handleDuplicatePriceList = async (priceList: KosztorysPriceList) => {
    if (!currentUser) return;
    setSaving(true);

    try {
      // Create new price list
      const { data: newPriceList, error: createError } = await supabase
        .from('kosztorys_price_lists')
        .insert({
          name: `${priceList.name} (kopia)`,
          description: priceList.description,
          valid_from: new Date().toISOString().split('T')[0],
          valid_to: null,
          is_active: false,
          company_id: currentUser.company_id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copy items
      const { data: items } = await supabase
        .from('kosztorys_price_list_items')
        .select('*')
        .eq('price_list_id', priceList.id);

      if (items && items.length > 0) {
        const newItems = items.map(item => ({
          price_list_id: newPriceList.id,
          item_type: item.item_type,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          price: item.price,
          material_id: item.material_id,
          equipment_id: item.equipment_id,
        }));

        await supabase.from('kosztorys_price_list_items').insert(newItems);
      }

      showNotification('Cennik skopiowany', 'success');
      await loadPriceLists();
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas kopiowania', 'error');
    } finally {
      setSaving(false);
    }
  };

  // CRUD for price list items
  const handleSaveItem = async () => {
    if (!editingItem || !selectedPriceList) return;
    setSaving(true);

    try {
      if (editingItem.id) {
        const { error } = await supabase
          .from('kosztorys_price_list_items')
          .update({
            item_type: editingItem.item_type,
            item_code: editingItem.item_code,
            item_name: editingItem.item_name,
            unit: editingItem.unit,
            price: editingItem.price,
            material_id: editingItem.material_id,
            equipment_id: editingItem.equipment_id,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        showNotification('Pozycja zaktualizowana', 'success');
      } else {
        const { error } = await supabase
          .from('kosztorys_price_list_items')
          .insert({
            price_list_id: selectedPriceList.id,
            item_type: editingItem.item_type,
            item_code: editingItem.item_code,
            item_name: editingItem.item_name,
            unit: editingItem.unit,
            price: editingItem.price || 0,
            material_id: editingItem.material_id,
            equipment_id: editingItem.equipment_id,
          });

        if (error) throw error;
        showNotification('Pozycja dodana', 'success');
      }

      setItemDialog(false);
      setEditingItem(null);
      await loadPriceListItems(selectedPriceList.id);
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!selectedPriceList) return;

    try {
      const { error } = await supabase
        .from('kosztorys_price_list_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Pozycja usunięta', 'success');
      await loadPriceListItems(selectedPriceList.id);
    } catch (error: any) {
      showNotification(error.message || 'Błąd podczas usuwania', 'error');
    }
    setShowDeleteConfirm(null);
  };

  const handleSelectPriceList = async (priceList: KosztorysPriceList) => {
    setSelectedPriceList(priceList);
    await loadPriceListItems(priceList.id);
  };

  const handleItemTypeChange = (itemType: 'material' | 'equipment' | 'labor') => {
    setEditingItem({ ...editingItem, item_type: itemType, material_id: undefined, equipment_id: undefined });
  };

  const handleMaterialSelect = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      setEditingItem({
        ...editingItem,
        material_id: materialId,
        item_code: material.code,
        item_name: material.name,
        unit: material.unit,
        price: material.default_price,
      });
    }
  };

  const handleEquipmentSelect = (equipmentId: string) => {
    const eq = equipment.find(e => e.id === equipmentId);
    if (eq) {
      setEditingItem({
        ...editingItem,
        equipment_id: equipmentId,
        item_code: eq.code,
        item_name: eq.name,
        unit: eq.unit,
        price: eq.default_price,
      });
    }
  };

  // Filtering
  const filteredPriceLists = useMemo(() =>
    priceLists.filter(pl =>
      pl.name?.toLowerCase().includes(search.toLowerCase()) ||
      pl.description?.toLowerCase().includes(search.toLowerCase())
    ), [priceLists, search]);

  const filteredItems = useMemo(() =>
    priceListItems.filter(item => {
      const matchesSearch =
        item.item_code?.toLowerCase().includes(itemSearch.toLowerCase()) ||
        item.item_name?.toLowerCase().includes(itemSearch.toLowerCase());
      const matchesType = itemTypeFilter === 'all' || item.item_type === itemTypeFilter;
      return matchesSearch && matchesType;
    }), [priceListItems, itemSearch, itemTypeFilter]);

  // Check if price list is active (current date)
  const isPriceListActive = (pl: KosztorysPriceList): boolean => {
    if (!pl.is_active) return false;
    const today = new Date().toISOString().split('T')[0];
    if (pl.valid_from && pl.valid_from > today) return false;
    if (pl.valid_to && pl.valid_to < today) return false;
    return true;
  };

  // Statistics
  const stats = useMemo(() => {
    const activeLists = priceLists.filter(isPriceListActive).length;
    const totalItems = priceListItems.length;
    const materialItems = priceListItems.filter(i => i.item_type === 'material').length;
    const equipmentItems = priceListItems.filter(i => i.item_type === 'equipment').length;
    const laborItems = priceListItems.filter(i => i.item_type === 'labor').length;
    return { activeLists, totalItems, materialItems, equipmentItems, laborItems };
  }, [priceLists, priceListItems]);

  const ITEM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    material: { label: 'Materiał', color: 'bg-green-100 text-green-700' },
    equipment: { label: 'Sprzęt', color: 'bg-purple-100 text-purple-700' },
    labor: { label: 'Robocizna', color: 'bg-blue-100 text-blue-700' },
  };

  const UNITS = [
    { value: 'szt', label: 'szt.' },
    { value: 'm', label: 'm' },
    { value: 'm2', label: 'm²' },
    { value: 'm3', label: 'm³' },
    { value: 'kg', label: 'kg' },
    { value: 'kpl', label: 'kpl.' },
    { value: 'godz', label: 'godz.' },
    { value: 'mb', label: 'mb' },
    { value: 'op', label: 'op.' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cenniki</h1>
          <p className="text-sm text-slate-500 mt-1">
            Zarządzanie cenami materiałów, sprzętu i robocizny
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{priceLists.length}</div>
            <div className="text-xs text-slate-500">Cenników ({stats.activeLists} aktywnych)</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-green-600" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.materialItems}</div>
            <div className="text-xs text-slate-500">Materiałów</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-purple-600" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.equipmentItems}</div>
            <div className="text-xs text-slate-500">Sprzętu</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-orange-600" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.laborItems}</div>
            <div className="text-xs text-slate-500">Robocizny</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Price Lists Panel */}
        <div className="col-span-1 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-slate-900">Cenniki</h2>
              <button
                onClick={() => {
                  setEditingPriceList({ is_active: true, valid_from: new Date().toISOString().split('T')[0] });
                  setPriceListDialog(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Nowy
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Szukaj..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : filteredPriceLists.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                Brak cenników
              </div>
            ) : (
              filteredPriceLists.map(pl => (
                <div
                  key={pl.id}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                    selectedPriceList?.id === pl.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleSelectPriceList(pl)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{pl.name}</span>
                        {isPriceListActive(pl) && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {pl.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{pl.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {pl.valid_from ? new Date(pl.valid_from).toLocaleDateString('pl-PL') : '-'}
                          {pl.valid_to ? ` - ${new Date(pl.valid_to).toLocaleDateString('pl-PL')}` : ' - bezterminowo'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPriceList(pl);
                          setPriceListDialog(true);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicatePriceList(pl);
                        }}
                        className="p-1 text-slate-400 hover:text-purple-600"
                        title="Kopiuj cennik"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm({ type: 'priceList', id: pl.id });
                        }}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Price List Items Panel */}
        <div className="col-span-2 bg-white rounded-lg shadow">
          {selectedPriceList ? (
            <>
              <div className="p-4 border-b border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">{selectedPriceList.name}</h2>
                    <p className="text-xs text-slate-500">{filteredItems.length} pozycji</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingItem({ item_type: 'material', price: 0 });
                      setItemDialog(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj pozycję
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Szukaj pozycji..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={itemTypeFilter}
                    onChange={(e) => setItemTypeFilter(e.target.value as any)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="all">Wszystkie typy</option>
                    <option value="material">Materiały</option>
                    <option value="equipment">Sprzęt</option>
                    <option value="labor">Robocizna</option>
                  </select>
                </div>
              </div>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Typ</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Kod</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nazwa</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jednostka</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cena</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${ITEM_TYPE_LABELS[item.item_type]?.color || 'bg-slate-100 text-slate-700'}`}>
                            {ITEM_TYPE_LABELS[item.item_type]?.label || item.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.item_code}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.item_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.unit}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right font-medium">
                          {item.price?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setItemDialog(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm({ type: 'item', id: item.id })}
                            className="p-1 text-slate-400 hover:text-red-600 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Brak pozycji w cenniku
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-slate-500">
              <FileSpreadsheet className="w-12 h-12 mb-4 text-slate-300" />
              <p>Wybierz cennik z listy po lewej stronie</p>
            </div>
          )}
        </div>
      </div>

      {/* Price List Dialog */}
      <Modal
        isOpen={priceListDialog}
        onClose={() => setPriceListDialog(false)}
        title={editingPriceList?.id ? 'Edytuj cennik' : 'Nowy cennik'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingPriceList?.name || ''}
              onChange={(e) => setEditingPriceList({ ...editingPriceList, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="np. Cennik 2024 Q1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
            <textarea
              value={editingPriceList?.description || ''}
              onChange={(e) => setEditingPriceList({ ...editingPriceList, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ważny od *</label>
              <input
                type="date"
                value={editingPriceList?.valid_from || ''}
                onChange={(e) => setEditingPriceList({ ...editingPriceList, valid_from: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ważny do</label>
              <input
                type="date"
                value={editingPriceList?.valid_to || ''}
                onChange={(e) => setEditingPriceList({ ...editingPriceList, valid_to: e.target.value || null })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">Pozostaw puste dla cennika bezterminowego</p>
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="pl-active"
              checked={editingPriceList?.is_active ?? true}
              onChange={(e) => setEditingPriceList({ ...editingPriceList, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300"
            />
            <label htmlFor="pl-active" className="ml-2 text-sm text-slate-700">Aktywny</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setPriceListDialog(false)}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSavePriceList}
            disabled={saving || !editingPriceList?.name || !editingPriceList?.valid_from}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>

      {/* Item Dialog */}
      <Modal
        isOpen={itemDialog}
        onClose={() => setItemDialog(false)}
        title={editingItem?.id ? 'Edytuj pozycję' : 'Dodaj pozycję'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Typ pozycji *</label>
            <div className="flex gap-2">
              {(['material', 'equipment', 'labor'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleItemTypeChange(type)}
                  className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    editingItem?.item_type === type
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {ITEM_TYPE_LABELS[type].label}
                </button>
              ))}
            </div>
          </div>

          {editingItem?.item_type === 'material' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wybierz materiał</label>
              <select
                value={editingItem?.material_id || ''}
                onChange={(e) => handleMaterialSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz z listy lub wprowadź ręcznie...</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                ))}
              </select>
            </div>
          )}

          {editingItem?.item_type === 'equipment' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wybierz sprzęt</label>
              <select
                value={editingItem?.equipment_id || ''}
                onChange={(e) => handleEquipmentSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wybierz z listy lub wprowadź ręcznie...</option>
                {equipment.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.code} - {eq.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
              <input
                type="text"
                value={editingItem?.item_code || ''}
                onChange={(e) => setEditingItem({ ...editingItem, item_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka *</label>
              <select
                value={editingItem?.unit || ''}
                onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
            <input
              type="text"
              value={editingItem?.item_name || ''}
              onChange={(e) => setEditingItem({ ...editingItem, item_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cena (PLN) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editingItem?.price || ''}
              onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={() => setItemDialog(false)}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            onClick={handleSaveItem}
            disabled={saving || !editingItem?.item_code || !editingItem?.item_name || !editingItem?.unit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Zapisz
          </button>
        </div>
      </Modal>

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
              <p className="text-slate-600 mb-6">
                {showDeleteConfirm.type === 'priceList'
                  ? 'Czy na pewno chcesz usunąć ten cennik? Wszystkie pozycje zostaną również usunięte.'
                  : 'Czy na pewno chcesz usunąć tę pozycję?'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => {
                    if (showDeleteConfirm.type === 'priceList') {
                      handleDeletePriceList(showDeleteConfirm.id);
                    } else {
                      handleDeleteItem(showDeleteConfirm.id);
                    }
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

export default PriceListsPage;
