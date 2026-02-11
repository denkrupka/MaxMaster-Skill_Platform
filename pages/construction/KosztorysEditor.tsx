/**
 * KosztorysEditor - Full-featured cost estimate editor
 * Based on eKosztorysowanie.pl interface and functionality
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Menu, Printer, Plus, FolderPlus, FileText, Hash, Layers,
  ChevronDown, ChevronRight, ChevronUp, Trash2, Copy, ClipboardPaste,
  Scissors, MoveUp, MoveDown, Settings, Eye, CheckCircle2,
  AlertCircle, Save, Download, Upload, RefreshCw, X, Home,
  Calculator, Users, Package, Wrench, Percent, DollarSign,
  MessageSquare, Search, Filter, MoreHorizontal, Loader2, Monitor,
  ArrowLeft, FileSpreadsheet, Clock, List, LayoutList, Expand,
  GripVertical, FileBarChart, FilePieChart, Table2, BookOpen, Grid3X3,
  HelpCircle, Camera, Flag, Clipboard, User, Puzzle, ChevronLeft, ArrowUpRight, Sparkles, SquarePen
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

// View mode types - extended with all views from eKosztorysowanie
type ViewMode = 'przedmiar' | 'kosztorys' | 'naklady' | 'narzuty' | 'zestawienia' | 'pozycje';
type LeftPanelMode = 'overview' | 'properties' | 'export' | 'catalog' | 'comments' | 'titlePageEditor';
type ZestawieniaTab = 'robocizna' | 'materialy' | 'sprzet';

// Title page editor data structure - matching eKosztorysowanie exactly
interface TitlePageData {
  title: string;
  hideManHourRate: boolean;
  hideOverheads: boolean;
  hideWorkValue: boolean;
  companyName: string;
  companyAddress: string;
  orderName: string;
  orderAddress: string;
  clientName: string;
  clientAddress: string;
  contractorName: string;
  contractorAddress: string;
  contractorNIP: string;  // NIP wykonawcy
  industry: string;
  preparedBy: string;
  preparedByIndustry: string;
  checkedBy: string;
  checkedByIndustry: string;
  preparedDate: string;
  approvedDate: string;
  // Stawki section
  stawkaRobocizny: string;
  kosztyPosrednie: string;
  zysk: string;
  kosztyZakupu: string;
}

// Export page types for print configuration
interface ExportPage {
  id: string;
  type: 'strona_tytulowa' | 'tabela_elementow' | 'przedmiar' | 'kosztorys_inwestorski' |
        'kalkulacja_szczegolowa' | 'kosztorys_szczegolowy' | 'zestawienie_robocizny' |
        'zestawienie_materialow' | 'zestawienie_sprzetu';
  label: string;
  enabled: boolean;
  canEdit?: boolean;
}

// Default export pages configuration
const DEFAULT_EXPORT_PAGES: ExportPage[] = [
  { id: 'p1', type: 'strona_tytulowa', label: 'Strona tytułowa', enabled: true, canEdit: true },
  { id: 'p2', type: 'tabela_elementow', label: 'Tabela elementów scalonych', enabled: true },
  { id: 'p3', type: 'przedmiar', label: 'Przedmiar', enabled: true },
  { id: 'p4', type: 'kosztorys_inwestorski', label: 'Kosztorys inwestorski', enabled: true },
  { id: 'p5', type: 'kalkulacja_szczegolowa', label: 'Szczegółowa kalkulacja cen jednostkowych', enabled: false },
  { id: 'p6', type: 'kosztorys_szczegolowy', label: 'Szczegółowy kosztorys inwestorski', enabled: false },
  { id: 'p7', type: 'zestawienie_robocizny', label: 'Zestawienie robocizny', enabled: true },
  { id: 'p8', type: 'zestawienie_materialow', label: 'Zestawienie materiałów', enabled: true },
  { id: 'p9', type: 'zestawienie_sprzetu', label: 'Zestawienie sprzętu', enabled: true },
];

// Left navigation items - matching eKosztorysowanie exactly
// P = Przedmiar, icons match the portal
const LEFT_NAV_ITEMS = [
  { id: 'przedmiar', label: 'Przedmiar', shortLabel: 'P', icon: List, viewMode: 'przedmiar' as ViewMode },
  { id: 'kosztorysy', label: 'Kosztorys', shortLabel: 'C', icon: FileBarChart, viewMode: 'kosztorys' as ViewMode },
  { id: 'pozycje', label: 'Pozycje', shortLabel: null, icon: LayoutList, viewMode: 'pozycje' as ViewMode },
  { id: 'naklady', label: 'Nakłady', shortLabel: null, icon: Layers, viewMode: 'naklady' as ViewMode },
  { id: 'narzuty', label: 'Narzuty', shortLabel: null, icon: Percent, viewMode: 'narzuty' as ViewMode },
  { id: 'zestawienia', label: 'Zestawienia', shortLabel: null, icon: Table2, viewMode: 'zestawienia' as ViewMode },
  { id: 'wydruki', label: 'Wydruki', shortLabel: null, icon: Printer, viewMode: null, panelMode: 'export' as LeftPanelMode },
];

// Active toolbar mode - determines which buttons are shown
type ToolbarMode = 'przedmiar' | 'kosztorys' | 'naklady' | 'wydruki';

// KNR Catalog structure
interface CatalogItem {
  id: string;
  code: string;
  name: string;
  type: 'catalog' | 'chapter' | 'table' | 'position';
  children?: CatalogItem[];
  unit?: string;
  norms?: { type: KosztorysResourceType; value: number; unit: string }[];
}

// Sample KNR catalog data (based on eKosztorysowanie screenshots)
const KNR_CATALOG: CatalogItem[] = [
  {
    id: 'knnr5',
    code: 'KNNR 5',
    name: 'Instalacje elektryczne i sieci zewnętrzne',
    type: 'catalog',
    children: [
      {
        id: 'knnr5-07',
        code: '(Rozdział 07)',
        name: 'Elektroenergetyczne linie kablowe',
        type: 'chapter',
        children: [
          {
            id: 'knnr5-0701',
            code: 'KNNR 5 0701',
            name: 'Kopanie rowów dla kabli',
            type: 'table',
            children: [
              {
                id: 'knnr5-0701-01',
                code: 'KNNR 5 0701-01',
                name: 'Kopanie rowów dla kabli w sposób ręczny w gruncie kat. I-II',
                type: 'position',
                unit: 'm3',
                norms: [{ type: 'labor', value: 1.35, unit: 'r-g' }],
              },
              {
                id: 'knnr5-0701-02',
                code: 'KNNR 5 0701-02',
                name: 'Kopanie rowów dla kabli w sposób ręczny w gruncie kat. III',
                type: 'position',
                unit: 'm3',
                norms: [{ type: 'labor', value: 1.65, unit: 'r-g' }],
              },
              {
                id: 'knnr5-0701-03',
                code: 'KNNR 5 0701-03',
                name: 'Kopanie rowów dla kabli w sposób ręczny w gruncie kat. IV',
                type: 'position',
                unit: 'm3',
                norms: [{ type: 'labor', value: 2.10, unit: 'r-g' }],
              },
              {
                id: 'knnr5-0701-04',
                code: 'KNNR 5 0701-04',
                name: 'Kopanie rowów dla kabli w sposób mechaniczny w gruncie kat. I-II',
                type: 'position',
                unit: 'm3',
                norms: [{ type: 'equipment', value: 0.15, unit: 'm-g' }],
              },
            ],
          },
          {
            id: 'knnr5-0702',
            code: 'KNNR 5 0702',
            name: 'Zasypywanie rowów dla kabli',
            type: 'table',
            children: [
              {
                id: 'knnr5-0702-01',
                code: 'KNNR 5 0702-01',
                name: 'Zasypywanie rowów dla kabli wykonanych ręcznie w gruncie kat. I-II',
                type: 'position',
                unit: 'm3',
                norms: [{ type: 'labor', value: 0.89, unit: 'r-g' }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'knr2-02',
    code: 'KNR 2-02',
    name: 'Konstrukcje budowlane',
    type: 'catalog',
    children: [
      {
        id: 'knr2-02-01',
        code: '(Rozdział 01)',
        name: 'Roboty ziemne',
        type: 'chapter',
        children: [
          {
            id: 'knr2-02-0101',
            code: 'KNR 2-02 0101',
            name: 'Wykopy',
            type: 'table',
            children: [
              {
                id: 'knr2-02-0101-01',
                code: 'KNR 2-02 0101-01',
                name: 'Wykopy jamiste o głęb. do 1,5 m w gruncie kat. I-II',
                type: 'position',
                unit: 'm3',
                norms: [{ type: 'labor', value: 1.20, unit: 'r-g' }],
              },
            ],
          },
        ],
      },
    ],
  },
];

// Resource type configuration (extended with waste type)
type ExtendedResourceType = KosztorysResourceType | 'waste';
const RESOURCE_TYPE_CONFIG: Record<ExtendedResourceType, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  icon: React.FC<{ className?: string }>;
}> = {
  labor: { label: 'Robocizna', shortLabel: 'R', color: 'text-yellow-700', bgColor: 'bg-[#FCD34D]', icon: Users },
  material: { label: 'Materiał', shortLabel: 'M', color: 'text-blue-700', bgColor: 'bg-[#60A5FA]', icon: Package },
  equipment: { label: 'Sprzęt', shortLabel: 'S', color: 'text-emerald-700', bgColor: 'bg-[#34D399]', icon: Wrench },
  waste: { label: 'Odpady', shortLabel: 'O', color: 'text-gray-800', bgColor: 'bg-gray-100', icon: Trash2 },
};

// Export template types
type ExportTemplate = 'kosztorys_inwestorski' | 'przedmiar_robot' | 'niestandardowy';

// Comment type for the comments panel
interface KosztorysComment {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  text: string;
  timestamp: string;
  sectionId?: string;
  sectionName?: string;
  status: 'do_weryfikacji' | 'zatwierdzony' | 'odrzucony' | 'nowy';
}

// Price update dialog settings
interface PriceUpdateSettings {
  applyToLabor: boolean;
  applyToMaterial: boolean;
  applyToEquipment: boolean;
  applyToWaste: boolean;
  unitPositionPrices: boolean;
  emptyUnitPrices: boolean;
  objectPrices: boolean;
  onlyZeroPrices: boolean;
  skipStepProcess: boolean;
  expression: {
    field: 'cena' | 'wartosc';
    operation: 'add' | 'subtract' | 'multiply' | 'divide';
    value: string;
  };
  zeroPrices: boolean;
}

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
  expandedSubsections: new Set(),
  clipboard: null,
  isDirty: false,
  lastSaved: null,
  treeRootExpanded: true,
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
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <p className="text-gray-500 text-sm text-center mt-8">
          Wybierz element na kosztorysie, aby wyświetlić jego właściwości
        </p>
      </div>
    );
  }

  const renderSectionProperties = (section: KosztorysSection) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa działu</label>
        <input
          type="text"
          value={section.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Opis</label>
        <textarea
          value={section.description}
          onChange={e => onUpdate({ description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          rows={3}
        />
      </div>
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Współczynniki działu</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500">R (robocizna)</label>
            <input
              type="number"
              step="0.01"
              value={section.factors.labor}
              onChange={e => onUpdate({ factors: { ...section.factors, labor: parseFloat(e.target.value) || 1 } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">M (materiały)</label>
            <input
              type="number"
              step="0.01"
              value={section.factors.material}
              onChange={e => onUpdate({ factors: { ...section.factors, material: parseFloat(e.target.value) || 1 } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">S (sprzęt)</label>
            <input
              type="number"
              step="0.01"
              value={section.factors.equipment}
              onChange={e => onUpdate({ factors: { ...section.factors, equipment: parseFloat(e.target.value) || 1 } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Odpady %</label>
            <input
              type="number"
              step="0.1"
              value={section.factors.waste}
              onChange={e => onUpdate({ factors: { ...section.factors, waste: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderPositionProperties = (position: KosztorysPosition) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Podstawa (norma)</label>
        <input
          type="text"
          value={position.base}
          onChange={e => onUpdate({ base: e.target.value, originBase: e.target.value })}
          placeholder="np. KNNR 5 0702-01"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa nakładu</label>
        <textarea
          value={position.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Jednostka</label>
          <select
            value={position.unit.unitIndex}
            onChange={e => {
              const unit = UNITS_REFERENCE.find(u => u.index === e.target.value);
              if (unit) onUpdate({ unit: { label: unit.unit, unitIndex: unit.index } });
            }}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {UNITS_REFERENCE.map(u => (
              <option key={u.index} value={u.index}>{u.unit} - {u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mnożnik</label>
          <input
            type="number"
            step="0.01"
            value={position.multiplicationFactor}
            onChange={e => onUpdate({ multiplicationFactor: parseFloat(e.target.value) || 1 })}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {calculationResult && (
        <div className="pt-4 border-t border-gray-200 space-y-2">
          <h4 className="text-sm font-medium text-gray-800">Podsumowanie pozycji</h4>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ilość:</span>
              <span className="font-medium">{formatNumber(calculationResult.quantity)} {position.unit.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Robocizna:</span>
              <span className="font-medium">{formatCurrency(calculationResult.laborTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Materiały:</span>
              <span className="font-medium">{formatCurrency(calculationResult.materialTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sprzęt:</span>
              <span className="font-medium">{formatCurrency(calculationResult.equipmentTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-600 font-medium">Koszty bezpośrednie:</span>
              <span className="font-bold">{formatCurrency(calculationResult.directCostsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">Razem z narzutami:</span>
              <span className="font-bold text-blue-600">{formatCurrency(calculationResult.totalWithOverheads)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">Cena jednostkowa:</span>
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
          <span className="text-sm font-medium text-gray-800">{config.label}</span>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa</label>
          <input
            type="text"
            value={resource.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Indeks</label>
          <input
            type="text"
            value={resource.originIndex.index}
            onChange={e => onUpdate({ originIndex: { ...resource.originIndex, index: e.target.value } })}
            placeholder="np. 999"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Norma</label>
            <input
              type="number"
              step="0.0001"
              value={resource.norm.value}
              onChange={e => onUpdate({ norm: { ...resource.norm, value: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jednostka</label>
            <select
              value={resource.unit.unitIndex}
              onChange={e => {
                const unit = UNITS_REFERENCE.find(u => u.index === e.target.value);
                if (unit) onUpdate({ unit: { label: unit.unit, unitIndex: unit.index } });
              }}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {UNITS_REFERENCE.map(u => (
                <option key={u.index} value={u.index}>{u.unit}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cena jednostkowa</label>
            <input
              type="number"
              step="0.01"
              value={resource.unitPrice.value}
              onChange={e => onUpdate({ unitPrice: { ...resource.unitPrice, value: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Współczynnik</label>
            <input
              type="number"
              step="0.01"
              value={resource.factor}
              onChange={e => onUpdate({ factor: parseFloat(e.target.value) || 1 })}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Właściwości</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
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
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [targetPositionId, setTargetPositionId] = useState<string | null>(null);

  // Drag and drop state for sections
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);

  // View modes
  const [viewMode, setViewMode] = useState<ViewMode>('kosztorys');
  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>('overview');
  const [exportPages, setExportPages] = useState<ExportPage[]>(DEFAULT_EXPORT_PAGES);
  const [draggedExportPageId, setDraggedExportPageId] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<string>('kosztorysy');

  // Catalog browser state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [expandedCatalogItems, setExpandedCatalogItems] = useState<Set<string>>(new Set());
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogQuantity, setCatalogQuantity] = useState('10');
  const [catalogMultiplier, setCatalogMultiplier] = useState('1');

  // Dropdown states
  const [showDzialDropdown, setShowDzialDropdown] = useState(false);
  const [showNakladDropdown, setShowNakladDropdown] = useState(false);
  const [showKNRDropdown, setShowKNRDropdown] = useState(false);
  const [showKomentarzeDropdown, setShowKomentarzeDropdown] = useState(false);
  const [showUsunDropdown, setShowUsunDropdown] = useState(false);
  const [showPrzesunDropdown, setShowPrzesunDropdown] = useState(false);
  const [showUzupelnijDropdown, setShowUzupelnijDropdown] = useState(false);

  // Ceny (Prices) dialog state
  const [showCenyDialog, setShowCenyDialog] = useState(false);
  const [cenyDialogTab, setCenyDialogTab] = useState<'wstaw' | 'zmien'>('wstaw');
  const [priceUpdateSettings, setPriceUpdateSettings] = useState<PriceUpdateSettings>({
    applyToLabor: false,
    applyToMaterial: false,
    applyToEquipment: false,
    applyToWaste: false,
    unitPositionPrices: false,
    emptyUnitPrices: false,
    objectPrices: false,
    onlyZeroPrices: false,
    skipStepProcess: true,
    expression: { field: 'cena', operation: 'add', value: '' },
    zeroPrices: false,
  });

  // Comments panel state
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [commentsFilter, setCommentsFilter] = useState<'all' | 'mine' | 'unresolved' | 'closed'>('all');
  const [commentsSearch, setCommentsSearch] = useState('');
  const [comments, setComments] = useState<KosztorysComment[]>([
    {
      id: '1',
      userId: 'user1',
      userName: 'Denys Krupka',
      userInitials: 'DK',
      text: 'testowy',
      timestamp: '18:31',
      sectionName: 'Dział 1.1',
      status: 'nowy',
    },
    {
      id: '2',
      userId: 'user1',
      userName: 'Denys Krupka',
      userInitials: 'DK',
      text: 'sprawdzić',
      timestamp: '18:26',
      sectionName: 'Dział 1',
      status: 'do_weryfikacji',
    },
  ]);

  // Export panel state
  const [exportTemplate, setExportTemplate] = useState<ExportTemplate>('niestandardowy');
  const [exportSearch, setExportSearch] = useState('');

  // Comments display options
  const [showCommentsOnSheet, setShowCommentsOnSheet] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Alerts state
  const [alertsCount, setAlertsCount] = useState({ current: 0, total: 13 });
  const [alerts, setAlerts] = useState<{ id: string; type: 'warning' | 'error'; message: string; positionId?: string }[]>([]);

  // Print dialog state
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printSettings, setPrintSettings] = useState({
    pages: 'all',
    copies: 1,
    orientation: 'portrait',
    color: true,
  });
  const [printPreviewPage, setPrintPreviewPage] = useState(1);
  const [printTotalPages, setPrintTotalPages] = useState(5);

  // Opcje widoku dropdown state
  const [showOpcjeWidokuDropdown, setShowOpcjeWidokuDropdown] = useState(false);
  const [viewOptions, setViewOptions] = useState({
    showPrzemiar: true,
    showNaklady: true,
    showCeny: true,
    showSumy: true,
    compactView: false,
  });

  // Title Page Editor state
  const [titlePageData, setTitlePageData] = useState<TitlePageData>({
    title: '',
    hideManHourRate: false,
    hideOverheads: false,
    hideWorkValue: false,
    companyName: '',
    companyAddress: '',
    orderName: '',
    orderAddress: '',
    clientName: '',
    clientAddress: '',
    contractorName: '',
    contractorAddress: '',
    contractorNIP: '',
    industry: '',
    preparedBy: '',
    preparedByIndustry: '',
    checkedBy: '',
    checkedByIndustry: '',
    preparedDate: '',
    approvedDate: '',
    stawkaRobocizny: '',
    kosztyPosrednie: '',
    zysk: '',
    kosztyZakupu: '',
  });

  // Title Page Editor section expand states
  const [titlePageSections, setTitlePageSections] = useState({
    title: true,
    workValue: true,
    company: true,
    order: true,
    client: true,
    contractor: true,
    participants: true,
    dates: true,
    stawki: true,  // Ставки section
  });

  // Zestawienia (Summaries) tab state
  const [zestawieniaTab, setZestawieniaTab] = useState<ZestawieniaTab>('robocizna');

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

  // Reorder sections via drag-and-drop
  const handleSectionReorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;

    const sectionIds = [...estimateData.root.sectionIds];
    const draggedIndex = sectionIds.indexOf(draggedId);
    const targetIndex = sectionIds.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at target position
    sectionIds.splice(draggedIndex, 1);
    sectionIds.splice(targetIndex, 0, draggedId);

    // Update ordinal numbers
    const updatedSections = { ...estimateData.sections };
    sectionIds.forEach((id, index) => {
      if (updatedSections[id]) {
        updatedSections[id] = {
          ...updatedSections[id],
          ordinalNumber: String(index + 1),
        };
      }
    });

    updateEstimateData({
      ...estimateData,
      root: {
        ...estimateData.root,
        sectionIds,
      },
      sections: updatedSections,
    });
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

  // Move position in various directions
  const handleMovePosition = (direction: 'up' | 'down' | 'out' | 'last' | 'first') => {
    if (!editorState.selectedItemId || editorState.selectedItemType !== 'position') return;

    const posId = editorState.selectedItemId;
    const newData = { ...estimateData };

    // Find which array the position is in
    let positionIds: string[] | null = null;
    let sectionId: string | null = null;

    if (newData.root.positionIds.includes(posId)) {
      positionIds = [...newData.root.positionIds];
    } else {
      for (const [secId, section] of Object.entries(newData.sections)) {
        if (section.positionIds.includes(posId)) {
          positionIds = [...section.positionIds];
          sectionId = secId;
          break;
        }
      }
    }

    if (!positionIds) return;
    const currentIndex = positionIds.indexOf(posId);

    switch (direction) {
      case 'up':
        if (currentIndex > 0) {
          [positionIds[currentIndex], positionIds[currentIndex - 1]] =
            [positionIds[currentIndex - 1], positionIds[currentIndex]];
        }
        break;
      case 'down':
        if (currentIndex < positionIds.length - 1) {
          [positionIds[currentIndex], positionIds[currentIndex + 1]] =
            [positionIds[currentIndex + 1], positionIds[currentIndex]];
        }
        break;
      case 'out':
        // Move to root level
        positionIds.splice(currentIndex, 1);
        newData.root.positionIds = [...newData.root.positionIds, posId];
        break;
      case 'first':
        // Move to first section
        if (newData.root.sectionIds.length > 0) {
          const firstSectionId = newData.root.sectionIds[0];
          positionIds.splice(currentIndex, 1);
          newData.sections[firstSectionId] = {
            ...newData.sections[firstSectionId],
            positionIds: [...newData.sections[firstSectionId].positionIds, posId],
          };
        }
        break;
      case 'last':
        // Move to last section
        if (newData.root.sectionIds.length > 0) {
          const lastSectionId = newData.root.sectionIds[newData.root.sectionIds.length - 1];
          positionIds.splice(currentIndex, 1);
          newData.sections[lastSectionId] = {
            ...newData.sections[lastSectionId],
            positionIds: [...newData.sections[lastSectionId].positionIds, posId],
          };
        }
        break;
    }

    // Update the original array
    if (sectionId) {
      newData.sections[sectionId] = { ...newData.sections[sectionId], positionIds };
    } else {
      newData.root.positionIds = positionIds;
    }

    updateEstimateData(newData);
    showNotificationMessage('Pozycja przeniesiona', 'success');
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

  const toggleExpandSubsection = (subsectionId: string) => {
    setEditorState(prev => {
      const newExpanded = new Set(prev.expandedSubsections);
      if (newExpanded.has(subsectionId)) {
        newExpanded.delete(subsectionId);
      } else {
        newExpanded.add(subsectionId);
      }
      return { ...prev, expandedSubsections: newExpanded };
    });
  };

  // Render section/subsection tree recursively
  const renderSectionTree = (sectionId: string, depth: number = 0): React.ReactNode => {
    const section = estimateData.sections[sectionId];
    if (!section) return null;

    const isSectionExpanded = editorState.expandedSections.has(sectionId);
    const hasSubsections = section.subsectionIds && section.subsectionIds.length > 0;
    const hasPositions = section.positionIds && section.positionIds.length > 0;
    const paddingLeft = 8 + depth * 16; // 8px base + 16px per depth level

    return (
      <div
        key={sectionId}
        draggable={depth === 0}
        onDragStart={(e) => {
          if (depth === 0) {
            setDraggedSectionId(sectionId);
            e.dataTransfer.effectAllowed = 'move';
          }
        }}
        onDragEnd={() => setDraggedSectionId(null)}
        onDragOver={(e) => {
          if (depth === 0) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          if (depth === 0 && draggedSectionId && draggedSectionId !== sectionId) {
            e.preventDefault();
            handleSectionReorder(draggedSectionId, sectionId);
            setDraggedSectionId(null);
          }
        }}
        className={`${draggedSectionId === sectionId ? 'opacity-50' : ''}`}
      >
        <div
          className={`flex items-center gap-1 pr-2 py-1.5 text-sm rounded hover:bg-gray-50 ${
            editorState.selectedItemId === sectionId ? 'bg-blue-50 text-blue-700' : ''
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {depth === 0 && (
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
          )}
          <button
            onClick={() => {
              toggleExpandSection(sectionId);
              selectItem(sectionId, 'section');
            }}
            className="flex items-center gap-1 flex-1 text-left"
          >
            {(hasSubsections || hasPositions) ? (
              isSectionExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="w-4" />
            )}
            <span className="truncate">{section.ordinalNumber}. {section.name}</span>
          </button>
        </div>

        {isSectionExpanded && (
          <>
            {/* Subsections */}
            {section.subsectionIds?.map(subsectionId => renderSectionTree(subsectionId, depth + 1))}

            {/* Positions in this section */}
            {section.positionIds.map((posId, posIndex) => {
              const position = estimateData.positions[posId];
              if (!position) return null;
              return (
                <button
                  key={posId}
                  onClick={() => selectItem(posId, 'position')}
                  className={`w-full flex items-center gap-1 pr-2 py-1 text-xs text-left rounded hover:bg-gray-50 ${
                    editorState.selectedItemId === posId ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                  }`}
                  style={{ paddingLeft: `${paddingLeft + 24}px` }}
                >
                  <FileText className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">d.{section.ordinalNumber}.{posIndex + 1} {position.base || position.name}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  };

  // Select item
  const selectItem = (itemId: string, itemType: 'section' | 'position' | 'resource') => {
    setEditorState(prev => ({
      ...prev,
      selectedItemId: itemId,
      selectedItemType: itemType,
    }));
  };

  // Toggle catalog item expand
  const toggleCatalogItem = (itemId: string) => {
    setExpandedCatalogItems(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      return newExpanded;
    });
  };

  // Filter catalog items by search
  const filterCatalogItems = (items: CatalogItem[], search: string): CatalogItem[] => {
    if (!search.trim()) return items;
    const lowerSearch = search.toLowerCase();

    return items.reduce((acc: CatalogItem[], item) => {
      const matchesCode = item.code.toLowerCase().includes(lowerSearch);
      const matchesName = item.name.toLowerCase().includes(lowerSearch);

      if (item.children) {
        const filteredChildren = filterCatalogItems(item.children, search);
        if (filteredChildren.length > 0 || matchesCode || matchesName) {
          acc.push({ ...item, children: filteredChildren.length > 0 ? filteredChildren : item.children });
        }
      } else if (matchesCode || matchesName) {
        acc.push(item);
      }

      return acc;
    }, []);
  };

  // Render catalog tree
  const renderCatalogTree = (items: CatalogItem[], level: number): React.ReactNode => {
    const filteredItems = level === 0 ? filterCatalogItems(items, catalogSearch) : items;

    return filteredItems.map(item => {
      const isExpanded = expandedCatalogItems.has(item.id);
      const hasChildren = item.children && item.children.length > 0;
      const isSelected = selectedCatalogItem?.id === item.id;
      const isPosition = item.type === 'position';

      return (
        <div key={item.id}>
          <div
            className={`flex items-start gap-1 py-1.5 px-2 rounded cursor-pointer text-xs ${
              isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
            } ${isPosition ? 'border border-gray-200' : ''}`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => {
              if (hasChildren) {
                toggleCatalogItem(item.id);
              }
              if (isPosition) {
                setSelectedCatalogItem(item);
              }
            }}
          >
            {hasChildren ? (
              <button className="p-0.5 -ml-1 hover:bg-gray-200 rounded flex-shrink-0">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            ) : isPosition ? (
              <FileText className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
            ) : (
              <div className="w-4" />
            )}
            <div className="flex-1 min-w-0">
              <div className={`font-mono ${isPosition ? 'text-blue-600' : 'text-gray-600'}`}>
                {item.code}
              </div>
              <div className={`text-gray-500 ${level > 1 ? 'truncate' : ''}`} title={item.name}>
                {item.name}
              </div>
            </div>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderCatalogTree(item.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  // Insert position from catalog
  const insertFromCatalog = (catalogItem: CatalogItem) => {
    if (!catalogItem || catalogItem.type !== 'position') return;

    const unit = UNITS_REFERENCE.find(u => u.unit === catalogItem.unit) || UNITS_REFERENCE[0];
    const newPosition = createNewPosition(
      catalogItem.code,
      catalogItem.name,
      unit.unit,
      unit.index
    );

    // Add measurement
    const quantity = parseFloat(catalogQuantity) || 0;
    if (quantity > 0) {
      newPosition.measurements = addMeasurementEntry(
        newPosition.measurements,
        catalogQuantity,
        'Przedmiar'
      );
    }

    // Set multiplication factor
    newPosition.multiplicationFactor = parseFloat(catalogMultiplier) || 1;

    // Add resources from catalog norms
    if (catalogItem.norms) {
      for (const norm of catalogItem.norms) {
        const resourceUnit = UNITS_REFERENCE.find(u => u.unit === norm.unit) || UNITS_REFERENCE[0];
        const resource = createNewResource(
          norm.type,
          norm.type === 'labor' ? 'Robotnicy' : norm.type === 'equipment' ? 'Sprzęt' : 'Materiał',
          norm.value,
          0, // Price will be set later
          resourceUnit.unit,
          resourceUnit.index
        );
        newPosition.resources.push(resource);
      }
    }

    // Add to estimate
    const newData = { ...estimateData };
    newData.positions = { ...newData.positions, [newPosition.id]: newPosition };
    newData.root = {
      ...newData.root,
      positionIds: [...newData.root.positionIds, newPosition.id],
    };

    updateEstimateData(newData);
    setLeftPanelMode('overview');

    setEditorState(prev => ({
      ...prev,
      selectedItemId: newPosition.id,
      selectedItemType: 'position',
      expandedPositions: new Set([...prev.expandedPositions, newPosition.id]),
    }));

    showNotificationMessage(`Dodano pozycję: ${catalogItem.code}`, 'success');
  };

  // Add uncatalogued position (pozycja nieskatalogowana)
  const handleAddUncataloguedPosition = () => {
    setNewPositionForm({ base: '', name: '', unitIndex: '020', measurement: '' });
    setShowAddPositionModal(true);
  };

  // Check estimate for errors (Sprawdź kosztorys)
  const handleSprawdzKosztorys = () => {
    const newAlerts: typeof alerts = [];

    // Check all positions
    Object.values(estimateData.positions).forEach((position, index) => {
      // Check for empty name
      if (!position.name.trim()) {
        newAlerts.push({
          id: `${position.id}-name`,
          type: 'error',
          message: `Pozycja ${index + 1}: Brak nazwy`,
          positionId: position.id,
        });
      }

      // Check for zero quantity
      const posResult = calculationResult?.positions[position.id];
      if (!posResult?.quantity || posResult.quantity === 0) {
        newAlerts.push({
          id: `${position.id}-qty`,
          type: 'warning',
          message: `Pozycja ${index + 1}: Przedmiar równy 0`,
          positionId: position.id,
        });
      }

      // Check resources for zero prices
      position.resources.forEach((resource, resIndex) => {
        if (resource.unitPrice.value === 0) {
          newAlerts.push({
            id: `${resource.id}-price`,
            type: 'warning',
            message: `Pozycja ${index + 1}, nakład ${resIndex + 1}: Cena zerowa`,
            positionId: position.id,
          });
        }
      });

      // Check if position has no resources
      if (position.resources.length === 0) {
        newAlerts.push({
          id: `${position.id}-nores`,
          type: 'warning',
          message: `Pozycja ${index + 1}: Brak nakładów`,
          positionId: position.id,
        });
      }
    });

    setAlerts(newAlerts);
    setAlertsCount({ current: 0, total: newAlerts.length });

    if (newAlerts.length === 0) {
      showNotificationMessage('Kosztorys nie zawiera błędów', 'success');
    } else {
      showNotificationMessage(`Znaleziono ${newAlerts.length} alertów`, 'error');
    }
  };

  // Paste from clipboard
  const handlePaste = () => {
    if (!editorState.clipboard) return;

    const { id, type, action } = editorState.clipboard;

    if (type === 'position') {
      const sourcePosition = estimateData.positions[id];
      if (!sourcePosition) return;

      // Create a copy of the position
      const newPosition = {
        ...sourcePosition,
        id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: action === 'cut' ? sourcePosition.name : `${sourcePosition.name} (kopia)`,
        resources: sourcePosition.resources.map(r => ({
          ...r,
          id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
      };

      // Add to data
      const newData = { ...estimateData };
      newData.positions = { ...newData.positions, [newPosition.id]: newPosition };
      newData.root = {
        ...newData.root,
        positionIds: [...newData.root.positionIds, newPosition.id],
      };

      // If cut, remove original
      if (action === 'cut') {
        delete newData.positions[id];
        newData.root.positionIds = newData.root.positionIds.filter(pid => pid !== id);
        // Also check sections
        Object.keys(newData.sections).forEach(secId => {
          if (newData.sections[secId].positionIds.includes(id)) {
            newData.sections[secId] = {
              ...newData.sections[secId],
              positionIds: newData.sections[secId].positionIds.filter(pid => pid !== id),
            };
          }
        });
      }

      updateEstimateData(newData);
      setEditorState(prev => ({
        ...prev,
        clipboard: action === 'cut' ? null : prev.clipboard,
        selectedItemId: newPosition.id,
        selectedItemType: 'position',
      }));

      showNotificationMessage(action === 'cut' ? 'Pozycja przeniesiona' : 'Pozycja skopiowana', 'success');
    } else if (type === 'section') {
      const sourceSection = estimateData.sections[id];
      if (!sourceSection) return;

      const newSection = {
        ...sourceSection,
        id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: action === 'cut' ? sourceSection.name : `${sourceSection.name} (kopia)`,
        positionIds: [],
      };

      // Copy positions too
      const newPositions: Record<string, KosztorysPosition> = {};
      sourceSection.positionIds.forEach(posId => {
        const pos = estimateData.positions[posId];
        if (pos) {
          const newPosId = `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          newPositions[newPosId] = {
            ...pos,
            id: newPosId,
            resources: pos.resources.map(r => ({
              ...r,
              id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            })),
          };
          newSection.positionIds.push(newPosId);
        }
      });

      const newData = { ...estimateData };
      newData.sections = { ...newData.sections, [newSection.id]: newSection };
      newData.positions = { ...newData.positions, ...newPositions };
      newData.root = {
        ...newData.root,
        sectionIds: [...newData.root.sectionIds, newSection.id],
      };

      if (action === 'cut') {
        delete newData.sections[id];
        sourceSection.positionIds.forEach(posId => {
          delete newData.positions[posId];
        });
        newData.root.sectionIds = newData.root.sectionIds.filter(sid => sid !== id);
      }

      updateEstimateData(newData);
      setEditorState(prev => ({
        ...prev,
        clipboard: action === 'cut' ? null : prev.clipboard,
        selectedItemId: newSection.id,
        selectedItemType: 'section',
      }));

      showNotificationMessage(action === 'cut' ? 'Dział przeniesiony' : 'Dział skopiowany', 'success');
    }
  };

  // Navigate to alert
  const handleNavigateToAlert = (alertIndex: number) => {
    if (alertIndex >= 0 && alertIndex < alerts.length) {
      const alert = alerts[alertIndex];
      setAlertsCount(prev => ({ ...prev, current: alertIndex }));
      if (alert.positionId) {
        selectItem(alert.positionId, 'position');
        setEditorState(prev => ({
          ...prev,
          expandedPositions: new Set([...prev.expandedPositions, alert.positionId!]),
        }));
      }
    }
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
          className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
          onClick={() => selectItem(position.id, 'position')}
        >
          <td className="px-2 py-2 text-sm w-16">
            {/* Lp. - Position number with circled badge - matching eKosztorysowanie */}
            <div className="flex flex-col items-center">
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpandPosition(position.id); }}
                className="w-6 h-6 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs font-bold text-blue-600 hover:bg-blue-50"
              >
                {positionNumber}
              </button>
              <div className="text-xs text-gray-500 mt-0.5">d.{sectionId ? '1.' : ''}{positionNumber}</div>
            </div>
          </td>
          <td className="px-2 py-2 text-sm">
            {/* Podstawa column - base code + Cena zakładowa */}
            {position.base && (
              <div className="text-xs text-gray-800 font-mono">{position.base}</div>
            )}
            <button className="mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 border border-gray-200">
              Cena zakładowa
            </button>
          </td>
          <td className="px-2 py-2 text-sm">
            <div className="font-medium text-gray-900">{position.name}</div>
            {position.measurements.rootIds.length > 0 && (
              <div className="text-xs text-gray-500 mt-0.5">
                Przedmiar = {formatNumber(quantity)} {position.unit.label}
              </div>
            )}
          </td>
          <td className="px-2 py-2 text-sm text-center text-gray-600">{position.unit.label}</td>
          <td className="px-2 py-2 text-sm text-right text-gray-600">
            {/* Nakład j. - norm quantity per unit */}
            {formatNumber(quantity, 2)}
          </td>
          <td className="px-2 py-2 text-sm text-right text-gray-600">
            {/* Ceny jedn. - unit price */}
            {result?.unitCost ? formatNumber(result.unitCost, 2) : '-'}
          </td>
          <td className="px-2 py-2 text-sm text-right text-gray-600">
            {/* Koszt jedn. - cost per unit */}
            {result?.unitCost ? formatNumber(result.unitCost, 2) : '-'}
          </td>
          <td className="px-2 py-2 text-sm text-right text-gray-600">
            {/* Ilość - quantity */}
            {formatNumber(quantity, 1)}
          </td>
          <td className="px-2 py-2 text-sm text-right font-medium text-gray-900">
            {/* Wartość - total value */}
            {result?.totalWithOverheads ? formatNumber(result.totalWithOverheads, 2) : '-'}
          </td>
        </tr>

        {/* Resources rows - with R/M/S/O indicators matching eKosztorysowanie */}
        {isExpanded && position.resources.map((resource, index) => {
          const config = RESOURCE_TYPE_CONFIG[resource.type] || RESOURCE_TYPE_CONFIG.material;
          const resResult = result?.resources.find(r => r.id === resource.id);
          const isResourceSelected = editorState.selectedItemId === resource.id;

          return (
            <tr
              key={resource.id}
              className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isResourceSelected ? 'bg-blue-50' : ''}`}
              onClick={() => selectItem(resource.id, 'resource')}
            >
              <td className="px-2 py-1.5">
                {/* Resource index number */}
                <span className="text-xs text-gray-400">{index + 1}</span>
              </td>
              <td className="px-2 py-1.5 text-sm">
                {/* R/M/S/O badge - prominent display */}
                <div className="flex items-center gap-1">
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${config.bgColor} ${config.color}`}>
                    {config.shortLabel}
                  </span>
                  <span className="text-gray-500 font-mono text-xs">{resource.originIndex.index || ''}</span>
                </div>
              </td>
              <td className="px-2 py-1.5 text-sm">
                <div className="pl-2">
                  <span className="text-gray-800">{resource.name}</span>
                </div>
                {/* Formula display like eKosztorysowanie: 1.1 · 1.1 · 1 · 1.35 */}
                <div className="text-xs text-gray-400 pl-2 mt-0.5 font-mono">
                  {resource.factor !== 1 ? `${formatNumber(resource.factor, 1)} · ` : ''}
                  {formatNumber(resource.norm.value, 1)} ·
                  {position.multiplicationFactor !== 1 ? ` ${formatNumber(position.multiplicationFactor, 1)} · ` : ' '}
                  1 · {formatNumber(quantity, 2)}
                </div>
              </td>
              <td className="px-2 py-1.5 text-sm text-center text-gray-500">{resource.unit.label}</td>
              <td className="px-2 py-1.5 text-sm text-right text-gray-500 font-mono">
                {formatNumber(resResult?.calculatedQuantity || resource.norm.value, 7)}
              </td>
              <td className="px-2 py-1.5 text-sm text-right text-gray-500">
                {formatNumber(resource.unitPrice.value, 2)}
              </td>
              <td className="px-2 py-1.5 text-sm text-right text-gray-500">
                {/* Koszt jedn. */}
                {formatNumber((resResult?.calculatedQuantity || resource.norm.value) * resource.unitPrice.value / (quantity || 1), 2)}
              </td>
              <td className="px-2 py-1.5 text-sm text-right text-gray-500">
                {/* Ilość */}
              </td>
              <td className="px-2 py-1.5 text-sm text-right text-gray-500">
                {/* Wartość */}
                {formatNumber(resResult?.totalCost || 0, 2)}
              </td>
            </tr>
          );
        })}

        {/* RAZEM row for measurement */}
        {isExpanded && position.measurements.rootIds.length > 0 && (
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <td colSpan={4}></td>
            <td className="px-2 py-1.5 text-xs text-right text-gray-500 font-medium">
              RAZEM: {formatNumber(quantity, 1)}
            </td>
            <td colSpan={4}></td>
          </tr>
        )}

        {/* Position summary row - Razem koszty bezpośrednie */}
        {isExpanded && result && (
          <>
            <tr className="bg-gray-50 border-b border-gray-100">
              <td colSpan={3}></td>
              <td colSpan={3} className="px-2 py-1 text-xs text-gray-600">Razem koszty bezpośrednie</td>
              <td className="px-2 py-1 text-xs text-right text-gray-600">{formatNumber(result.directCostsTotal, 4)}</td>
              <td className="px-2 py-1 text-xs text-right text-gray-600">{formatNumber(quantity, 2)}</td>
              <td className="px-2 py-1 text-xs text-right font-medium text-gray-800">{formatNumber(result.directCostsTotal, 2)}</td>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-100">
              <td colSpan={3}></td>
              <td colSpan={3} className="px-2 py-1 text-xs text-gray-600">Razem z narzutami</td>
              <td className="px-2 py-1 text-xs text-right text-gray-600">{formatNumber(result.totalWithOverheads, 4)}</td>
              <td className="px-2 py-1 text-xs text-right text-gray-600">{formatNumber(quantity, 2)}</td>
              <td className="px-2 py-1 text-xs text-right font-medium text-gray-800">{formatNumber(result.totalWithOverheads, 2)}</td>
            </tr>
            <tr className="bg-gray-100 border-b border-gray-200">
              <td colSpan={3}></td>
              <td colSpan={3} className="px-2 py-1 text-xs text-gray-600 font-medium">Cena jednostkowa</td>
              <td className="px-2 py-1 text-xs text-right font-medium text-gray-800">{formatNumber(result.unitCost, 2)}</td>
              <td colSpan={2}></td>
            </tr>
          </>
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
          className={`bg-gray-100 border-b border-gray-300 cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
          onClick={() => selectItem(section.id, 'section')}
        >
          <td className="px-2 py-2 text-sm">
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpandSection(section.id); }}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </td>
          <td className="px-2 py-2 text-sm font-bold text-gray-800">{section.ordinalNumber}</td>
          <td colSpan={7} className="px-2 py-2 text-sm font-bold text-gray-900">{section.name}</td>
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
    <div className="h-full flex flex-col bg-white">
      {/* Top Action Bar - new design */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Powrót button */}
          <button
            onClick={() => {
              if (editorState.isDirty) {
                setShowExitConfirmModal(true);
              } else {
                navigate('/construction/estimates');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Powrót
          </button>

          {/* Zapisz button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Zapisz
          </button>

          {/* Widok dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowOpcjeWidokuDropdown(!showOpcjeWidokuDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
            >
              <Eye className="w-4 h-4" />
              Widok
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Weryfikuj button */}
          <button
            onClick={handleSprawdzKosztorys}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
          >
            <Sparkles className="w-4 h-4" />
            Weryfikuj
          </button>
        </div>

        {/* Right side - unsaved changes indicator */}
        <div className="flex items-center gap-2">
          {editorState.isDirty && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Niezapisane zmiany
            </span>
          )}
        </div>
      </div>

      {/* Toolbar Row 1 - always visible */}
      <div className="bg-white border-b border-gray-200 px-2 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* Kosztorys button - switches to Kosztorys view */}
          <button
            onClick={() => { setViewMode('kosztorys'); setActiveNavItem('kosztorysy'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100 rounded"
          >
            <Menu className="w-4 h-4" />
            Kosztorys
          </button>

          {/* Drukuj button */}
          <button
            onClick={() => setShowPrintDialog(true)}
            className="px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Drukuj
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* + Dział dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDzialDropdown(!showDzialDropdown)}
              className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              <Plus className="w-4 h-4" />
              Dział
              <ChevronDown className="w-3 h-3" />
            </button>
            {showDzialDropdown && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button onClick={() => { handleAddSection(); setShowDzialDropdown(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  + Dział
                </button>
                <button onClick={() => { handleAddSection(); setShowDzialDropdown(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  + Poddział
                </button>
              </div>
            )}
          </div>

          {/* KNR Pozycja dropdown */}
          <div className="relative">
            <div className="flex">
              <button
                onClick={() => setLeftPanelMode(leftPanelMode === 'catalog' ? 'overview' : 'catalog')}
                className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-l ${
                  leftPanelMode === 'catalog' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <span className="text-[10px] font-bold px-1 py-0.5 bg-blue-500 text-white rounded">KNR</span>
                Pozycja
              </button>
              <button
                onClick={() => setShowKNRDropdown(!showKNRDropdown)}
                className={`px-1 py-1.5 text-sm rounded-r border-l ${
                  leftPanelMode === 'catalog' ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200'
                }`}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            {showKNRDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => { setLeftPanelMode('catalog'); setShowKNRDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-[10px] font-bold px-1 py-0.5 bg-blue-500 text-white rounded">KNR</span>
                  Pozycja
                </button>
                <button
                  onClick={() => { handleAddUncataloguedPosition(); setShowKNRDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Wstaw pozycję nieskatalogowaną
                </button>
              </div>
            )}
          </div>

          {/* Nakład dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNakladDropdown(!showNakladDropdown)}
              className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded ${
                editorState.selectedItemType === 'position' ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <Clipboard className="w-4 h-4" />
              Nakład
              <ChevronDown className="w-3 h-3" />
            </button>
            {showNakladDropdown && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => {
                    if (editorState.selectedItemId && editorState.selectedItemType === 'position') {
                      handleAddResource(editorState.selectedItemId, 'labor');
                    }
                    setShowNakladDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Robocizna
                </button>
                <button
                  onClick={() => {
                    if (editorState.selectedItemId && editorState.selectedItemType === 'position') {
                      handleAddResource(editorState.selectedItemId, 'material');
                    }
                    setShowNakladDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Materiały
                </button>
                <button
                  onClick={() => {
                    if (editorState.selectedItemId && editorState.selectedItemType === 'position') {
                      handleAddResource(editorState.selectedItemId, 'equipment');
                    }
                    setShowNakladDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Sprzęt
                </button>
                <button
                  onClick={() => {
                    setShowNakladDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Odpady
                </button>
              </div>
            )}
          </div>

          {/* Uzupełnij dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUzupelnijDropdown(!showUzupelnijDropdown)}
              className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded ${
                Object.keys(estimateData.positions).length > 0 ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'
              }`}
              disabled={Object.keys(estimateData.positions).length === 0}
            >
              Uzupełnij
              <ChevronDown className="w-3 h-3" />
            </button>
            {showUzupelnijDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => { setShowUzupelnijDropdown(false); showNotificationMessage('Uzupełniono nakłady z bazy', 'success'); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Uzupełnij z bazy normatywnej
                </button>
                <button
                  onClick={() => { setShowUzupelnijDropdown(false); showNotificationMessage('Uzupełniono nakłady z KNR', 'success'); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Uzupełnij z katalogów KNR
                </button>
                <div className="border-t border-gray-200">
                  <button
                    onClick={() => { setShowUzupelnijDropdown(false); showNotificationMessage('Uzupełniono brakujące nakłady', 'success'); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Uzupełnij tylko brakujące
                  </button>
                  <button
                    onClick={() => { setShowUzupelnijDropdown(false); showNotificationMessage('Zastąpiono wszystkie nakłady', 'success'); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Zastąp wszystkie nakłady
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Ceny */}
          <button onClick={() => setShowCenyDialog(true)} className="px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            Ceny
          </button>

          {/* Komentarze dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowKomentarzeDropdown(!showKomentarzeDropdown)}
              className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded ${
                leftPanelMode === 'comments' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Komentarze
              <ChevronDown className="w-3 h-3" />
            </button>
            {showKomentarzeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => { setLeftPanelMode('comments'); setShowKomentarzeDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Wszystkie komentarze
                </button>
                <button
                  onClick={() => { setLeftPanelMode('comments'); setShowKomentarzeDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Wstaw komentarz do...
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side of Row 1 - Settings */}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettingsModal(true)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Ustawienia">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar Row 2 - shown only when item is selected */}
      {editorState.selectedItemId && (
        <div className="bg-gray-50 border-b border-gray-200 px-2 py-1 flex items-center">
          <div className="flex items-center gap-0.5">
            {/* Usuń dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUsunDropdown(!showUsunDropdown)}
                className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                <Trash2 className="w-4 h-4" />
                Usuń
                <ChevronDown className="w-3 h-3" />
              </button>
              {showUsunDropdown && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => {
                      if (editorState.selectedItemId && editorState.selectedItemType) {
                        if (confirm('Czy na pewno chcesz usunąć ten element?')) {
                          handleDeleteItem(editorState.selectedItemId, editorState.selectedItemType);
                        }
                      }
                      setShowUsunDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                  >
                    {editorState.selectedItemType === 'section' ? 'Usuń dział' :
                     editorState.selectedItemType === 'position' ? 'Usuń pozycję' :
                     editorState.selectedItemType === 'resource' ? 'Usuń nakład' : 'Usuń zaznaczony element'}
                  </button>
                  {editorState.selectedItemType === 'position' && (
                    <button
                      onClick={() => {
                        if (editorState.selectedItemId && editorState.selectedItemType === 'position') {
                          if (confirm('Czy na pewno chcesz usunąć pozycję wraz z nakładami?')) {
                            handleDeleteItem(editorState.selectedItemId, 'position');
                          }
                        }
                        setShowUsunDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Usuń pozycję z nakładami
                    </button>
                  )}
                  {editorState.selectedItemType === 'section' && (
                    <button
                      onClick={() => {
                        setShowUsunDropdown(false);
                        showNotificationMessage('Funkcja w przygotowaniu', 'error');
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Usuń dział (zachowaj pozycje)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Przesuń dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowPrzesunDropdown(!showPrzesunDropdown)}
                className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                <MoveUp className="w-4 h-4" />
                Przesuń
                <ChevronDown className="w-3 h-3" />
              </button>
              {showPrzesunDropdown && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => { handleMovePosition('up'); setShowPrzesunDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <MoveUp className="w-4 h-4 text-gray-400" />
                    Przesuń pozycję w górę
                  </button>
                  <button
                    onClick={() => { handleMovePosition('down'); setShowPrzesunDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <MoveDown className="w-4 h-4 text-gray-400" />
                    Przesuń pozycję w dół
                  </button>
                  <button
                    onClick={() => { handleMovePosition('first'); setShowPrzesunDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ArrowUpRight className="w-4 h-4 text-gray-400" />
                    Przesuń pozycję do pierwszego działu
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* Kopiuj */}
            <button
              onClick={() => {
                if (editorState.selectedItemId && editorState.selectedItemType) {
                  setEditorState(prev => ({
                    ...prev,
                    clipboard: { id: editorState.selectedItemId!, type: editorState.selectedItemType!, action: 'copy' }
                  }));
                  showNotificationMessage('Skopiowano do schowka', 'success');
                }
              }}
              className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              <Clipboard className="w-4 h-4" />
              Kopiuj
            </button>

            {/* Wytnij */}
            <button
              onClick={() => {
                if (editorState.selectedItemId && editorState.selectedItemType) {
                  setEditorState(prev => ({
                    ...prev,
                    clipboard: { id: editorState.selectedItemId!, type: editorState.selectedItemType!, action: 'cut' }
                  }));
                  showNotificationMessage('Wycięto do schowka', 'success');
                }
              }}
              className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              <Scissors className="w-4 h-4" />
              Wytnij
            </button>

            {/* Wklej */}
            <button
              onClick={handlePaste}
              className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded ${
                editorState.clipboard ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-400 cursor-not-allowed'
              }`}
              disabled={!editorState.clipboard}
            >
              <Clipboard className="w-4 h-4" />
              {editorState.clipboard?.action === 'cut' ? 'Wklej (wycięta)' :
               editorState.clipboard?.action === 'copy' ? 'Wklej (kopia)' : 'Wklej'}
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close all dropdowns */}
      {(showDzialDropdown || showNakladDropdown || showKomentarzeDropdown || showUsunDropdown || showPrzesunDropdown || showUzupelnijDropdown || showKNRDropdown || showOpcjeWidokuDropdown) && (
        <div className="fixed inset-0 z-40" onClick={() => {
          setShowDzialDropdown(false);
          setShowNakladDropdown(false);
          setShowKomentarzeDropdown(false);
          setShowUsunDropdown(false);
          setShowPrzesunDropdown(false);
          setShowUzupelnijDropdown(false);
          setShowKNRDropdown(false);
          setShowOpcjeWidokuDropdown(false);
        }} />
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0 bg-gray-100 overflow-hidden">
        {/* Left panel - Navigation and Properties */}
        <div className="shrink-0 bg-white w-[356px] h-full relative border-r border-gray-400 flex flex-col">
          {/* Tab headers - Przegląd / Właściwości */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setLeftPanelMode('overview')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                leftPanelMode === 'overview' || leftPanelMode === 'catalog' || leftPanelMode === 'comments' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Przegląd
            </button>
            <button
              onClick={() => setLeftPanelMode('properties')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                leftPanelMode === 'properties' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Właściwości
            </button>
          </div>

          {/* Panel content based on mode */}

          {/* Panel content based on mode */}
          <div className="flex-1 overflow-y-auto">
            {leftPanelMode === 'overview' && (
              <div className="flex flex-col h-full">
                {/* Search in estimate */}
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Szukaj w kosztorysie"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Estimate structure tree */}
                <div className="flex-1 overflow-y-auto p-2">
                  {/* Root node "▼ Kosztorys" per documentation 4.2 */}
                  <button
                    onClick={() => setEditorState(prev => ({ ...prev, treeRootExpanded: !prev.treeRootExpanded }))}
                    className="w-full flex items-center gap-1 px-2 py-1.5 text-sm text-left rounded hover:bg-gray-50 font-medium"
                  >
                    {editorState.treeRootExpanded !== false ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span>Kosztorys</span>
                  </button>

                  {/* Sections tree - only shown when root is expanded */}
                  {editorState.treeRootExpanded !== false && estimateData.root.sectionIds.map(sectionId =>
                    renderSectionTree(sectionId, 0)
                  )}

                  {/* Root positions - only shown when root is expanded */}
                  {editorState.treeRootExpanded !== false && estimateData.root.positionIds.map((posId, index) => {
                    const position = estimateData.positions[posId];
                    if (!position) return null;
                    return (
                      <button
                        key={posId}
                        onClick={() => selectItem(posId, 'position')}
                        className={`w-full flex items-center gap-1 pl-6 pr-2 py-1.5 text-sm text-left rounded hover:bg-gray-50 ${
                          editorState.selectedItemId === posId ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{index + 1}. {position.name}</span>
                      </button>
                    );
                  })}

                  {/* Empty state */}
                  {estimateData.root.sectionIds.length === 0 && estimateData.root.positionIds.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Kosztorys jest pusty</p>
                  )}
                </div>

              </div>
            )}

            {leftPanelMode === 'properties' && selectedItem && (
              <div className="p-4">
                {editorState.selectedItemType === 'section' && (
                  <div className="space-y-3">
                    {/* Nazwa działu - matching eKosztorysowanie layout */}
                    <div>
                      <label className="block text-sm text-gray-800 mb-1">Nazwa działu</label>
                      <input
                        type="text"
                        value={(selectedItem as KosztorysSection).name}
                        onChange={e => handleUpdateSelectedItem({ name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    {/* Opis działu - no expand button per documentation 4.3.1 */}
                    <div>
                      <label className="text-sm text-gray-800 mb-1 block">Opis działu</label>
                      <textarea
                        value={(selectedItem as KosztorysSection).description}
                        onChange={e => handleUpdateSelectedItem({ description: e.target.value })}
                        placeholder="Opis działu"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                        rows={2}
                      />
                    </div>

                    {/* Współczynniki norm - expandable section matching screenshot */}
                    <div className="border-t border-gray-200 pt-3">
                      <button className="w-full flex items-center justify-between text-sm text-gray-800 mb-3">
                        <span>Współczynniki norm</span>
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      </button>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Robocizna</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysSection).factors.labor.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysSection).factors, labor: parseFloat(e.target.value.replace(',', '.')) || 1 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Materiały</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysSection).factors.material.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysSection).factors, material: parseFloat(e.target.value.replace(',', '.')) || 1 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Sprzęt</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysSection).factors.equipment.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysSection).factors, equipment: parseFloat(e.target.value.replace(',', '.')) || 1 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Odpady</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysSection).factors.waste.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysSection).factors, waste: parseFloat(e.target.value.replace(',', '.')) || 0 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editorState.selectedItemType === 'position' && (
                  <div className="space-y-3">
                    {/* Podstawa - with eye icon matching eKosztorysowanie */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm text-gray-800">Podstawa</label>
                        <button className="p-0.5 hover:bg-gray-100 rounded">
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={(selectedItem as KosztorysPosition).base}
                        onChange={e => handleUpdateSelectedItem({ base: e.target.value, originBase: e.target.value })}
                        placeholder=""
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    {/* Opis - textarea */}
                    <div>
                      <label className="text-sm text-gray-800 mb-1 block">Opis</label>
                      <textarea
                        value={(selectedItem as KosztorysPosition).name}
                        onChange={e => handleUpdateSelectedItem({ name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Przedmiar - expandable section matching screenshot */}
                    <div className="border-t border-gray-200 pt-3">
                      <button className="w-full flex items-center justify-between text-sm text-gray-800 mb-2">
                        <span>Przedmiar</span>
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedPositionResult?.quantity?.toString().replace('.', ',') || '0'}
                          onChange={e => {
                            const pos = selectedItem as KosztorysPosition;
                            const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                            // Update measurement
                            let measurements = pos.measurements;
                            if (measurements.rootIds.length === 0) {
                              measurements = addMeasurementEntry(measurements, String(val), 'Ilość');
                            } else {
                              measurements = updateMeasurementEntry(measurements, measurements.rootIds[0], String(val));
                            }
                            handleUpdateSelectedItem({ measurements });
                          }}
                          className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                        />
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <ArrowUpRight className="w-4 h-4 text-gray-400" />
                        </button>
                        <select
                          value={(selectedItem as KosztorysPosition).unit.unitIndex}
                          onChange={e => {
                            const unit = UNITS_REFERENCE.find(u => u.index === e.target.value);
                            if (unit) handleUpdateSelectedItem({ unit: { label: unit.unit, unitIndex: unit.index } });
                          }}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          {UNITS_REFERENCE.map(u => (
                            <option key={u.index} value={u.index}>{u.unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Krotność */}
                    <div>
                      <label className="text-sm text-gray-800 mb-1 block">Krotność</label>
                      <input
                        type="text"
                        value={(selectedItem as KosztorysPosition).multiplicationFactor.toString().replace('.', ',')}
                        onChange={e => handleUpdateSelectedItem({ multiplicationFactor: parseFloat(e.target.value.replace(',', '.')) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    {/* Współczynniki norm - expandable section */}
                    <div className="border-t border-gray-200 pt-3">
                      <button className="w-full flex items-center justify-between text-sm text-gray-800 mb-3">
                        <span>Współczynniki norm</span>
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      </button>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Robocizna</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysPosition).factors.labor.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysPosition).factors, labor: parseFloat(e.target.value.replace(',', '.')) || 1 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Materiały</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysPosition).factors.material.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysPosition).factors, material: parseFloat(e.target.value.replace(',', '.')) || 1 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Sprzęt</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysPosition).factors.equipment.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysPosition).factors, equipment: parseFloat(e.target.value.replace(',', '.')) || 1 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-gray-600">Odpady</label>
                          <input
                            type="text"
                            value={(selectedItem as KosztorysPosition).factors.waste.toString().replace('.', ',')}
                            onChange={e => handleUpdateSelectedItem({
                              factors: { ...(selectedItem as KosztorysPosition).factors, waste: parseFloat(e.target.value.replace(',', '.')) || 0 }
                            })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editorState.selectedItemType === 'resource' && (
                  <div className="space-y-4">
                    {(() => {
                      const resource = selectedItem as KosztorysResource;
                      const config = RESOURCE_TYPE_CONFIG[resource.type];
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${config.bgColor} ${config.color}`}>
                              {config.shortLabel}
                            </span>
                            <span className="text-sm font-medium text-gray-800">{config.label}</span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Indeks</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={resource.originIndex.index}
                                onChange={e => handleUpdateSelectedItem({ originIndex: { ...resource.originIndex, index: e.target.value } })}
                                placeholder="np. 999"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                              />
                              <select
                                value={resource.originIndex.type}
                                onChange={e => handleUpdateSelectedItem({ originIndex: { ...resource.originIndex, type: e.target.value } })}
                                className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="custom">Własny</option>
                                <option value="ETO">ETO</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa</label>
                            <input
                              type="text"
                              value={resource.name}
                              onChange={e => handleUpdateSelectedItem({ name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Norma</label>
                              <input
                                type="number"
                                step="0.0001"
                                value={resource.norm.value}
                                onChange={e => handleUpdateSelectedItem({ norm: { ...resource.norm, value: parseFloat(e.target.value) || 0 } })}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Jednostka</label>
                              <select
                                value={resource.unit.unitIndex}
                                onChange={e => {
                                  const unit = UNITS_REFERENCE.find(u => u.index === e.target.value);
                                  if (unit) handleUpdateSelectedItem({ unit: { label: unit.unit, unitIndex: unit.index } });
                                }}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                {UNITS_REFERENCE.map(u => (
                                  <option key={u.index} value={u.index}>{u.unit}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Cena</label>
                            <input
                              type="number"
                              step="0.01"
                              value={resource.unitPrice.value}
                              onChange={e => handleUpdateSelectedItem({ unitPrice: { ...resource.unitPrice, value: parseFloat(e.target.value) || 0 } })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
                              <ChevronDown className="w-4 h-4" />
                              Ilość inwestora
                            </h4>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={resource.investorTotal}
                                onChange={e => handleUpdateSelectedItem({ investorTotal: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                              <span className="text-sm text-gray-600">Całość inwestora</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setViewMode('naklady')}
                            className="w-full px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                          >
                            Przejdź do widoku nakłady
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}

                {!selectedItem && (
                  <p className="text-sm text-gray-500 text-center">
                    Wybierz element na kosztorysie, aby wyświetlić jego właściwości
                  </p>
                )}
              </div>
            )}

            {leftPanelMode === 'properties' && !selectedItem && (
              <div className="p-4">
                <p className="text-sm text-gray-500 text-center">
                  Wybierz element na kosztorysie, aby wyświetlić jego właściwości
                </p>
              </div>
            )}

            {leftPanelMode === 'export' && (
              <div className="p-3 flex flex-col h-full">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Eksportuj kosztorys</h3>

                {/* Zawartość section */}
                <p className="text-xs text-gray-500 mb-2">Zawartość</p>

                {/* Template dropdown - Szablon */}
                <p className="text-xs text-gray-500 mb-1">Szablon</p>
                <select
                  value={exportTemplate}
                  onChange={(e) => setExportTemplate(e.target.value as ExportTemplate)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3"
                >
                  <option value="niestandardowy">Niestandardowy</option>
                  <option value="kosztorys_inwestorski">Kosztorys inwestorski</option>
                  <option value="przedmiar_robot">Przedmiar robót</option>
                </select>

                {/* Search field */}
                <div className="relative mb-3">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Wyszukaj..."
                    value={exportSearch}
                    onChange={(e) => setExportSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Draggable export pages list - full drag-and-drop support */}
                <div className="flex-1 overflow-y-auto space-y-1">
                  {exportPages
                    .filter(p => !exportSearch || p.label.toLowerCase().includes(exportSearch.toLowerCase()))
                    .map((page, index) => (
                    <div
                      key={page.id}
                      className={`outline-none bg-white hover:bg-gray-50 flex items-center gap-2 rounded p-2 border focus-visible:border-gray-600 text-xs text-left cursor-grab transition-all ${
                        page.enabled ? 'border-gray-300' : 'border-gray-200 bg-gray-50 opacity-60'
                      } ${draggedExportPageId === page.id ? 'opacity-50 scale-95' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        setDraggedExportPageId(page.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDraggedExportPageId(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!draggedExportPageId || draggedExportPageId === page.id) return;

                        const newPages = [...exportPages];
                        const draggedIndex = newPages.findIndex(p => p.id === draggedExportPageId);
                        const dropIndex = newPages.findIndex(p => p.id === page.id);

                        if (draggedIndex !== -1 && dropIndex !== -1) {
                          const [draggedItem] = newPages.splice(draggedIndex, 1);
                          newPages.splice(dropIndex, 0, draggedItem);
                          setExportPages(newPages);
                        }
                        setDraggedExportPageId(null);
                      }}
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <input
                        type="checkbox"
                        checked={page.enabled}
                        onChange={() => {
                          const newPages = [...exportPages];
                          const actualIndex = exportPages.findIndex(p => p.id === page.id);
                          newPages[actualIndex] = { ...page, enabled: !page.enabled };
                          setExportPages(newPages);
                        }}
                        className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                      />
                      <span className="flex-1 text-xs text-gray-800 truncate">{page.label}</span>
                      {page.canEdit && (
                        <button
                          onClick={() => setLeftPanelMode('titlePageEditor')}
                          className="flex items-center justify-center rounded font-semibold whitespace-nowrap focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none transition-colors shrink-0 border border-transparent hover:bg-gray-900 hover:bg-opacity-20 rounded-full h-7 w-7"
                          title="Edytuj stronę tytułową"
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const newPages = exportPages.filter(p => p.id !== page.id);
                          setExportPages(newPages);
                        }}
                        className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
                        title="Usuń"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add page and print buttons - fixed at bottom */}
                <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                    <Plus className="w-4 h-4" />
                    Dodaj
                  </button>
                  <button
                    onClick={() => setShowPrintDialog(true)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Printer className="w-4 h-4" />
                    Drukuj
                  </button>
                </div>
              </div>
            )}

            {leftPanelMode === 'catalog' && (
              <div className="flex flex-col h-full">
                {/* Search */}
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Szukaj pozycji..."
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {catalogSearch && (
                      <button
                        onClick={() => setCatalogSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Catalog tree */}
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="text-xs text-gray-500 px-2 mb-2">
                    <div className="flex items-center justify-between">
                      <span>Podstawa</span>
                      <span>Opis</span>
                    </div>
                  </div>
                  {renderCatalogTree(KNR_CATALOG, 0)}
                </div>

                {/* Insert position form */}
                {selectedCatalogItem?.type === 'position' && (
                  <div className="p-3 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-600 mb-2 truncate" title={selectedCatalogItem.name}>
                      {selectedCatalogItem.code}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Ilość</label>
                        <input
                          type="number"
                          value={catalogQuantity}
                          onChange={e => setCatalogQuantity(e.target.value)}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div className="w-16">
                        <label className="text-xs text-gray-500">{selectedCatalogItem.unit}</label>
                        <div className="px-2 py-1.5 text-sm bg-gray-100 rounded text-center">
                          {selectedCatalogItem.unit}
                        </div>
                      </div>
                      <div className="w-20">
                        <label className="text-xs text-gray-500">Krotność</label>
                        <input
                          type="number"
                          value={catalogMultiplier}
                          onChange={e => setCatalogMultiplier(e.target.value)}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => insertFromCatalog(selectedCatalogItem)}
                      className="flex items-center justify-center font-semibold whitespace-nowrap focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none transition-colors bg-blue-600 hover:bg-blue-700 text-white aria-disabled:bg-opacity-30 text-sm gap-2.5 leading-tight px-2.5 py-1.5 [&_svg]:w-4 [&_svg]:h-4 rounded w-full mt-2"
                    >
                      Wstaw
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Comments panel - matching eKosztorysowanie exactly */}
            {leftPanelMode === 'comments' && (
              <div className="p-3 flex flex-col h-full">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Komentarze</h3>

                {/* Category filter dropdown - matching eKosztorysowanie */}
                <select
                  value={commentsFilter}
                  onChange={(e) => setCommentsFilter(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3"
                >
                  <option value="all">Wszystkie komentarze</option>
                  <option value="unresolved">Do weryfikacji</option>
                  <option value="mine">Do uzupełnienia</option>
                  <option value="closed">Zamknięte</option>
                </select>

                {/* Comments list */}
                <div className="flex-1 overflow-y-auto space-y-3">
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Brak komentarzy</p>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        {/* Status badge at top */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            comment.status === 'zatwierdzony' ? 'bg-green-100 text-green-700' :
                            comment.status === 'odrzucony' ? 'bg-red-100 text-red-700' :
                            comment.status === 'do_weryfikacji' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {comment.status === 'zatwierdzony' ? 'Zatwierdzony' :
                             comment.status === 'odrzucony' ? 'Odrzucony' :
                             comment.status === 'do_weryfikacji' ? 'Do weryfikacji' :
                             'Bez kategorii'}
                          </span>
                          <button className="p-1 hover:bg-gray-200 rounded">
                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>

                        {/* User and time */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                            {comment.userInitials}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">{comment.userName}</div>
                            <div className="text-xs text-gray-400">{comment.timestamp}</div>
                          </div>
                        </div>

                        {/* Section reference */}
                        {comment.sectionName && (
                          <div className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {comment.sectionName}
                          </div>
                        )}

                        {/* Comment text */}
                        <p className="text-sm text-gray-600">{comment.text}</p>

                        {/* Reply button */}
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <button className="text-xs text-blue-600 hover:underline">
                            Odpowiedz
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add comment button - matching eKosztorysowanie */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                    <Plus className="w-4 h-4" />
                    Wstaw komentarz do...
                  </button>
                </div>
              </div>
            )}

            {/* Title Page Editor - Strona tytułowa matching eKosztorysowanie */}
            {leftPanelMode === 'titlePageEditor' && (
              <div className="p-3 flex flex-col h-full overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Strona tytułowa</h3>

                {/* Tytuł section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, title: !prev.title }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Tytuł</span>
                    {titlePageSections.title ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.title && (
                    <div className="px-3 pb-3 space-y-2">
                      <input
                        type="text"
                        value={titlePageData.title}
                        onChange={e => setTitlePageData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Tytuł kosztorysu"
                        className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Wartość robót section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, workValue: !prev.workValue }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Wartość robót</span>
                    {titlePageSections.workValue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.workValue && (
                    <div className="px-3 pb-3 space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={titlePageData.hideManHourRate}
                          onChange={e => setTitlePageData(prev => ({ ...prev, hideManHourRate: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">Ukryj stawkę roboczogodziny</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={titlePageData.hideOverheads}
                          onChange={e => setTitlePageData(prev => ({ ...prev, hideOverheads: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">Ukryj narzuty</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={titlePageData.hideWorkValue}
                          onChange={e => setTitlePageData(prev => ({ ...prev, hideWorkValue: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">Ukryj wartość robót</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Podmiot opracowujący kosztorys section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, company: !prev.company }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Podmiot opracowujący kosztorys</span>
                    {titlePageSections.company ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.company && (
                    <div className="px-3 pb-3 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nazwa</label>
                        <input
                          type="text"
                          value={titlePageData.companyName}
                          onChange={e => setTitlePageData(prev => ({ ...prev, companyName: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Adres podmiotu</label>
                        <textarea
                          value={titlePageData.companyAddress}
                          onChange={e => setTitlePageData(prev => ({ ...prev, companyAddress: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Zamówienie section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, order: !prev.order }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Zamówienie</span>
                    {titlePageSections.order ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.order && (
                    <div className="px-3 pb-3 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nazwa</label>
                        <input
                          type="text"
                          value={titlePageData.orderName}
                          onChange={e => setTitlePageData(prev => ({ ...prev, orderName: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Adres obiektu budowlanego</label>
                        <textarea
                          value={titlePageData.orderAddress}
                          onChange={e => setTitlePageData(prev => ({ ...prev, orderAddress: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Zamawiający section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, client: !prev.client }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Zamawiający</span>
                    {titlePageSections.client ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.client && (
                    <div className="px-3 pb-3 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nazwa</label>
                        <input
                          type="text"
                          value={titlePageData.clientName}
                          onChange={e => setTitlePageData(prev => ({ ...prev, clientName: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Adres zamawiającego</label>
                        <textarea
                          value={titlePageData.clientAddress}
                          onChange={e => setTitlePageData(prev => ({ ...prev, clientAddress: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Wykonawca section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, contractor: !prev.contractor }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Wykonawca</span>
                    {titlePageSections.contractor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.contractor && (
                    <div className="px-3 pb-3 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nazwa</label>
                        <input
                          type="text"
                          value={titlePageData.contractorName}
                          onChange={e => setTitlePageData(prev => ({ ...prev, contractorName: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Adres</label>
                        <textarea
                          value={titlePageData.contractorAddress}
                          onChange={e => setTitlePageData(prev => ({ ...prev, contractorAddress: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full resize-none"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Branża</label>
                        <input
                          type="text"
                          value={titlePageData.industry}
                          onChange={e => setTitlePageData(prev => ({ ...prev, industry: e.target.value }))}
                          placeholder="np. Budowlana, Elektryczna"
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">NIP</label>
                        <input
                          type="text"
                          value={titlePageData.contractorNIP}
                          onChange={e => setTitlePageData(prev => ({ ...prev, contractorNIP: e.target.value }))}
                          placeholder="np. 123-456-78-90"
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Osoby odpowiedzialne section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, participants: !prev.participants }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Osoby odpowiedzialne</span>
                    {titlePageSections.participants ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.participants && (
                    <div className="px-3 pb-3 space-y-3">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-600">Opracował</p>
                        <input
                          type="text"
                          value={titlePageData.preparedBy}
                          onChange={e => setTitlePageData(prev => ({ ...prev, preparedBy: e.target.value }))}
                          placeholder="Imię i nazwisko"
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                        <input
                          type="text"
                          value={titlePageData.preparedByIndustry}
                          onChange={e => setTitlePageData(prev => ({ ...prev, preparedByIndustry: e.target.value }))}
                          placeholder="Branża"
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-600">Sprawdził</p>
                        <input
                          type="text"
                          value={titlePageData.checkedBy}
                          onChange={e => setTitlePageData(prev => ({ ...prev, checkedBy: e.target.value }))}
                          placeholder="Imię i nazwisko"
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                        <input
                          type="text"
                          value={titlePageData.checkedByIndustry}
                          onChange={e => setTitlePageData(prev => ({ ...prev, checkedByIndustry: e.target.value }))}
                          placeholder="Branża"
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Daty section */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, dates: !prev.dates }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Daty</span>
                    {titlePageSections.dates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.dates && (
                    <div className="px-3 pb-3 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Data opracowania</label>
                        <input
                          type="date"
                          value={titlePageData.preparedDate}
                          onChange={e => setTitlePageData(prev => ({ ...prev, preparedDate: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Data zatwierdzenia</label>
                        <input
                          type="date"
                          value={titlePageData.approvedDate}
                          onChange={e => setTitlePageData(prev => ({ ...prev, approvedDate: e.target.value }))}
                          className="flex items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Stawki section - matching eKosztorysowanie documentation */}
                <div className="border border-gray-200 rounded-lg mb-3">
                  <button
                    onClick={() => setTitlePageSections(prev => ({ ...prev, stawki: !prev.stawki }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <span>Stawki</span>
                    {titlePageSections.stawki ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {titlePageSections.stawki && (
                    <div className="px-3 pb-3 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Stawka robocizny</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={titlePageData.stawkaRobocizny}
                            onChange={e => setTitlePageData(prev => ({ ...prev, stawkaRobocizny: e.target.value }))}
                            placeholder="0,00"
                            className="flex-1 items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 text-right"
                          />
                          <span className="text-xs text-gray-500">PLN/r-g</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Koszty pośrednie (Kp)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={titlePageData.kosztyPosrednie}
                            onChange={e => setTitlePageData(prev => ({ ...prev, kosztyPosrednie: e.target.value }))}
                            placeholder="0"
                            className="flex-1 items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 text-right"
                          />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Zysk (Z)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={titlePageData.zysk}
                            onChange={e => setTitlePageData(prev => ({ ...prev, zysk: e.target.value }))}
                            placeholder="0"
                            className="flex-1 items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 text-right"
                          />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Koszty zakupu (Kz)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={titlePageData.kosztyZakupu}
                            onChange={e => setTitlePageData(prev => ({ ...prev, kosztyZakupu: e.target.value }))}
                            placeholder="0"
                            className="flex-1 items-center rounded-md px-1.5 py-1.5 text-xs border focus-visible:ring-1 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none disabled:bg-gray-50 border-gray-400 text-right"
                          />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Apply button */}
                <button
                  onClick={() => {
                    setEditorState(prev => ({ ...prev, isDirty: true }));
                    showNotificationMessage('Strona tytułowa zaktualizowana', 'success');
                  }}
                  className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Zastosuj zmiany
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          {/* Narzuty View */}
          {viewMode === 'narzuty' && (
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Narzuty kosztorysu</h3>

              {/* Narzuty table */}
              <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-300">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rodzaj narzutu</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Podstawa naliczania</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Stawka %</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Wartość</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {estimateData.root.overheads.map((overhead, index) => (
                    <tr key={overhead.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-800">
                        {overhead.type === 'indirect_costs' ? 'Koszty pośrednie (Kp)' :
                         overhead.type === 'profit' ? 'Zysk (Z)' :
                         overhead.type === 'purchase_costs' ? 'Koszty zakupu (Kz)' :
                         overhead.name}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {overhead.base === 'labor' ? 'Robocizna (R)' :
                         overhead.base === 'material' ? 'Materiały (M)' :
                         overhead.base === 'equipment' ? 'Sprzęt (S)' :
                         overhead.base === 'labor_and_equipment' ? 'R + S' :
                         overhead.base === 'direct_costs' ? 'Koszty bezpośrednie' :
                         'Koszty bezpośrednie'}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        <input
                          type="text"
                          value={overhead.value.toString().replace('.', ',')}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                            setEstimateData(prev => ({
                              ...prev,
                              root: {
                                ...prev.root,
                                overheads: prev.root.overheads.map((o, i) =>
                                  i === index ? { ...o, value: val } : o
                                )
                              }
                            }));
                          }}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded text-right"
                        />
                        <span className="ml-1">%</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-medium">
                        {formatCurrency(
                          overhead.type === 'indirect_costs' ? (calculationResult?.laborTotal || 0) * (overhead.value / 100) :
                          overhead.type === 'profit' ? ((calculationResult?.laborTotal || 0) + (calculationResult?.laborTotal || 0) * (estimateData.root.overheads[0]?.value || 0) / 100) * (overhead.value / 100) :
                          overhead.type === 'purchase_costs' ? (calculationResult?.materialTotal || 0) * (overhead.value / 100) :
                          0
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <Settings className="w-4 h-4 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Summary row */}
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-sm text-gray-800 text-right">
                      Razem narzuty:
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      {formatCurrency(calculationResult?.totalOverheads || 0)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              {/* Add narzut button */}
              <button className="mt-4 flex items-center gap-2 px-4 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                <Plus className="w-4 h-4" />
                Dodaj narzut
              </button>
            </div>
          )}

          {/* Zestawienia View */}
          {viewMode === 'zestawienia' && (
            <div className="p-4">
              {/* Tabs for zestawienia */}
              <div className="flex gap-1 mb-4 border-b border-gray-200">
                <button
                  onClick={() => setZestawieniaTab('robocizna')}
                  className={`px-4 py-2 text-sm font-medium ${
                    zestawieniaTab === 'robocizna'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-1" />
                  Robocizna
                </button>
                <button
                  onClick={() => setZestawieniaTab('materialy')}
                  className={`px-4 py-2 text-sm font-medium ${
                    zestawieniaTab === 'materialy'
                      ? 'text-green-600 border-b-2 border-green-600'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Package className="w-4 h-4 inline mr-1" />
                  Materiały
                </button>
                <button
                  onClick={() => setZestawieniaTab('sprzet')}
                  className={`px-4 py-2 text-sm font-medium ${
                    zestawieniaTab === 'sprzet'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Wrench className="w-4 h-4 inline mr-1" />
                  Sprzęt
                </button>
              </div>

              {/* Zestawienie table */}
              <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-300">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">Lp.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">Indeks</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nazwa</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16">j.m.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Ilość</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Cena jedn.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Collect all resources of the selected type
                    const resourceType = zestawieniaTab === 'robocizna' ? 'labor' :
                                         zestawieniaTab === 'materialy' ? 'material' : 'equipment';
                    const resources: { resource: KosztorysResource; quantity: number; positionName: string }[] = [];

                    (Object.values(estimateData.positions) as KosztorysPosition[]).forEach((pos: KosztorysPosition) => {
                      const posResult = calculationResult?.positions[pos.id];
                      pos.resources.forEach((res: KosztorysResource) => {
                        if (res.type === resourceType) {
                          resources.push({
                            resource: res,
                            quantity: res.norm.value * (posResult?.quantity || 0),
                            positionName: pos.name
                          });
                        }
                      });
                    });

                    if (resources.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                            Brak nakładów typu {zestawieniaTab === 'robocizna' ? 'robocizna' :
                                                 zestawieniaTab === 'materialy' ? 'materiały' : 'sprzęt'}
                          </td>
                        </tr>
                      );
                    }

                    let totalValue = 0;
                    return resources.map((item, index) => {
                      const value = item.quantity * item.resource.unitPrice.value;
                      totalValue += value;
                      return (
                        <tr key={item.resource.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-600">{index + 1}</td>
                          <td className="px-3 py-2 text-sm font-mono text-gray-600">{item.resource.originIndex.index || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-800">{item.resource.name}</td>
                          <td className="px-3 py-2 text-sm text-center text-gray-600">{item.resource.unit.label}</td>
                          <td className="px-3 py-2 text-sm text-right">{formatNumber(item.quantity)}</td>
                          <td className="px-3 py-2 text-sm text-right">{formatCurrency(item.resource.unitPrice.value)}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(value)}</td>
                        </tr>
                      );
                    });
                  })()}

                  {/* Summary row */}
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan={6} className="px-3 py-2 text-sm text-gray-800 text-right">
                      Razem {zestawieniaTab === 'robocizna' ? 'robocizna' :
                             zestawieniaTab === 'materialy' ? 'materiały' : 'sprzęt'}:
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      {formatCurrency(
                        zestawieniaTab === 'robocizna' ? calculationResult?.laborTotal || 0 :
                        zestawieniaTab === 'materialy' ? calculationResult?.materialTotal || 0 :
                        calculationResult?.equipmentTotal || 0
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Standard table views (przedmiar, kosztorys, naklady) */}
          {(viewMode === 'przedmiar' || viewMode === 'kosztorys' || viewMode === 'naklady' || viewMode === 'pozycje') && (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                {viewMode === 'przedmiar' ? (
                  <tr className="border-b border-gray-300">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">Lp.</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Podstawa</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nakład</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16">j.m.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Poszczególne</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Razem</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">Akcje</th>
                  </tr>
                ) : viewMode === 'naklady' ? (
                  <tr className="border-b border-gray-300">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">Lp.</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Indeks</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nazwa</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-16">j.m.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Ilość</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Cena jedn.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Wartość</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Ilość inwestora</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Ilość wykonawcy</th>
                  </tr>
                ) : (
                  <tr className="border-b border-gray-300">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-14">Lp.</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">Podstawa</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nakład</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12">j.m.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Nakład j.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Ceny jedn.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Koszt jedn.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">Ilość</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Wartość</th>
                  </tr>
                )}
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
                      <div className="text-gray-400 mb-4">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>Kosztorys jest pusty</p>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={handleAddSection}
                          className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
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
          )}
        </div>

        {/* Properties panel - now integrated into left panel */}
      </div>

      {/* Alerts bar - matching eKosztorysowanie "0 z 13" style with visual slider */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs text-gray-500 font-medium">Alerty</span>
          <span className="text-sm text-gray-600 min-w-[60px]">
            {alerts.length > 0 ? alertsCount.current + 1 : 0} z {alerts.length}
          </span>

          {/* Visual slider track - matching eKosztorysowanie ◄════════════════► style */}
          <div className="flex items-center gap-1 flex-1 max-w-md">
            <button
              onClick={() => handleNavigateToAlert(alertsCount.current - 1)}
              disabled={alertsCount.current === 0 || alerts.length === 0}
              className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>

            {/* Slider track */}
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full relative">
              {alerts.length > 0 && (
                <div
                  className="absolute h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{
                    width: `${((alertsCount.current + 1) / alerts.length) * 100}%`,
                    minWidth: '8px'
                  }}
                />
              )}
            </div>

            <button
              onClick={() => handleNavigateToAlert(alertsCount.current + 1)}
              disabled={alertsCount.current >= alerts.length - 1 || alerts.length === 0}
              className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Alert message */}
          {alerts.length > 0 && alertsCount.current < alerts.length && (
            <span className={`text-xs flex items-center gap-1 ml-2 ${
              alerts[alertsCount.current]?.type === 'error' ? 'text-[#EF4444]' : 'text-amber-600'
            }`}>
              <AlertCircle className="w-3 h-3" />
              {alerts[alertsCount.current]?.message || 'Alerty w kosztorysie'}
            </span>
          )}
          {alerts.length === 0 && (
            <span className="text-xs text-green-600 flex items-center gap-1 ml-2">
              <CheckCircle2 className="w-3 h-3" />
              Brak alertów
            </span>
          )}
        </div>

        {/* Right side - total value */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Wartość kosztorysu:</span>
          <span className="font-bold text-gray-900">{formatCurrency(calculationResult?.totalValue || 0)}</span>
        </div>
      </div>

      {/* Add Position Modal */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Dodaj pozycję</h2>
              <button onClick={() => setShowAddPositionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Podstawa (norma)</label>
                <input
                  type="text"
                  value={newPositionForm.base}
                  onChange={e => setNewPositionForm(prev => ({ ...prev, base: e.target.value }))}
                  placeholder="np. KNNR 5 0702-01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Nazwa nakładu</label>
                <textarea
                  value={newPositionForm.name}
                  onChange={e => setNewPositionForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Opis pracy..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Jednostka miary</label>
                  <select
                    value={newPositionForm.unitIndex}
                    onChange={e => setNewPositionForm(prev => ({ ...prev, unitIndex: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {UNITS_REFERENCE.map(u => (
                      <option key={u.index} value={u.index}>{u.unit} - {u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Przedmiar (ilość)</label>
                  <input
                    type="text"
                    value={newPositionForm.measurement}
                    onChange={e => setNewPositionForm(prev => ({ ...prev, measurement: e.target.value }))}
                    placeholder="np. 10*2.5 lub 25"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddPositionModal(false)}
                className="px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Dodaj nakład</h2>
              <button onClick={() => setShowAddResourceModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Typ nakładu</label>
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
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
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
                  <label className="block text-sm font-medium text-gray-800 mb-1">Indeks</label>
                  <input
                    type="text"
                    value={newResourceForm.index}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, index: e.target.value }))}
                    placeholder="np. 999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Jednostka</label>
                  <select
                    value={newResourceForm.unitIndex}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, unitIndex: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {UNITS_REFERENCE.map(u => (
                      <option key={u.index} value={u.index}>{u.unit} - {u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Nazwa</label>
                <input
                  type="text"
                  value={newResourceForm.name}
                  onChange={e => setNewResourceForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={RESOURCE_TYPE_CONFIG[newResourceForm.type].label}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Norma</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newResourceForm.normValue}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, normValue: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Cena jednostkowa</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newResourceForm.unitPrice}
                    onChange={e => setNewResourceForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddResourceModal(false)}
                className="px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
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

      {/* Ceny (Prices Update) Dialog */}
      {showCenyDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
            {/* Dialog header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Uaktualnij ceny w kosztorysie</h2>
              <button onClick={() => setShowCenyDialog(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setCenyDialogTab('wstaw')}
                className={`px-6 py-3 text-sm font-medium ${
                  cenyDialogTab === 'wstaw'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Wstaw ceny
              </button>
              <button
                onClick={() => setCenyDialogTab('zmien')}
                className={`px-6 py-3 text-sm font-medium ${
                  cenyDialogTab === 'zmien'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Zmień ceny
              </button>
            </div>

            {/* Tab content */}
            <div className="p-4 space-y-4">
              {/* Zastosuj do section */}
              <div>
                <p className="text-sm text-gray-600 mb-2">Zastosuj do</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={priceUpdateSettings.applyToLabor}
                        onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, applyToLabor: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-800">Robocizna</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={priceUpdateSettings.applyToMaterial}
                        onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, applyToMaterial: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-800">Materiały</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={priceUpdateSettings.applyToEquipment}
                        onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, applyToEquipment: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-800">Sprzęt</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={priceUpdateSettings.applyToWaste}
                        onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, applyToWaste: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-800">Odpady</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={priceUpdateSettings.unitPositionPrices}
                        onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, unitPositionPrices: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-800">Ceny jednostkowe pozycji</span>
                    </label>
                    {cenyDialogTab === 'wstaw' && (
                      <>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={priceUpdateSettings.emptyUnitPrices}
                            onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, emptyUnitPrices: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-800">Puste ceny jednostkowe pozycji</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={priceUpdateSettings.objectPrices}
                            onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, objectPrices: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-800">Ceny obiektów</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={priceUpdateSettings.onlyZeroPrices}
                            onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, onlyZeroPrices: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-800">Uaktualnij tylko ceny zerowe</span>
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {cenyDialogTab === 'wstaw' && (
                <>
                  {/* Źródła cen section */}
                  <div className="border border-gray-200 rounded-lg">
                    <button className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-800 hover:bg-gray-50">
                      <span>Źródła cen</span>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>
                  </div>

                  {/* Opcje wyszukiwania cen */}
                  <div className="border border-gray-200 rounded-lg">
                    <button className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-800 hover:bg-gray-50">
                      <span>Opcje wyszukiwania cen</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Zaawansowane */}
                  <div className="border border-gray-200 rounded-lg">
                    <button className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-800 hover:bg-gray-50">
                      <span>Zaawansowane</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Skip step process checkbox */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={priceUpdateSettings.skipStepProcess}
                      onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, skipStepProcess: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-800">Pomiń proces krokowy (automatyczne wstawienie cen)</span>
                  </label>
                </>
              )}

              {cenyDialogTab === 'zmien' && (
                <>
                  {/* Wyrażenie section */}
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Wyrażenie</p>
                    <div className="flex gap-2">
                      <select
                        value={priceUpdateSettings.expression.field}
                        onChange={(e) => setPriceUpdateSettings(prev => ({
                          ...prev,
                          expression: { ...prev.expression, field: e.target.value as 'cena' | 'wartosc' }
                        }))}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="cena">Cena</option>
                        <option value="wartosc">Wartość</option>
                      </select>
                      <select
                        value={priceUpdateSettings.expression.operation}
                        onChange={(e) => setPriceUpdateSettings(prev => ({
                          ...prev,
                          expression: { ...prev.expression, operation: e.target.value as 'add' | 'subtract' | 'multiply' | 'divide' }
                        }))}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      >
                        <option value="add">Dodaj (+)</option>
                        <option value="subtract">Odejmij (-)</option>
                        <option value="multiply">Pomnóż (*)</option>
                        <option value="divide">Podziel (/)</option>
                      </select>
                      <input
                        type="text"
                        value={priceUpdateSettings.expression.value}
                        onChange={(e) => setPriceUpdateSettings(prev => ({
                          ...prev,
                          expression: { ...prev.expression, value: e.target.value }
                        }))}
                        placeholder="Wartość"
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Wyzeruj ceny checkbox */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={priceUpdateSettings.zeroPrices}
                      onChange={(e) => setPriceUpdateSettings(prev => ({ ...prev, zeroPrices: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-800">Wyzeruj ceny</span>
                  </label>
                </>
              )}
            </div>

            {/* Dialog footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCenyDialog(false)}
                className="px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  showNotificationMessage(
                    cenyDialogTab === 'wstaw' ? 'Rozpoczęto wstawianie cen...' : 'Zastosowano zmiany cen',
                    'success'
                  );
                  setShowCenyDialog(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {cenyDialogTab === 'wstaw' ? 'Rozpocznij wstawianie' : 'Zastosuj'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Exit Confirmation Modal */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Zapisz przed wyjściem?</h2>
              <p className="text-sm text-gray-600 mb-6">
                Masz niezapisane zmiany. Co chcesz zrobić?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowExitConfirmModal(false);
                    navigate('/construction/estimates');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300"
                >
                  Nie zapisuj
                </button>
                <button
                  onClick={async () => {
                    await handleSave();
                    setShowExitConfirmModal(false);
                    navigate('/construction/estimates');
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Zapisz i wyjdź
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ustawienia (Settings) Modal - matching eKosztorysowanie exactly */}
      {showSettingsModal && estimate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Ustawienia kosztorysu</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Nazwa kosztorysu */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Nazwa kosztorysu</label>
                <input
                  type="text"
                  value={estimate.settings.name}
                  onChange={(e) => setEstimate(prev => prev ? {
                    ...prev,
                    settings: { ...prev.settings, name: e.target.value }
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Rodzaj */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Rodzaj</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="estimateType"
                      value="contractor"
                      checked={estimate.settings.type === 'contractor'}
                      onChange={() => setEstimate(prev => prev ? {
                        ...prev,
                        settings: { ...prev.settings, type: 'contractor' }
                      } : null)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-800">Wykonawczy</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="estimateType"
                      value="investor"
                      checked={estimate.settings.type === 'investor'}
                      onChange={() => setEstimate(prev => prev ? {
                        ...prev,
                        settings: { ...prev.settings, type: 'investor' }
                      } : null)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-800">Inwestorski</span>
                  </label>
                </div>
              </div>

              {/* Kalkulacje - template dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Kalkulacje</label>
                <select
                  value={estimate.settings.calculationTemplate}
                  onChange={(e) => setEstimate(prev => prev ? {
                    ...prev,
                    settings: { ...prev.settings, calculationTemplate: e.target.value }
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="overhead-on-top">Narzuty „od góry" - liczenie od kosztów bezpośrednich</option>
                  <option value="overhead-cascade">Narzuty kaskadowe - liczenie od sumy poprzednich</option>
                  <option value="simple">Uproszczona - bez narzutów</option>
                </select>
              </div>

              {/* Opis */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Opis</label>
                <textarea
                  value={estimate.settings.description}
                  onChange={(e) => setEstimate(prev => prev ? {
                    ...prev,
                    settings: { ...prev.settings, description: e.target.value }
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  rows={3}
                  placeholder="Dodaj opis kosztorysu..."
                />
              </div>

              {/* Dokładność (Precision) section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-800 mb-3">Dokładność</h3>
                <div className="space-y-3">
                  {/* Normy */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Normy</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, norms: Math.max(0, prev.settings.precision.norms - 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm">{estimate.settings.precision.norms}</span>
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, norms: Math.min(10, prev.settings.precision.norms + 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Wartości */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Wart</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, unitValues: Math.max(0, prev.settings.precision.unitValues - 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm">{estimate.settings.precision.unitValues}</span>
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, unitValues: Math.min(10, prev.settings.precision.unitValues + 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nakłady */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Nakła</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, resources: Math.max(0, prev.settings.precision.resources - 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm">{estimate.settings.precision.resources}</span>
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, resources: Math.min(10, prev.settings.precision.resources + 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Podsumowania */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pods</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, positionBase: Math.max(0, prev.settings.precision.positionBase - 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm">{estimate.settings.precision.positionBase}</span>
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, positionBase: Math.min(10, prev.settings.precision.positionBase + 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Obmiary */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Obmi</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, measurements: Math.max(0, prev.settings.precision.measurements - 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm">{estimate.settings.precision.measurements}</span>
                      <button
                        onClick={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: {
                            ...prev.settings,
                            precision: { ...prev.settings.precision, measurements: Math.min(10, prev.settings.precision.measurements + 1) }
                          }
                        } : null)}
                        className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Współczynniki norm section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-800 mb-3">Współczynniki norm</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Robocizna</label>
                    <input
                      type="text"
                      value={estimateData.root.factors.labor.toString().replace('.', ',')}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.')) || 1;
                        setEstimateData(prev => ({
                          ...prev,
                          root: { ...prev.root, factors: { ...prev.root.factors, labor: val } }
                        }));
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Materiały</label>
                    <input
                      type="text"
                      value={estimateData.root.factors.material.toString().replace('.', ',')}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.')) || 1;
                        setEstimateData(prev => ({
                          ...prev,
                          root: { ...prev.root, factors: { ...prev.root.factors, material: val } }
                        }));
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sprzęt</label>
                    <input
                      type="text"
                      value={estimateData.root.factors.equipment.toString().replace('.', ',')}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.')) || 1;
                        setEstimateData(prev => ({
                          ...prev,
                          root: { ...prev.root, factors: { ...prev.root.factors, equipment: val } }
                        }));
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Odpady</label>
                    <input
                      type="text"
                      value={estimateData.root.factors.waste.toString().replace('.', ',')}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                        setEstimateData(prev => ({
                          ...prev,
                          root: { ...prev.root, factors: { ...prev.root.factors, waste: val } }
                        }));
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  setEditorState(prev => ({ ...prev, isDirty: true }));
                  setShowSettingsModal(false);
                  showNotificationMessage('Ustawienia zapisane', 'success');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Zapisz ustawienia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Dialog - matching eKosztorysowanie */}
      {showPrintDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full shadow-xl flex max-h-[90vh]">
            {/* Preview section */}
            <div className="flex-1 bg-gray-100 p-4 flex flex-col">
              <div className="flex-1 bg-white rounded-lg shadow-inner overflow-auto flex items-center justify-center">
                <div className="w-[595px] h-[842px] bg-white shadow-lg p-8 text-xs">
                  {/* Preview header */}
                  <div className="flex justify-between text-[8px] text-gray-500 mb-4">
                    <span>{new Date().toLocaleDateString('pl-PL')}</span>
                    <span>eKosztorysowanie</span>
                  </div>

                  {/* Preview content */}
                  <h1 className="text-lg font-bold text-center mb-4">Kosztorys</h1>
                  <h2 className="text-sm font-medium text-center mb-6">Tabela elementów scalonych</h2>

                  <table className="w-full text-[8px] border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-1 py-0.5">Lp</th>
                        <th className="border border-gray-300 px-1 py-0.5">Nazwa</th>
                        <th className="border border-gray-300 px-1 py-0.5">Robocizna</th>
                        <th className="border border-gray-300 px-1 py-0.5">Materiały</th>
                        <th className="border border-gray-300 px-1 py-0.5">Sprzęt</th>
                        <th className="border border-gray-300 px-1 py-0.5">Razem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(estimateData.sections).slice(0, 5).map((section, index) => (
                        <tr key={section.id}>
                          <td className="border border-gray-300 px-1 py-0.5 text-center">{index + 1}</td>
                          <td className="border border-gray-300 px-1 py-0.5">{section.name}</td>
                          <td className="border border-gray-300 px-1 py-0.5 text-right">
                            {formatNumber(calculationResult?.sections[section.id]?.laborTotal || 0)}
                          </td>
                          <td className="border border-gray-300 px-1 py-0.5 text-right">
                            {formatNumber(calculationResult?.sections[section.id]?.materialTotal || 0)}
                          </td>
                          <td className="border border-gray-300 px-1 py-0.5 text-right">
                            {formatNumber(calculationResult?.sections[section.id]?.equipmentTotal || 0)}
                          </td>
                          <td className="border border-gray-300 px-1 py-0.5 text-right font-medium">
                            {formatNumber(calculationResult?.sections[section.id]?.totalValue || 0)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-medium">
                        <td colSpan={2} className="border border-gray-300 px-1 py-0.5 text-right">Razem netto:</td>
                        <td colSpan={4} className="border border-gray-300 px-1 py-0.5 text-right">
                          {formatCurrency(calculationResult?.totalValue || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <p className="mt-4 text-[8px]">
                    Słownie: {calculationResult?.totalValue ? `${Math.floor(calculationResult.totalValue)} i ${Math.round((calculationResult.totalValue % 1) * 100)}/100 PLN` : '0 PLN'}
                  </p>
                </div>
              </div>

              {/* Page navigation */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPrintPreviewPage(prev => Math.max(1, prev - 1))}
                  disabled={printPreviewPage === 1}
                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-40"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">{printPreviewPage}</span>
                <button
                  onClick={() => setPrintPreviewPage(prev => Math.min(printTotalPages, prev + 1))}
                  disabled={printPreviewPage === printTotalPages}
                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-40"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Settings section */}
            <div className="w-80 border-l border-gray-200 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Drukuj</h2>
                <button onClick={() => setShowPrintDialog(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-2">{printTotalPages} stron</p>

              <div className="space-y-4 flex-1">
                {/* Printer */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Drukarka</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option>Microsoft Print to PDF</option>
                    <option>RICOH MP C2503</option>
                  </select>
                </div>

                {/* Pages */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Strony</label>
                  <select
                    value={printSettings.pages}
                    onChange={(e) => setPrintSettings(prev => ({ ...prev, pages: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">Wszystkie</option>
                    <option value="current">Bieżąca</option>
                    <option value="range">Zakres</option>
                  </select>
                </div>

                {/* Copies */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Kopie</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={printSettings.copies}
                    onChange={(e) => setPrintSettings(prev => ({ ...prev, copies: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* Orientation */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Orientacja</label>
                  <select
                    value={printSettings.orientation}
                    onChange={(e) => setPrintSettings(prev => ({ ...prev, orientation: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="portrait">Pionowa</option>
                    <option value="landscape">Pozioma</option>
                  </select>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Kolor</label>
                  <select
                    value={printSettings.color ? 'color' : 'bw'}
                    onChange={(e) => setPrintSettings(prev => ({ ...prev, color: e.target.value === 'color' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="color">Kolorowy</option>
                    <option value="bw">Czarno-biały</option>
                  </select>
                </div>

                {/* Dodatkowe ustawienia - matching eKosztorysowanie */}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <button
                    className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-800"
                    onClick={() => {/* Toggle advanced settings */}}
                  >
                    <span>Dodatkowe ustawienia</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowPrintDialog(false)}
                  className="flex-1 px-4 py-2 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setShowPrintDialog(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Drukuj
                </button>
              </div>
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
