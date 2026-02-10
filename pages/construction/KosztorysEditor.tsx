/**
 * KosztorysEditor - Full-featured cost estimate editor
 * Based on eKosztorysowanie.pl interface and functionality
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Menu, Printer, Plus, FolderPlus, FileText, Hash, Layers,
  ChevronDown, ChevronRight, Trash2, Copy, ClipboardPaste,
  Scissors, MoveUp, MoveDown, Settings, Eye, CheckCircle2,
  AlertCircle, Save, Download, Upload, RefreshCw, X,
  Calculator, Users, Package, Wrench, Percent, DollarSign,
  MessageSquare, Search, Filter, MoreHorizontal, Loader2,
  ArrowLeft, FileSpreadsheet, Clock
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  calculateCostEstimate,
  calculatePosition,
  formatNumber,
  formatCurrency,
  createNewSection,
  createNewPosition,
  createNewResource,
  createEmptyMeasurements,
  addMeasurementEntry,
  updateMeasurementEntry,
  removeMeasurementEntry,
  createDefaultFactors,
  createDefaultIndirectCostsOverhead,
  createDefaultProfitOverhead,
  createDefaultPurchaseCostsOverhead,
  evaluateMeasurementExpression,
} from '../../lib/kosztorysCalculator';
import type {
  KosztorysCostEstimate,
  KosztorysCostEstimateData,
  KosztorysSection,
  KosztorysPosition,
  KosztorysResource,
  KosztorysOverhead,
  KosztorysFactors,
  KosztorysMeasurements,
  KosztorysUnit,
  KosztorysEditorState,
  KosztorysPositionCalculationResult,
  KosztorysCostEstimateCalculationResult,
  KosztorysResourceType,
  KosztorysType,
} from '../../types';

// Resource type configuration
const RESOURCE_TYPE_CONFIG: Record<KosztorysResourceType, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  icon: React.FC<{ className?: string }>;
}> = {
  labor: { label: 'Robocizna', shortLabel: 'R', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Users },
  material: { label: 'Materiał', shortLabel: 'M', color: 'text-green-700', bgColor: 'bg-green-100', icon: Package },
  equipment: { label: 'Sprzęt', shortLabel: 'S', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: Wrench },
};

// Units reference
const UNITS_REFERENCE = [
  { index: '020', unit: 'szt.', name: 'sztuka' },
  { index: '023', unit: 'tys.szt.', name: 'tysiąc sztuk' },
  { index: '033', unit: 'kg', name: 'kilogram' },
  { index: '034', unit: 't', name: 'tona' },
  { index: '040', unit: 'm', name: 'metr' },
  { index: '050', unit: 'm2', name: 'metr kwadratowy' },
  { index: '060', unit: 'm3', name: 'metr sześcienny' },
  { index: '070', unit: 'kW', name: 'kilowat' },
  { index: '090', unit: 'kpl', name: 'komplet' },
  { index: '149', unit: 'r-g', name: 'roboczogodzina' },
  { index: '150', unit: 'm-g', name: 'maszynogodzina' },
];

// Estimate type labels
const ESTIMATE_TYPE_LABELS: Record<KosztorysType, string> = {
  investor: 'Kosztorys inwestorski',
  contractor: 'Kosztorys wykonawczy',
  offer: 'Kosztorys ofertowy',
};

// Initial editor state
const initialEditorState: KosztorysEditorState = {
  selectedItemId: null,
  selectedItemType: null,
  expandedSections: new Set(),
  expandedPositions: new Set(),
  clipboard: null,
  isDirty: false,
  lastSaved: null,
};

// Empty estimate data
const createEmptyEstimateData = (): KosztorysCostEstimateData => ({
  root: {
    sectionIds: [],
    positionIds: [],
    factors: createDefaultFactors(),
    overheads: [
      createDefaultIndirectCostsOverhead(65),
      createDefaultProfitOverhead(10),
      createDefaultPurchaseCostsOverhead(5),
    ],
  },
  sections: {},
  positions: {},
});

// =====================================================
// INLINE EDITABLE CELL
// =====================================================
interface EditableCellProps {
  value: string | number;
  type?: 'text' | 'number';
  onSave: (value: string | number) => void;
  className?: string;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value, type = 'text', onSave, className = '', suffix = '', placeholder = '', disabled = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleSave = () => {
    if (disabled) return;
    const newValue = type === 'number' ? (parseFloat(editValue.replace(',', '.')) || 0) : editValue;
    onSave(newValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(String(value));
      setIsEditing(false);
    }
  };

  if (disabled) {
    return (
      <span className={`px-1 py-0.5 ${className}`}>
        {type === 'number' ? formatNumber(Number(value)) : value}
        {suffix}
      </span>
    );
  }

  if (isEditing) {
    return (
      <input
        type={type === 'number' ? 'text' : type}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder={placeholder}
        className={`w-full px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => { setEditValue(String(value)); setIsEditing(true); }}
      className={`cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${className}`}
    >
      {type === 'number' ? formatNumber(Number(value)) : (value || placeholder)}
      {suffix}
    </span>
  );
};

// =====================================================
// PROPERTIES PANEL
// =====================================================
interface PropertiesPanelProps {
  selectedItem: KosztorysSection | KosztorysPosition | KosztorysResource | null;
  selectedType: 'section' | 'position' | 'resource' | null;
  calculationResult: KosztorysPositionCalculationResult | null;
  onUpdate: (updates: Partial<any>) => void;
  onClose: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedItem, selectedType, calculationResult, onUpdate, onClose
}) => {
  if (!selectedItem || !selectedType) {
    return (
      <div className="w-80 bg-white border-l border-slate-200 p-4">
        <p className="text-slate-500 text-sm text-center mt-8">
          Wybierz element na kosztorysie, aby wyświetlić jego właściwości
        </p>
      </div>
    );
  }

  const renderSectionProperties = (section: KosztorysSection) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Nazwa działu</label>
        <input
          type="text"
          value={section.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Opis</label>
        <textarea
          value={section.description}
          onChange={e => onUpdate({ description: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          rows={3}
        />
      </div>
      <div className="pt-4 border-t border-slate-200">
        <h4 className="text-sm font-medium text-slate-700 mb-2">Współczynniki działu</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500">R (robocizna)</label>
            <input
              type="number"
              step="0.01"
              value={section.factors.labor}
              onChange={e => onUpdate({ factors: { ...section.factors, labor: parseFloat(e.target.value) || 1 } })}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">M (materiały)</label>
            <input
              type="number"
              step="0.01"
              value={section.factors.material}
              onChange={e => onUpdate({ factors: { ...section.factors, material: parseFloat(e.target.value) || 1 } })}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">S (sprzęt)</label>
            <input
              type="number"
              step="0.01"
              value={section.factors.equipment}
              onChange={e => onUpdate({ factors: { ...section.factors, equipment: parseFloat(e.target.value) || 1 } })}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Odpady %</label>
            <input
              type="number"
              step="0.1"
              value={section.factors.waste}
              onChange={e => onUpdate({ factors: { ...section.factors, waste: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderPositionProperties = (position: KosztorysPosition) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Podstawa (norma)</label>
        <input
          type="text"
          value={position.base}
          onChange={e => onUpdate({ base: e.target.value, originBase: e.target.value })}
          placeholder="np. KNNR 5 0702-01"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Nazwa nakładu</label>
        <textarea
          value={position.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Jednostka</label>
          <select
            value={position.unit.unitIndex}
            onChange={e => {
              const unit = UNITS_REFERENCE.find(u => u.index === e.target.value);
              if (unit) onUpdate({ unit: { label: unit.unit, unitIndex: unit.index } });
            }}
            className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
          >
            {UNITS_REFERENCE.map(u => (
              <option key={u.index} value={u.index}>{u.unit} - {u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Mnożnik</label>
          <input
            type="number"
            step="0.01"
            value={position.multiplicationFactor}
            onChange={e => onUpdate({ multiplicationFactor: parseFloat(e.target.value) || 1 })}
            className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {calculationResult && (
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Podsumowanie pozycji</h4>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Ilość:</span>
              <span className="font-medium">{formatNumber(calculationResult.quantity)} {position.unit.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Robocizna:</span>
              <span className="font-medium">{formatCurrency(calculationResult.laborTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Materiały:</span>
              <span className="font-medium">{formatCurrency(calculationResult.materialTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sprzęt:</span>
              <span className="font-medium">{formatCurrency(calculationResult.equipmentTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-600 font-medium">Koszty bezpośrednie:</span>
              <span className="font-bold">{formatCurrency(calculationResult.directCostsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-medium">Razem z narzutami:</span>
              <span className="font-bold text-blue-600">{formatCurrency(calculationResult.totalWithOverheads)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-medium">Cena jednostkowa:</span>
              <span className="font-bold">{formatCurrency(calculationResult.unitCost)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderResourceProperties = (resource: KosztorysResource) => {
    const config = RESOURCE_TYPE_CONFIG[resource.type];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${config.bgColor} ${config.color}`}>
            {config.shortLabel}
          </span>
          <span className="text-sm font-medium text-slate-700">{config.label}</span>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Nazwa</label>
          <input
            type="text"
            value={resource.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Indeks</label>
          <input
            type="text"
            value={resource.originIndex.index}
            onChange={e => onUpdate({ originIndex: { ...resource.originIndex, index: e.target.value } })}
            placeholder="np. 999"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Norma</label>
            <input
              type="number"
              step="0.0001"
              value={resource.norm.value}
              onChange={e => onUpdate({ norm: { ...resource.norm, value: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Jednostka</label>
            <select
              value={resource.unit.unitIndex}
              onChange={e => {
                const unit = UNITS_REFERENCE.find(u => u.index === e.target.value);
                if (unit) onUpdate({ unit: { label: unit.unit, unitIndex: unit.index } });
              }}
              className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {UNITS_REFERENCE.map(u => (
                <option key={u.index} value={u.index}>{u.unit}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Cena jednostkowa</label>
            <input
              type="number"
              step="0.01"
              value={resource.unitPrice.value}
              onChange={e => onUpdate({ unitPrice: { ...resource.unitPrice, value: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Współczynnik</label>
            <input
              type="number"
              step="0.01"
              value={resource.factor}
              onChange={e => onUpdate({ factor: parseFloat(e.target.value) || 1 })}
              className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Właściwości</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selectedType === 'section' && renderSectionProperties(selectedItem as KosztorysSection)}
        {selectedType === 'position' && renderPositionProperties(selectedItem as KosztorysPosition)}
        {selectedType === 'resource' && renderResourceProperties(selectedItem as KosztorysResource)}
      </div>
    </div>
  );
};

// =====================================================
// MAIN EDITOR COMPONENT
// =====================================================
export const KosztorysEditorPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser } = state;
  const { estimateId } = useParams<{ estimateId?: string }>();
  const navigate = useNavigate();

  // Loading and saving state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estimate data
  const [estimate, setEstimate] = useState<KosztorysCostEstimate | null>(null);
  const [estimateData, setEstimateData] = useState<KosztorysCostEstimateData>(createEmptyEstimateData());

  // Editor state
  const [editorState, setEditorState] = useState<KosztorysEditorState>(initialEditorState);

  // UI state
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true);
  const [showOverheadsModal, setShowOverheadsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [targetPositionId, setTargetPositionId] = useState<string | null>(null);

  // Form state for new items
  const [newPositionForm, setNewPositionForm] = useState({
    base: '',
    name: '',
    unitIndex: '020',
    measurement: '',
  });

  const [newResourceForm, setNewResourceForm] = useState({
    type: 'labor' as KosztorysResourceType,
    name: '',
    index: '',
    normValue: 1,
    unitPrice: 0,
    unitIndex: '149',
  });

  // Calculation results
  const calculationResult = useMemo(() => {
    if (!estimate) return null;
    return calculateCostEstimate({
      ...estimate,
      data: estimateData,
    });
  }, [estimate, estimateData]);

  // Selected item
  const selectedItem = useMemo(() => {
    if (!editorState.selectedItemId || !editorState.selectedItemType) return null;

    switch (editorState.selectedItemType) {
      case 'section':
        return estimateData.sections[editorState.selectedItemId] || null;
      case 'position':
        return estimateData.positions[editorState.selectedItemId] || null;
      case 'resource': {
        for (const position of Object.values(estimateData.positions)) {
          const resource = position.resources.find(r => r.id === editorState.selectedItemId);
          if (resource) return resource;
        }
        return null;
      }
      default:
        return null;
    }
  }, [editorState.selectedItemId, editorState.selectedItemType, estimateData]);

  // Position calculation result for selected position
  const selectedPositionResult = useMemo(() => {
    if (editorState.selectedItemType !== 'position' || !editorState.selectedItemId || !calculationResult) {
      return null;
    }
    return calculationResult.positions[editorState.selectedItemId] || null;
  }, [editorState.selectedItemType, editorState.selectedItemId, calculationResult]);

  // Load estimate
  useEffect(() => {
    if (currentUser) {
      if (estimateId) {
        loadEstimate(estimateId);
      } else {
        createNewEstimate();
      }
    }
  }, [currentUser, estimateId]);

  const loadEstimate = async (id: string) => {
    setLoading(true);
    try {
      // Load from existing kosztorys_estimates table
      const { data, error } = await supabase
        .from('kosztorys_estimates')
        .select(`
          *,
          request:kosztorys_requests(id, investment_name, client_name, address),
          items:kosztorys_estimate_items(*),
          equipment_items:kosztorys_estimate_equipment(*, equipment:kosztorys_equipment(*))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        const now = new Date().toISOString();

        // Convert existing estimate to new format
        const convertedEstimate: KosztorysCostEstimate = {
          id: data.id,
          company_id: data.company_id,
          created_by_id: data.created_by_id,
          settings: {
            type: 'contractor',
            name: data.request?.investment_name || `Kosztorys ${data.estimate_number}`,
            description: data.request?.client_name || '',
            created: data.created_at,
            modified: data.updated_at || now,
            defaultCurrency: 'PLN',
            calculationTemplate: 'overhead-on-top',
            print: {
              pages: [],
              titlePage: {
                companyInfo: { name: '', address: '', contacts: [] },
                documentTitle: `Kosztorys ${data.estimate_number}`,
                showCostFields: true,
                showManHourRate: true,
                showOverheadsCosts: true,
                orderDetails: {
                  orderName: data.request?.investment_name || '',
                  constructionSiteAddress: data.request?.address || ''
                },
                clientDetails: {
                  clientName: data.request?.client_name || '',
                  clientAddress: ''
                },
                contractorDetails: { contractorName: '', contractorAddress: '', industry: '' },
                participants: {
                  preparedBy: '', preparedAt: '', preparedByIndustry: '',
                  checkedBy: '', checkedAt: '', checkedByIndustry: '',
                },
              },
            },
            precision: {
              norms: 6, resources: 2, measurements: 2, unitValues: 2,
              positionBase: 2, costEstimateBase: 2, roundingMethod: 'default',
            },
          },
          data: createEmptyEstimateData(),
          totalLabor: data.total_works || 0,
          totalMaterial: data.total_materials || 0,
          totalEquipment: data.total_equipment || 0,
          totalOverhead: 0,
          totalValue: data.total_gross || 0,
          created_at: data.created_at,
          updated_at: data.updated_at || now,
        };

        // Convert existing items to positions
        const positions: Record<string, KosztorysPosition> = {};
        const positionIds: string[] = [];

        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            const posId = item.id;
            positionIds.push(posId);

            // Create measurement from quantity
            let measurements = createEmptyMeasurements();
            if (item.quantity > 0) {
              measurements = addMeasurementEntry(measurements, String(item.quantity), 'Ilość');
            }

            // Create resources from item data
            const resources: KosztorysResource[] = [];

            // Add labor resource if there's work cost
            if (item.unit_price_work > 0) {
              resources.push({
                id: `${posId}-labor`,
                name: 'Robocizna',
                index: null,
                originIndex: { type: 'custom', index: '' },
                type: 'labor',
                factor: 1,
                norm: { type: 'absolute', value: 1 },
                unit: { label: 'r-g', unitIndex: '149' },
                unitPrice: { value: item.unit_price_work, currency: 'PLN' },
                group: null,
                marker: null,
                investorTotal: false,
              });
            }

            // Add material resource if there's material cost
            if (item.unit_price_material > 0) {
              resources.push({
                id: `${posId}-material`,
                name: item.material_name || 'Materiał',
                index: null,
                originIndex: { type: 'custom', index: '' },
                type: 'material',
                factor: 1,
                norm: { type: 'absolute', value: 1 },
                unit: { label: 'szt.', unitIndex: '020' },
                unitPrice: { value: item.unit_price_material, currency: 'PLN' },
                group: null,
                marker: null,
                investorTotal: false,
              });
            }

            positions[posId] = {
              id: posId,
              base: '',
              originBase: '',
              name: item.task_description || 'Pozycja',
              marker: item.room_group || null,
              unit: { label: 'szt.', unitIndex: '020' },
              measurements,
              multiplicationFactor: 1,
              resources,
              factors: createDefaultFactors(),
              overheads: [],
              unitPrice: { value: 0, currency: 'PLN' },
            };
          }
        }

        // Update estimate data with converted positions
        convertedEstimate.data = {
          root: {
            sectionIds: [],
            positionIds,
            factors: createDefaultFactors(),
            overheads: [
              createDefaultIndirectCostsOverhead(65),
              createDefaultProfitOverhead(10),
              createDefaultPurchaseCostsOverhead(5),
            ],
          },
          sections: {},
          positions,
        };

        setEstimate(convertedEstimate);
        setEstimateData(convertedEstimate.data);

        // Expand all positions by default
        setEditorState(prev => ({
          ...prev,
          expandedPositions: new Set(positionIds),
        }));
      }
    } catch (error) {
      console.error('Error loading estimate:', error);
      showNotificationMessage('Nie udało się załadować kosztorysu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createNewEstimate = () => {
    const now = new Date().toISOString();
    const newEstimate: KosztorysCostEstimate = {
      id: '',
      company_id: currentUser?.company_id || '',
      created_by_id: currentUser?.id || '',
      settings: {
        type: 'contractor',
        name: 'Nowy kosztorys',
        description: '',
        created: now,
        modified: now,
        defaultCurrency: 'PLN',
        calculationTemplate: 'overhead-on-top',
        print: {
          pages: [],
          titlePage: {
            companyInfo: { name: '', address: '', contacts: [] },
            documentTitle: 'Kosztorys',
            showCostFields: true,
            showManHourRate: true,
            showOverheadsCosts: true,
            orderDetails: { orderName: '', constructionSiteAddress: '' },
            clientDetails: { clientName: '', clientAddress: '' },
            contractorDetails: { contractorName: '', contractorAddress: '', industry: '' },
            participants: {
              preparedBy: '',
              preparedAt: '',
              preparedByIndustry: '',
              checkedBy: '',
              checkedAt: '',
              checkedByIndustry: '',
            },
          },
        },
        precision: {
          norms: 6,
          resources: 2,
          measurements: 2,
          unitValues: 2,
          positionBase: 2,
          costEstimateBase: 2,
          roundingMethod: 'default',
        },
      },
      data: createEmptyEstimateData(),
      totalLabor: 0,
      totalMaterial: 0,
      totalEquipment: 0,
      totalOverhead: 0,
      totalValue: 0,
      created_at: now,
      updated_at: now,
    };

    setEstimate(newEstimate);
    setEstimateData(newEstimate.data);
    setLoading(false);
  };

  const showNotificationMessage = (message: string, type: 'success' | 'error') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Save estimate
  const handleSave = async () => {
    if (!estimate || !currentUser) return;
    setSaving(true);

    try {
      const totals = calculationResult || {
        totalLabor: 0,
        totalMaterial: 0,
        totalEquipment: 0,
        totalOverheads: 0,
        totalValue: 0,
      };

      // Save to existing kosztorys_estimates table
      if (estimate.id) {
        // Calculate VAT
        const subtotalNet = totals.totalLabor + totals.totalMaterial + totals.totalEquipment;
        const vatRate = 23;
        const vatAmount = subtotalNet * (vatRate / 100);
        const totalGross = subtotalNet + vatAmount;

        const { error } = await supabase
          .from('kosztorys_estimates')
          .update({
            total_works: totals.totalLabor,
            total_materials: totals.totalMaterial,
            total_equipment: totals.totalEquipment,
            subtotal_net: subtotalNet,
            vat_amount: vatAmount,
            total_gross: totalGross,
            updated_at: new Date().toISOString(),
          })
          .eq('id', estimate.id);

        if (error) throw error;

        // Also update/sync individual items
        // Delete existing items and recreate from positions
        await supabase
          .from('kosztorys_estimate_items')
          .delete()
          .eq('estimate_id', estimate.id);

        // Insert new items from positions
        const itemsToInsert = Object.values(estimateData.positions).map((pos, index) => {
          const posResult = calculationResult?.positions[pos.id];
          const laborResource = pos.resources.find(r => r.type === 'labor');
          const materialResource = pos.resources.find(r => r.type === 'material');

          return {
            estimate_id: estimate.id,
            position_number: index + 1,
            room_group: pos.marker || '',
            installation_element: '',
            task_description: pos.name,
            material_name: materialResource?.name || null,
            unit_id: 1,
            quantity: posResult?.quantity || 0,
            unit_price_work: laborResource?.unitPrice.value || 0,
            total_work: posResult?.laborTotal || 0,
            unit_price_material: materialResource?.unitPrice.value || 0,
            total_material: posResult?.materialTotal || 0,
            total_item: (posResult?.laborTotal || 0) + (posResult?.materialTotal || 0),
            source: 'manual',
            is_deleted: false,
          };
        });

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('kosztorys_estimate_items')
            .insert(itemsToInsert);

          if (itemsError) console.error('Error saving items:', itemsError);
        }
      } else {
        // Creating new estimate - show notification that save is not supported for new estimates yet
        showNotificationMessage('Tworzenie nowych kosztorysów z edytora nie jest jeszcze obsługiwane. Utwórz kosztorys przez formularz.', 'error');
        setSaving(false);
        return;
      }

      setEditorState(prev => ({ ...prev, isDirty: false, lastSaved: new Date().toISOString() }));
      showNotificationMessage('Kosztorys zapisany', 'success');
    } catch (error: any) {
      console.error('Error saving estimate:', error);
      showNotificationMessage(error.message || 'Błąd podczas zapisywania', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Mark as dirty when data changes
  const updateEstimateData = (newData: KosztorysCostEstimateData) => {
    setEstimateData(newData);
    setEditorState(prev => ({ ...prev, isDirty: true }));
  };

  // Add section
  const handleAddSection = () => {
    const sectionIds = estimateData.root.sectionIds;
    const ordinalNumber = String(sectionIds.length + 1);
    const newSection = createNewSection('Nowy dział', ordinalNumber);

    updateEstimateData({
      ...estimateData,
      root: {
        ...estimateData.root,
        sectionIds: [...sectionIds, newSection.id],
      },
      sections: {
        ...estimateData.sections,
        [newSection.id]: newSection,
      },
    });

    setEditorState(prev => ({
      ...prev,
      selectedItemId: newSection.id,
      selectedItemType: 'section',
      expandedSections: new Set([...prev.expandedSections, newSection.id]),
    }));
  };

  // Add position
  const handleAddPosition = (sectionId: string | null = null) => {
    setTargetSectionId(sectionId);
    setNewPositionForm({ base: '', name: '', unitIndex: '020', measurement: '' });
    setShowAddPositionModal(true);
  };

  const confirmAddPosition = () => {
    const unit = UNITS_REFERENCE.find(u => u.index === newPositionForm.unitIndex) || UNITS_REFERENCE[0];
    const newPosition = createNewPosition(
      newPositionForm.base,
      newPositionForm.name || 'Nowa pozycja',
      unit.unit,
      unit.index
    );

    // Add measurement if provided
    if (newPositionForm.measurement.trim()) {
      newPosition.measurements = addMeasurementEntry(
        newPosition.measurements,
        newPositionForm.measurement,
        'Przedmiar'
      );
    }

    const newData = { ...estimateData };
    newData.positions = { ...newData.positions, [newPosition.id]: newPosition };

    if (targetSectionId && newData.sections[targetSectionId]) {
      newData.sections = {
        ...newData.sections,
        [targetSectionId]: {
          ...newData.sections[targetSectionId],
          positionIds: [...newData.sections[targetSectionId].positionIds, newPosition.id],
        },
      };
    } else {
      newData.root = {
        ...newData.root,
        positionIds: [...newData.root.positionIds, newPosition.id],
      };
    }

    updateEstimateData(newData);
    setShowAddPositionModal(false);

    setEditorState(prev => ({
      ...prev,
      selectedItemId: newPosition.id,
      selectedItemType: 'position',
      expandedPositions: new Set([...prev.expandedPositions, newPosition.id]),
    }));
  };

  // Add resource
  const handleAddResource = (positionId: string, resourceType?: KosztorysResourceType) => {
    setTargetPositionId(positionId);
    const defaultUnitIndex = resourceType === 'labor' ? '149' : resourceType === 'equipment' ? '150' : '020';
    setNewResourceForm({
      type: resourceType || 'labor',
      name: '',
      index: '',
      normValue: 1,
      unitPrice: 0,
      unitIndex: defaultUnitIndex,
    });
    setShowAddResourceModal(true);
  };

  const confirmAddResource = () => {
    if (!targetPositionId) return;

    const unit = UNITS_REFERENCE.find(u => u.index === newResourceForm.unitIndex) || UNITS_REFERENCE[0];
    const newResource = createNewResource(
      newResourceForm.type,
      newResourceForm.name,
      newResourceForm.normValue,
      newResourceForm.unitPrice,
      unit.unit,
      unit.index
    );

    if (newResourceForm.index) {
      newResource.originIndex = { type: 'ETO', index: newResourceForm.index };
    }

    const position = estimateData.positions[targetPositionId];
    if (!position) return;

    updateEstimateData({
      ...estimateData,
      positions: {
        ...estimateData.positions,
        [targetPositionId]: {
          ...position,
          resources: [...position.resources, newResource],
        },
      },
    });

    setShowAddResourceModal(false);

    setEditorState(prev => ({
      ...prev,
      selectedItemId: newResource.id,
      selectedItemType: 'resource',
    }));
  };

  // Update selected item
  const handleUpdateSelectedItem = (updates: Partial<any>) => {
    if (!editorState.selectedItemId || !editorState.selectedItemType) return;

    const newData = { ...estimateData };

    switch (editorState.selectedItemType) {
      case 'section': {
        const section = newData.sections[editorState.selectedItemId];
        if (section) {
          newData.sections = {
            ...newData.sections,
            [editorState.selectedItemId]: { ...section, ...updates },
          };
        }
        break;
      }
      case 'position': {
        const position = newData.positions[editorState.selectedItemId];
        if (position) {
          newData.positions = {
            ...newData.positions,
            [editorState.selectedItemId]: { ...position, ...updates },
          };
        }
        break;
      }
      case 'resource': {
        for (const [posId, position] of Object.entries(newData.positions)) {
          const resourceIndex = position.resources.findIndex(r => r.id === editorState.selectedItemId);
          if (resourceIndex !== -1) {
            const newResources = [...position.resources];
            newResources[resourceIndex] = { ...newResources[resourceIndex], ...updates };
            newData.positions = {
              ...newData.positions,
              [posId]: { ...position, resources: newResources },
            };
            break;
          }
        }
        break;
      }
    }

    updateEstimateData(newData);
  };

  // Delete item
  const handleDeleteItem = (itemId: string, itemType: 'section' | 'position' | 'resource') => {
    const newData = { ...estimateData };

    switch (itemType) {
      case 'section': {
        const { [itemId]: removed, ...remainingSections } = newData.sections;
        newData.sections = remainingSections;
        newData.root = {
          ...newData.root,
          sectionIds: newData.root.sectionIds.filter(id => id !== itemId),
        };
        break;
      }
      case 'position': {
        const { [itemId]: removed, ...remainingPositions } = newData.positions;
        newData.positions = remainingPositions;
        newData.root = {
          ...newData.root,
          positionIds: newData.root.positionIds.filter(id => id !== itemId),
        };
        // Also remove from sections
        for (const [secId, section] of Object.entries(newData.sections)) {
          if (section.positionIds.includes(itemId)) {
            newData.sections = {
              ...newData.sections,
              [secId]: {
                ...section,
                positionIds: section.positionIds.filter(id => id !== itemId),
              },
            };
          }
        }
        break;
      }
      case 'resource': {
        for (const [posId, position] of Object.entries(newData.positions)) {
          const resourceIndex = position.resources.findIndex(r => r.id === itemId);
          if (resourceIndex !== -1) {
            newData.positions = {
              ...newData.positions,
              [posId]: {
                ...position,
                resources: position.resources.filter(r => r.id !== itemId),
              },
            };
            break;
          }
        }
        break;
      }
    }

    updateEstimateData(newData);

    if (editorState.selectedItemId === itemId) {
      setEditorState(prev => ({ ...prev, selectedItemId: null, selectedItemType: null }));
    }
  };

  // Toggle expand
  const toggleExpandSection = (sectionId: string) => {
    setEditorState(prev => {
      const newExpanded = new Set(prev.expandedSections);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      return { ...prev, expandedSections: newExpanded };
    });
  };

  const toggleExpandPosition = (positionId: string) => {
    setEditorState(prev => {
      const newExpanded = new Set(prev.expandedPositions);
      if (newExpanded.has(positionId)) {
        newExpanded.delete(positionId);
      } else {
        newExpanded.add(positionId);
      }
      return { ...prev, expandedPositions: newExpanded };
    });
  };

  // Select item
  const selectItem = (itemId: string, itemType: 'section' | 'position' | 'resource') => {
    setEditorState(prev => ({
      ...prev,
      selectedItemId: itemId,
      selectedItemType: itemType,
    }));
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!estimate || !calculationResult) return;

    let csv = 'Lp.;Podstawa;Nakład;j.m.;Nakład j.;Ceny jedn.;Koszt jedn.;Ilość;Wartość\n';

    let positionNumber = 0;
    const allPositionIds = [
      ...estimateData.root.positionIds,
      ...Object.values(estimateData.sections).flatMap(s => s.positionIds),
    ];

    for (const posId of allPositionIds) {
      const position = estimateData.positions[posId];
      if (!position) continue;

      positionNumber++;
      const result = calculationResult.positions[posId];
      const quantity = result?.quantity || 0;
      const unitCost = result?.unitCost || 0;
      const total = result?.totalWithOverheads || 0;

      csv += `${positionNumber};${position.base};${position.name};${position.unit.label};;${formatNumber(unitCost)};${formatNumber(unitCost)};${formatNumber(quantity)};${formatNumber(total)}\n`;

      for (const resource of position.resources) {
        const resResult = result?.resources.find(r => r.id === resource.id);
        const config = RESOURCE_TYPE_CONFIG[resource.type];
        csv += `;${config.shortLabel};${resource.originIndex.index};${resource.name};${resource.unit.label};${formatNumber(resResult?.calculatedQuantity || 0)};${formatNumber(resource.unitPrice.value)};;${formatNumber(resResult?.calculatedValue || 0)}\n`;
      }
    }

    csv += `\n;;;;;Razem koszty bezpośrednie;;;${formatNumber(calculationResult.totalDirect)}\n`;
    csv += `;;;;;Razem z narzutami;;;${formatNumber(calculationResult.totalValue)}\n`;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${estimate.settings.name || 'kosztorys'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showNotificationMessage('Eksport do CSV zakończony', 'success');
  };

  // Render position row
  const renderPositionRow = (position: KosztorysPosition, positionNumber: number, sectionId: string | null) => {
    const isExpanded = editorState.expandedPositions.has(position.id);
    const isSelected = editorState.selectedItemId === position.id;
    const result = calculationResult?.positions[position.id];
    const quantity = result?.quantity || 0;

    return (
      <React.Fragment key={position.id}>
        {/* Position row */}
        <tr
          className={`border-b border-slate-200 hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
          onClick={() => selectItem(position.id, 'position')}
        >
          <td className="px-2 py-2 text-sm w-10">
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpandPosition(position.id); }}
              className="p-0.5 hover:bg-slate-200 rounded"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </td>
          <td className="px-2 py-2 text-sm font-medium text-blue-700">
            {positionNumber}
            {position.base && (
              <div className="text-xs text-slate-500 font-mono mt-0.5">{position.base}</div>
            )}
          </td>
          <td className="px-2 py-2 text-sm">
            <div className="font-medium text-slate-900">{position.name}</div>
            {position.measurements.rootIds.length > 0 && (
              <div className="text-xs text-slate-500 mt-0.5">
                Przedmiar = {formatNumber(quantity)} {position.unit.label}
              </div>
            )}
          </td>
          <td className="px-2 py-2 text-sm text-center text-slate-600">{position.unit.label}</td>
          <td className="px-2 py-2 text-sm text-right text-slate-600">
            {result?.unitCost ? formatNumber(result.unitCost) : '-'}
          </td>
          <td className="px-2 py-2 text-sm text-right text-slate-600">
            {result?.unitCost ? formatNumber(result.unitCost) : '-'}
          </td>
          <td className="px-2 py-2 text-sm text-right font-medium">{formatNumber(quantity)}</td>
          <td className="px-2 py-2 text-sm text-right font-bold text-slate-900">
            {formatNumber(result?.totalWithOverheads || 0)}
          </td>
          <td className="px-2 py-2 text-sm w-24">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleAddResource(position.id); }}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600"
                title="Dodaj nakład"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Czy na pewno chcesz usunąć tę pozycję?')) {
                    handleDeleteItem(position.id, 'position');
                  }
                }}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-red-600"
                title="Usuń"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>

        {/* Resources rows */}
        {isExpanded && position.resources.map((resource, index) => {
          const config = RESOURCE_TYPE_CONFIG[resource.type];
          const resResult = result?.resources.find(r => r.id === resource.id);
          const isResourceSelected = editorState.selectedItemId === resource.id;

          return (
            <tr
              key={resource.id}
              className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${isResourceSelected ? 'bg-blue-50' : ''}`}
              onClick={() => selectItem(resource.id, 'resource')}
            >
              <td className="px-2 py-1.5"></td>
              <td className="px-2 py-1.5 text-sm">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                  {config.shortLabel}
                </span>
              </td>
              <td className="px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-slate-500 font-mono text-xs">{resource.originIndex.index || index + 1}</span>
                  <span className="text-slate-700">{resource.name}</span>
                </div>
                <div className="text-xs text-slate-400 pl-4 mt-0.5">
                  {formatNumber(resource.norm.value, 4)} × {position.multiplicationFactor} × {formatNumber(quantity)}
                </div>
              </td>
              <td className="px-2 py-1.5 text-sm text-center text-slate-500">{resource.unit.label}</td>
              <td className="px-2 py-1.5 text-sm text-right text-slate-500">
                {formatNumber(resResult?.calculatedQuantity || 0, 4)}
              </td>
              <td className="px-2 py-1.5 text-sm text-right text-slate-500">
                {formatNumber(resource.unitPrice.value)}
              </td>
              <td className="px-2 py-1.5 text-sm text-right text-slate-500">
                {formatNumber(resResult?.calculatedQuantity || 0, 2)}
              </td>
              <td className="px-2 py-1.5 text-sm text-right text-slate-600">
                {formatNumber(resResult?.calculatedValue || 0)}
              </td>
              <td className="px-2 py-1.5 text-sm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Czy na pewno chcesz usunąć ten nakład?')) {
                      handleDeleteItem(resource.id, 'resource');
                    }
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-600"
                  title="Usuń"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          );
        })}

        {/* Position summary row */}
        {isExpanded && result && (
          <tr className="bg-slate-50 border-b border-slate-200">
            <td colSpan={5}></td>
            <td colSpan={2} className="px-2 py-1.5 text-xs text-slate-600">
              <div>Razem koszty bezpośrednie</div>
              <div>Razem z narzutami</div>
              <div>Cena jednostkowa</div>
            </td>
            <td className="px-2 py-1.5 text-sm text-right font-medium">
              <div>{formatNumber(result.directCostsTotal)}</div>
              <div>{formatNumber(result.totalWithOverheads)}</div>
              <div>{formatNumber(result.unitCost)}</div>
            </td>
            <td></td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // Render section
  const renderSection = (section: KosztorysSection, sectionIndex: number) => {
    const isExpanded = editorState.expandedSections.has(section.id);
    const isSelected = editorState.selectedItemId === section.id;
    const sectionResult = calculationResult?.sections[section.id];

    return (
      <React.Fragment key={section.id}>
        {/* Section header row */}
        <tr
          className={`bg-slate-100 border-b border-slate-300 cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
          onClick={() => selectItem(section.id, 'section')}
        >
          <td className="px-2 py-2 text-sm">
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpandSection(section.id); }}
              className="p-0.5 hover:bg-slate-200 rounded"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </td>
          <td className="px-2 py-2 text-sm font-bold text-slate-700">{section.ordinalNumber}</td>
          <td colSpan={5} className="px-2 py-2 text-sm font-bold text-slate-900">{section.name}</td>
          <td className="px-2 py-2 text-sm text-right font-bold text-slate-900">
            {sectionResult ? formatNumber(sectionResult.totalValue) : '-'}
          </td>
          <td className="px-2 py-2 text-sm">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleAddPosition(section.id); }}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600"
                title="Dodaj pozycję"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Czy na pewno chcesz usunąć ten dział?')) {
                    handleDeleteItem(section.id, 'section');
                  }
                }}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-red-600"
                title="Usuń"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>

        {/* Positions in section */}
        {isExpanded && section.positionIds.map((posId, posIndex) => {
          const position = estimateData.positions[posId];
          if (!position) return null;
          return renderPositionRow(position, posIndex + 1, section.id);
        })}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-2 py-1.5 flex items-center gap-1 flex-wrap">
        <button
          onClick={() => navigate('/construction/estimates')}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          <Menu className="w-4 h-4" />
          Kosztorys
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          <Printer className="w-4 h-4" />
          Drukuj
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button
          onClick={handleAddSection}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          <FolderPlus className="w-4 h-4" />
          Dział
        </button>
        <button
          onClick={() => handleAddPosition(null)}
          className="flex items-center gap-1 px-2 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
        >
          <span className="bg-blue-500 text-white text-xs px-1 rounded">KNR</span>
          Pozycja
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button
          onClick={() => editorState.selectedItemType === 'position' && editorState.selectedItemId && handleAddResource(editorState.selectedItemId)}
          disabled={editorState.selectedItemType !== 'position'}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40"
        >
          <Hash className="w-4 h-4" />
          Nakład
        </button>
        <button
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
          onClick={() => setShowOverheadsModal(true)}
        >
          <Layers className="w-4 h-4" />
          Uzupełnij nakłady
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">
          <DollarSign className="w-4 h-4" />
          Ceny
        </button>
        <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">
          <MessageSquare className="w-4 h-4" />
          Komentarze
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button
          onClick={() => {
            if (editorState.selectedItemId && confirm('Czy na pewno chcesz usunąć zaznaczony element?')) {
              handleDeleteItem(editorState.selectedItemId, editorState.selectedItemType!);
            }
          }}
          disabled={!editorState.selectedItemId}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
          Usuń
        </button>
        <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40">
          <MoveUp className="w-4 h-4" />
          Przesuń
        </button>
        <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40">
          <Scissors className="w-4 h-4" />
          Wytnij
        </button>
        <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40">
          <Copy className="w-4 h-4" />
          Kopiuj
        </button>
        <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-40">
          <ClipboardPaste className="w-4 h-4" />
          Wklej
        </button>

        <div className="flex-1" />

        <button className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">
          <Calculator className="w-4 h-4" />
          Sprawdź kosztorys
        </button>
        <button
          onClick={() => setShowPropertiesPanel(!showPropertiesPanel)}
          className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded ${showPropertiesPanel ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Eye className="w-4 h-4" />
          Opcje widoku
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
        >
          <Settings className="w-4 h-4" />
          Ustawienia
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Properties toggle */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="flex border-b border-slate-200">
            <button className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
              Przegląd
            </button>
            <button
              onClick={() => setShowPropertiesPanel(true)}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Właściwości
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-slate-500 text-center">
              Wybierz element na kosztorysie, aby wyświetlić jego właściwości
            </p>

            {/* Quick add buttons */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleAddSection}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 rounded-lg border border-dashed border-slate-300"
              >
                <FolderPlus className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">Dodaj dział</span>
              </button>
              <button
                onClick={() => handleAddPosition(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 rounded-lg border border-dashed border-slate-300"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">Dodaj pozycję</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-300">
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase w-10">Lp.</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase w-32">Podstawa</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase">Nakład</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-slate-500 uppercase w-16">j.m.</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">Nakład j.</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">Ceny jedn.</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase w-20">Ilość</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 uppercase w-28">Wartość</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-slate-500 uppercase w-24">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {/* Root level positions */}
              {estimateData.root.positionIds.map((posId, index) => {
                const position = estimateData.positions[posId];
                if (!position) return null;
                return renderPositionRow(position, index + 1, null);
              })}

              {/* Sections */}
              {estimateData.root.sectionIds.map((sectionId, index) => {
                const section = estimateData.sections[sectionId];
                if (!section) return null;
                return renderSection(section, index);
              })}

              {/* Empty state */}
              {estimateData.root.sectionIds.length === 0 && estimateData.root.positionIds.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="text-slate-400 mb-4">
                      <FileText className="w-12 h-12 mx-auto mb-2" />
                      <p>Kosztorys jest pusty</p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={handleAddSection}
                        className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                      >
                        <FolderPlus className="w-4 h-4 inline mr-1" />
                        Dodaj dział
                      </button>
                      <button
                        onClick={() => handleAddPosition(null)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 inline mr-1" />
                        Dodaj pozycję
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Properties panel */}
        {showPropertiesPanel && (
          <PropertiesPanel
            selectedItem={selectedItem}
            selectedType={editorState.selectedItemType}
            calculationResult={selectedPositionResult}
            onUpdate={handleUpdateSelectedItem}
            onClose={() => setShowPropertiesPanel(false)}
          />
        )}
      </div>

      {/* Footer with totals */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Zapisz
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Eksport CSV
          </button>
          {editorState.isDirty && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Niezapisane zmiany
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-sm text-slate-500 mr-4">
            Wartość kosztorysu:
          </span>
          <span className="text-xl font-bold text-slate-900">
            {formatCurrency(calculationResult?.totalValue || 0)}
          </span>
        </div>
      </div>

      {/* Add Position Modal */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Dodaj pozycję</h2>
              <button onClick={() => setShowAddPositionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Podstawa (norma)</label>
                <input
                  type="text"
                  value={newPositionForm.base}
                  onChange={e => setNewPositionForm(prev => ({ ...prev, base: e.target.value }))}
                  placeholder="np. KNNR 5 0702-01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa nakładu</label>
                <textarea
                  value={newPositionForm.name}
                  onChange={e => setNewPositionForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Opis pracy..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka miary</label>
                  <select
                    value={newPositionForm.unitIndex}
                    onChange={e => setNewPositionForm(prev => ({ ...prev, unitIndex: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {UNITS_REFERENCE.map(u => (
                      <option key={u.index} value={u.index}>{u.unit} - {u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Przedmiar (ilość)</label>
                  <input
                    type="text"
                    value={newPositionForm.measurement}
                    onChange={e => setNewPositionForm(prev => ({ ...prev, measurement: e.target.value }))}
                    placeholder="np. 10*2.5 lub 25"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddPositionModal(false)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={confirmAddPosition}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Dodaj pozycję
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Resource Modal */}
      {showAddResourceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Dodaj nakład</h2>
              <button onClick={() => setShowAddResourceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ nakładu</label>
                <div className="flex gap-2">
                  {(['labor', 'material', 'equipment'] as KosztorysResourceType[]).map(type => {
                    const config = RESOURCE_TYPE_CONFIG[type];
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          const defaultUnitIndex = type === 'labor' ? '149' : type === 'equipment' ? '150' : '020';
                          setNewResourceForm(prev => ({ ...prev, type, unitIndex: defaultUnitIndex }));
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border ${
                          newResourceForm.type === type
                            ? `${config.bgColor} ${config.color} border-current`
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <config.icon className="w-4 h-4" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Indeks</label>
                  <input
                    type="text"
                    value={newResourceForm.index}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, index: e.target.value }))}
                    placeholder="np. 999"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka</label>
                  <select
                    value={newResourceForm.unitIndex}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, unitIndex: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {UNITS_REFERENCE.map(u => (
                      <option key={u.index} value={u.index}>{u.unit} - {u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa</label>
                <input
                  type="text"
                  value={newResourceForm.name}
                  onChange={e => setNewResourceForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={RESOURCE_TYPE_CONFIG[newResourceForm.type].label}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Norma</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newResourceForm.normValue}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, normValue: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cena jednostkowa</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newResourceForm.unitPrice}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddResourceModal(false)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={confirmAddResource}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Dodaj nakład
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white flex items-center gap-2 z-50`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default KosztorysEditorPage;
