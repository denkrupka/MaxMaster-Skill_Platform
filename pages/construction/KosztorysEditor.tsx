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
type LeftPanelMode = 'overview' | 'properties' | 'export' | 'catalog' | 'comments' | 'titlePageEditor' | 'settings';
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
  type: 'strona_tytulowa' | 'tabela_elementow' | 'przedmiar' | 'kosztorys_ofertowy' |
        'kalkulacja_szczegolowa' | 'kosztorys_szczegolowy' | 'zestawienie_robocizny' |
        'zestawienie_materialow' | 'zestawienie_sprzetu';
  label: string;
  enabled: boolean;
  canEdit?: boolean;
}

// All available export pages
const ALL_EXPORT_PAGES: ExportPage[] = [
  { id: 'p1', type: 'strona_tytulowa', label: 'Strona tytułowa', enabled: true, canEdit: true },
  { id: 'p2', type: 'tabela_elementow', label: 'Tabela elementów scalonych', enabled: true },
  { id: 'p3', type: 'przedmiar', label: 'Przedmiar', enabled: true },
  { id: 'p4', type: 'kosztorys_ofertowy', label: 'Kosztorys ofertowy', enabled: true },
  { id: 'p5', type: 'kalkulacja_szczegolowa', label: 'Szczegółowa kalkulacja cen jednostkowych', enabled: true },
  { id: 'p6', type: 'kosztorys_szczegolowy', label: 'Szczegółowy kosztorys inwestorski', enabled: true },
  { id: 'p7', type: 'zestawienie_robocizny', label: 'Zestawienie robocizny', enabled: true },
  { id: 'p8', type: 'zestawienie_materialow', label: 'Zestawienie materiałów', enabled: true },
  { id: 'p9', type: 'zestawienie_sprzetu', label: 'Zestawienie sprzętu', enabled: true },
];

// Template page configurations
const TEMPLATE_PAGES: Record<string, string[]> = {
  'niestandardowy': [], // Empty - user adds pages manually
  'kosztorys_ofertowy': ['p1', 'p4', 'p5'], // Strona tytułowa, Kosztorys ofertowy, Szczegółowa kalkulacja
  'przedmiar_robot': ['p1', 'p3'], // Strona tytułowa, Przedmiar
};

// Default export pages configuration (empty for niestandardowy)
const DEFAULT_EXPORT_PAGES: ExportPage[] = [];

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

// Position tag/marker options
const POSITION_TAGS = [
  { id: 'analiza', label: 'Analiza indywidualna' },
  { id: 'analogia', label: 'Analogia' },
  { id: 'cena_zakladowa', label: 'Cena zakładowa' },
  { id: 'kalk_szczegolowa', label: 'Kalk. szczegółowa' },
  { id: 'kalk_warsztatowa', label: 'Kalk. warsztatowa' },
  { id: 'kalk_wlasna', label: 'Kalk. własna' },
];

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
type ExportTemplate = 'kosztorys_ofertowy' | 'przedmiar_robot' | 'niestandardowy';

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
  const [activeExportSection, setActiveExportSection] = useState<string | null>(null);

  // Refs for print preview sections
  const printPreviewRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Catalog browser state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [expandedCatalogItems, setExpandedCatalogItems] = useState<Set<string>>(new Set());
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogQuantity, setCatalogQuantity] = useState('10');
  const [catalogMultiplier, setCatalogMultiplier] = useState('1');
  const [catalogUnitIndex, setCatalogUnitIndex] = useState('060'); // Default to m3

  // Dropdown states
  const [showDzialDropdown, setShowDzialDropdown] = useState(false);
  const [showNakladDropdown, setShowNakladDropdown] = useState(false);
  const [showKNRDropdown, setShowKNRDropdown] = useState(false);
  const [showKomentarzeDropdown, setShowKomentarzeDropdown] = useState(false);
  const [showUsunDropdown, setShowUsunDropdown] = useState(false);
  const [showPrzesunDropdown, setShowPrzesunDropdown] = useState(false);
  const [showUzupelnijDropdown, setShowUzupelnijDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showAddPageDropdown, setShowAddPageDropdown] = useState(false);
  const [selectedPagesToAdd, setSelectedPagesToAdd] = useState<Set<string>>(new Set());

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
  const [alerts, setAlerts] = useState<{ id: string; type: 'warning' | 'error'; message: string; positionId?: string; resourceId?: string; positionName?: string }[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

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

  // Position tag dropdown state
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  // Opcje widoku dropdown state
  const [showOpcjeWidokuDropdown, setShowOpcjeWidokuDropdown] = useState(false);
  const [viewOptions, setViewOptions] = useState({
    showPrzemiar: true,
    showNaklady: true,
    showCeny: true,
    showSumy: true,
    compactView: false,
  });

  // Right panel state
  type RightPanelMode = 'closed' | 'settings' | 'viewOptions' | 'positionSettings';
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('closed');
  const [viewOptionsPanel, setViewOptionsPanel] = useState({
    highlightZeroPrices: true,
    showDetailedOverheads: true,
  });

  // Highlight state for alert navigation
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const rowRefs = React.useRef<{ [key: string]: HTMLTableRowElement | null }>({});

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

  // Auto-validate when data changes
  useEffect(() => {
    if (!calculationResult || Object.keys(estimateData.positions).length === 0) {
      setAlerts([]);
      setAlertsCount({ current: 0, total: 0 });
      return;
    }

    const newAlerts: typeof alerts = [];
    let posIndex = 0;

    // Helper function to get positions from a section (including subsections)
    const getPositionsFromSection = (sectionId: string): string[] => {
      const section = estimateData.sections[sectionId];
      if (!section) return [];
      let posIds = [...section.positionIds];
      for (const subId of section.subsectionIds || []) {
        posIds = posIds.concat(getPositionsFromSection(subId));
      }
      return posIds;
    };

    // Get all visible position IDs in order (through sections)
    let visiblePositionIds: string[] = [];
    // First add positions from root (if any direct positions)
    visiblePositionIds = visiblePositionIds.concat(estimateData.root.positionIds || []);
    // Then add positions from sections
    for (const sectionId of estimateData.root.sectionIds) {
      visiblePositionIds = visiblePositionIds.concat(getPositionsFromSection(sectionId));
    }

    // Filter out orphan position IDs (IDs that don't exist in positions object)
    visiblePositionIds = visiblePositionIds.filter(id => estimateData.positions[id]);

    // Validate only visible positions
    visiblePositionIds.forEach((positionId) => {
      const position = estimateData.positions[positionId];

      posIndex++;

      // Generate position identifier (use base/catalog code if available, otherwise ordinal number)
      const posIdentifier = position.base?.trim() || `#${posIndex}`;

      // Check for zero unit price (total cost = 0 but has resources)
      if (position.resources.length > 0) {
        position.resources.forEach((resource, resIndex) => {
          if (resource.unitPrice.value === 0) {
            newAlerts.push({
              id: `${resource.id}-price`,
              type: 'warning',
              message: `${posIdentifier}: Nakład ${resIndex + 1} - cena zerowa`,
              positionId: position.id,
              resourceId: resource.id,
              positionName: position.name,
            });
          }
        });
      }

      // Check if position has no resources
      if (position.resources.length === 0) {
        newAlerts.push({
          id: `${position.id}-nores`,
          type: 'warning',
          message: `${posIdentifier}: Brak nakładów`,
          positionId: position.id,
          positionName: position.name,
        });
      }
    });

    setAlerts(newAlerts);
    setAlertsCount({ current: 0, total: newAlerts.length });
  }, [calculationResult, estimateData.positions, estimateData.sections, estimateData.root.sectionIds, estimateData.root.positionIds]);

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

        // Check if we have saved JSON data first
        if (data.data_json) {
          // Use saved JSON data directly, but clean orphan positions first
          const rawData = data.data_json as KosztorysCostEstimateData;
          const cleanedData = cleanOrphanPositions(rawData);
          convertedEstimate.data = cleanedData;
          setEstimate(convertedEstimate);
          setEstimateData(cleanedData);

          // Expand all sections and positions by default
          const allSectionIds = Object.keys(cleanedData.sections);
          const allPositionIds = Object.keys(cleanedData.positions);
          setEditorState(prev => ({
            ...prev,
            expandedSections: new Set(allSectionIds),
            expandedPositions: new Set(allPositionIds),
          }));
          setLoading(false);
          return;
        }

        // Fallback: Convert existing items to positions
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
            data_json: estimateData, // Save full estimate data as JSON
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

  // Clean orphan positions from data (positions that exist but aren't in any section)
  const cleanOrphanPositions = (data: KosztorysCostEstimateData): KosztorysCostEstimateData => {
    // Get all position IDs that are actually referenced
    const referencedPositionIds = new Set<string>();

    // Add root position IDs
    (data.root.positionIds || []).forEach(id => referencedPositionIds.add(id));

    // Add position IDs from all sections (including subsections)
    const collectSectionPositions = (sectionId: string) => {
      const section = data.sections[sectionId];
      if (!section) return;
      (section.positionIds || []).forEach(id => referencedPositionIds.add(id));
      (section.subsectionIds || []).forEach(subId => collectSectionPositions(subId));
    };

    (data.root.sectionIds || []).forEach(sectionId => collectSectionPositions(sectionId));

    // Remove unreferenced positions from positions object
    const cleanedPositions: Record<string, KosztorysPosition> = {};
    for (const [posId, position] of Object.entries(data.positions)) {
      if (referencedPositionIds.has(posId)) {
        cleanedPositions[posId] = position;
      } else {
        console.log('Removing orphan position:', posId, position.name);
      }
    }

    // Clean up section positionIds to remove IDs that don't exist
    const cleanedSections: Record<string, KosztorysSection> = {};
    for (const [secId, section] of Object.entries(data.sections)) {
      cleanedSections[secId] = {
        ...section,
        positionIds: section.positionIds.filter(id => cleanedPositions[id]),
      };
    }

    // Clean up root positionIds
    const cleanedRoot = {
      ...data.root,
      positionIds: (data.root.positionIds || []).filter(id => cleanedPositions[id]),
    };

    return {
      ...data,
      root: cleanedRoot,
      sections: cleanedSections,
      positions: cleanedPositions,
    };
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

  // Add subsection to selected section
  const handleAddSubsection = (parentSectionId?: string) => {
    // Use provided parentSectionId or get from currently selected section
    const targetParentId = parentSectionId || (
      editorState.selectedItemType === 'section' ? editorState.selectedItemId : null
    );

    if (!targetParentId) {
      // No section selected - show alert or handle error
      return;
    }

    const parentSection = estimateData.sections[targetParentId];
    if (!parentSection) return;

    // Calculate ordinal number: parent.ordinalNumber + "." + (subsectionIds.length + 1)
    const subsectionIndex = (parentSection.subsectionIds?.length || 0) + 1;
    const ordinalNumber = `${parentSection.ordinalNumber}.${subsectionIndex}`;
    const newSection = createNewSection('Nowy poddział', ordinalNumber);

    updateEstimateData({
      ...estimateData,
      sections: {
        ...estimateData.sections,
        [newSection.id]: newSection,
        [targetParentId]: {
          ...parentSection,
          subsectionIds: [...(parentSection.subsectionIds || []), newSection.id],
        },
      },
    });

    setEditorState(prev => ({
      ...prev,
      selectedItemId: newSection.id,
      selectedItemType: 'section',
      expandedSections: new Set([...prev.expandedSections, targetParentId, newSection.id]),
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

    // Determine target section - use provided targetSectionId, or selected section, or first section
    let effectiveTargetSectionId = targetSectionId;

    if (!effectiveTargetSectionId && editorState.selectedItemType === 'section' && editorState.selectedItemId) {
      effectiveTargetSectionId = editorState.selectedItemId;
    }

    if (!effectiveTargetSectionId && estimateData.root.sectionIds.length > 0) {
      effectiveTargetSectionId = estimateData.root.sectionIds[0];
    }

    // Positions can only be added to sections (działy or poddziały), not to root
    if (!effectiveTargetSectionId || !newData.sections[effectiveTargetSectionId]) {
      setShowAddPositionModal(false);
      showNotificationMessage('Najpierw dodaj dział, aby móc dodać pozycję', 'warning');
      return;
    }

    newData.sections = {
      ...newData.sections,
      [targetSectionForPosition]: {
        ...newData.sections[targetSectionForPosition],
        positionIds: [...newData.sections[targetSectionForPosition].positionIds, newPosition.id],
      },
    };

    updateEstimateData(newData);
    setShowAddPositionModal(false);

    setEditorState(prev => ({
      ...prev,
      selectedItemId: newPosition.id,
      selectedItemType: 'position',
      expandedPositions: new Set([...prev.expandedPositions, newPosition.id]),
      expandedSections: new Set([...prev.expandedSections, targetSectionForPosition]),
    }));
  };

  // Add resource - instantly creates and opens properties panel
  const handleAddResource = (positionId: string, resourceType?: KosztorysResourceType) => {
    const position = estimateData.positions[positionId];
    if (!position) return;

    const defaultUnitIndex = resourceType === 'labor' ? '149' : resourceType === 'equipment' ? '150' : '020';
    const unit = UNITS_REFERENCE.find(u => u.index === defaultUnitIndex) || UNITS_REFERENCE[0];

    const resourceNames: Record<string, string> = {
      labor: 'Robocizna',
      material: 'Materiał',
      equipment: 'Sprzęt',
    };

    const newResource = createNewResource(
      resourceType || 'labor',
      resourceNames[resourceType || 'labor'] || 'Nowy nakład',
      1,
      0,
      unit.unit,
      unit.index
    );

    updateEstimateData({
      ...estimateData,
      positions: {
        ...estimateData.positions,
        [positionId]: {
          ...position,
          resources: [...position.resources, newResource],
        },
      },
    });

    // Select resource, expand position, and open properties panel
    setEditorState(prev => ({
      ...prev,
      selectedItemId: newResource.id,
      selectedItemType: 'resource',
      expandedPositions: new Set([...prev.expandedPositions, positionId]),
    }));

    setLeftPanelMode('properties');

    // Highlight and scroll to the position
    setHighlightedItemId(positionId);
    setTimeout(() => {
      const rowElement = rowRefs.current[positionId];
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    setTimeout(() => {
      setHighlightedItemId(null);
    }, 2000);

    showNotificationMessage(`Dodano nakład: ${resourceNames[resourceType || 'labor']}`, 'success');
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

  // Helper to recursively collect all section IDs (including subsections) and their positions
  const collectSectionAndSubsectionIds = (
    sectionId: string,
    sections: Record<string, KosztorysSection>
  ): { sectionIds: string[]; positionIds: string[] } => {
    const section = sections[sectionId];
    if (!section) return { sectionIds: [], positionIds: [] };

    const result = {
      sectionIds: [sectionId],
      positionIds: [...section.positionIds],
    };

    // Recursively collect subsections
    for (const subsectionId of section.subsectionIds || []) {
      const subResult = collectSectionAndSubsectionIds(subsectionId, sections);
      result.sectionIds.push(...subResult.sectionIds);
      result.positionIds.push(...subResult.positionIds);
    }

    return result;
  };

  // Delete item
  const handleDeleteItem = (itemId: string, itemType: 'section' | 'position' | 'resource') => {
    const newData = { ...estimateData };

    switch (itemType) {
      case 'section': {
        // Collect all section IDs and position IDs to delete (including subsections)
        const { sectionIds: sectionsToDelete, positionIds: positionsToDelete } =
          collectSectionAndSubsectionIds(itemId, newData.sections);

        // Remove all collected sections
        const remainingSections = { ...newData.sections };
        for (const secId of sectionsToDelete) {
          delete remainingSections[secId];
        }
        newData.sections = remainingSections;

        // Remove all positions from deleted sections
        const remainingPositions = { ...newData.positions };
        for (const posId of positionsToDelete) {
          delete remainingPositions[posId];
        }
        newData.positions = remainingPositions;

        // Remove from root sectionIds
        newData.root = {
          ...newData.root,
          sectionIds: newData.root.sectionIds.filter(id => id !== itemId),
        };

        // Also remove from parent's subsectionIds if it's a subsection
        for (const [secId, section] of Object.entries(newData.sections)) {
          if (section.subsectionIds?.includes(itemId)) {
            newData.sections = {
              ...newData.sections,
              [secId]: {
                ...section,
                subsectionIds: section.subsectionIds.filter(id => id !== itemId),
              },
            };
            break;
          }
        }
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
                // Set default unit from catalog item
                const defaultUnit = UNITS_REFERENCE.find(u => u.unit === item.unit);
                if (defaultUnit) {
                  setCatalogUnitIndex(defaultUnit.index);
                }
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

    // Use selected unit from dropdown instead of catalog default
    const unit = UNITS_REFERENCE.find(u => u.index === catalogUnitIndex) || UNITS_REFERENCE[0];
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

    // Find target section - use selected section or find a section to add to
    let targetSectionId: string | null = null;

    if (editorState.selectedItemType === 'section' && editorState.selectedItemId) {
      targetSectionId = editorState.selectedItemId;
    } else if (editorState.selectedItemType === 'position' && editorState.selectedItemId) {
      // Find which section contains the selected position
      for (const [secId, section] of Object.entries(estimateData.sections)) {
        if (section.positionIds.includes(editorState.selectedItemId)) {
          targetSectionId = secId;
          break;
        }
      }
    }

    // If no section selected, try to use the first section
    if (!targetSectionId && estimateData.root.sectionIds.length > 0) {
      targetSectionId = estimateData.root.sectionIds[0];
    }

    // If still no section, show error
    if (!targetSectionId) {
      showNotificationMessage('Najpierw dodaj dział, aby móc dodać pozycję', 'warning');
      return;
    }

    // Add to estimate
    const newData = { ...estimateData };
    newData.positions = { ...newData.positions, [newPosition.id]: newPosition };

    // Add position to the target section
    const targetSection = newData.sections[targetSectionId];
    if (targetSection) {
      newData.sections = {
        ...newData.sections,
        [targetSectionId]: {
          ...targetSection,
          positionIds: [...targetSection.positionIds, newPosition.id],
        },
      };
    }

    updateEstimateData(newData);
    setLeftPanelMode('overview');

    setEditorState(prev => ({
      ...prev,
      selectedItemId: newPosition.id,
      selectedItemType: 'position',
      expandedPositions: new Set([...prev.expandedPositions, newPosition.id]),
      expandedSections: new Set([...prev.expandedSections, targetSectionId!]),
    }));

    showNotificationMessage(`Dodano pozycję: ${catalogItem.code}`, 'success');
  };

  // Add uncatalogued position (pozycja nieskatalogowana) - instantly creates position and opens properties panel
  const handleAddUncataloguedPosition = () => {
    // Find target section
    let targetSectionId: string | null = null;

    if (editorState.selectedItemType === 'section' && editorState.selectedItemId) {
      targetSectionId = editorState.selectedItemId;
    } else if (editorState.selectedItemType === 'position' && editorState.selectedItemId) {
      // Find which section contains the selected position
      for (const [secId, section] of Object.entries(estimateData.sections)) {
        if (section.positionIds.includes(editorState.selectedItemId)) {
          targetSectionId = secId;
          break;
        }
      }
    }

    // If no section selected, try to use the first section
    if (!targetSectionId && estimateData.root.sectionIds.length > 0) {
      targetSectionId = estimateData.root.sectionIds[0];
    }

    // If still no section, show error
    if (!targetSectionId) {
      showNotificationMessage('Najpierw dodaj dział, aby móc dodać pozycję', 'warning');
      return;
    }

    // Create new empty position
    const newPosition = createNewPosition('', 'Nowa pozycja', 'szt.', '020');

    // Add to estimate
    const newData = { ...estimateData };
    newData.positions = { ...newData.positions, [newPosition.id]: newPosition };
    newData.sections = {
      ...newData.sections,
      [targetSectionId]: {
        ...newData.sections[targetSectionId],
        positionIds: [...newData.sections[targetSectionId].positionIds, newPosition.id],
      },
    };

    updateEstimateData(newData);

    // Select position and open properties panel
    setEditorState(prev => ({
      ...prev,
      selectedItemId: newPosition.id,
      selectedItemType: 'position',
      expandedSections: new Set([...prev.expandedSections, targetSectionId!]),
      expandedPositions: new Set([...prev.expandedPositions, newPosition.id]),
    }));

    setLeftPanelMode('properties');

    // Highlight and scroll to the new position
    setHighlightedItemId(newPosition.id);
    setTimeout(() => {
      const rowElement = rowRefs.current[newPosition.id];
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    setTimeout(() => {
      setHighlightedItemId(null);
    }, 2000);

    showNotificationMessage('Dodano nową pozycję', 'success');
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

  // Navigate to alert with scroll and highlight
  const handleNavigateToAlert = (alertIndex: number) => {
    if (alertIndex >= 0 && alertIndex < alerts.length) {
      const alert = alerts[alertIndex];
      setAlertsCount(prev => ({ ...prev, current: alertIndex }));

      if (alert.resourceId && alert.positionId) {
        // Alert is for a resource - find and expand parent section and position
        selectItem(alert.resourceId, 'resource');

        // Find which section contains this position and expand it
        const sectionsToExpand: string[] = [];
        const findSectionForPosition = (sectionId: string): boolean => {
          const section = estimateData.sections[sectionId];
          if (!section) return false;
          if (section.positionIds.includes(alert.positionId!)) {
            sectionsToExpand.push(sectionId);
            return true;
          }
          for (const subId of section.subsectionIds || []) {
            if (findSectionForPosition(subId)) {
              sectionsToExpand.push(sectionId);
              return true;
            }
          }
          return false;
        };
        for (const sectionId of estimateData.root.sectionIds) {
          findSectionForPosition(sectionId);
        }

        setEditorState(prev => ({
          ...prev,
          expandedSections: new Set([...prev.expandedSections, ...sectionsToExpand]),
          expandedPositions: new Set([...prev.expandedPositions, alert.positionId!]),
        }));

        // Highlight the resource
        setHighlightedItemId(alert.resourceId);

        // Scroll to the resource row after a short delay to allow DOM update
        setTimeout(() => {
          const rowElement = rowRefs.current[alert.resourceId!];
          if (rowElement) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);

        // Clear highlight after animation
        setTimeout(() => {
          setHighlightedItemId(null);
        }, 2000);
      } else if (alert.positionId) {
        // Alert is for a position - find and expand its parent section
        selectItem(alert.positionId, 'position');

        // Find which section contains this position and expand it
        const sectionsToExpand: string[] = [];
        const findSectionForPosition = (sectionId: string): boolean => {
          const section = estimateData.sections[sectionId];
          if (!section) return false;
          if (section.positionIds.includes(alert.positionId!)) {
            sectionsToExpand.push(sectionId);
            return true;
          }
          for (const subId of section.subsectionIds || []) {
            if (findSectionForPosition(subId)) {
              sectionsToExpand.push(sectionId);
              return true;
            }
          }
          return false;
        };
        for (const sectionId of estimateData.root.sectionIds) {
          findSectionForPosition(sectionId);
        }

        setEditorState(prev => ({
          ...prev,
          expandedSections: new Set([...prev.expandedSections, ...sectionsToExpand]),
          expandedPositions: new Set([...prev.expandedPositions, alert.positionId!]),
        }));

        // Highlight the position
        setHighlightedItemId(alert.positionId);

        // Scroll to the position row after a short delay to allow DOM update
        setTimeout(() => {
          const rowElement = rowRefs.current[alert.positionId!];
          if (rowElement) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);

        // Clear highlight after animation
        setTimeout(() => {
          setHighlightedItemId(null);
        }, 2000);
      }
    }
  };

  // Scroll to export section when clicked in left panel
  const scrollToExportSection = (sectionId: string) => {
    setActiveExportSection(sectionId);
    const sectionRef = sectionRefs.current[sectionId];
    if (sectionRef && printPreviewRef.current) {
      sectionRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handle print document
  const handlePrintDocument = () => {
    const printContent = printPreviewRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        @page {
          margin: 15mm 20mm;
          size: A4;
        }
        @media print {
          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          margin: 0;
          padding: 0;
        }
        .print-section {
          page-break-after: always;
          padding: 0;
        }
        .print-section:last-child { page-break-after: auto; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
        th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        h1, h2, h3 { margin: 0 0 0.5em 0; }

        /* Title page styles */
        .title-page-content {
          min-height: 85vh;
          display: flex;
          flex-direction: column;
        }
        .company-header {
          text-align: right;
          margin-bottom: 40px;
          line-height: 1.6;
        }
        .main-title {
          text-align: center;
          font-size: 28px;
          font-weight: bold;
          margin: 40px 0 50px 0;
        }
        .details-section {
          flex: 1;
        }
        .detail-group {
          margin-bottom: 24px;
        }
        .detail-row {
          display: flex;
          margin-bottom: 6px;
          line-height: 1.6;
        }
        .detail-label {
          width: 220px;
          color: #555;
          flex-shrink: 0;
        }
        .detail-value {
          flex: 1;
        }
        .dates-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ccc;
        }
        .dates-row {
          display: flex;
          justify-content: space-between;
        }
        .date-block {
          line-height: 1.6;
        }
        .date-label {
          color: #555;
          font-size: 11px;
        }
        .page-number {
          text-align: right;
          font-size: 10px;
          color: #999;
          margin-top: 20px;
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>${titlePageData.title || estimate?.settings.name || 'Kosztorys'}</title>
        ${styles}
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
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

  // Section depth colors for visual hierarchy
  const sectionDepthColors = [
    { border: 'border-l-4 border-l-blue-500', bg: 'bg-blue-50', headerBg: 'bg-blue-100' },      // depth 0 - main section
    { border: 'border-l-4 border-l-emerald-500', bg: 'bg-emerald-50', headerBg: 'bg-emerald-100' }, // depth 1
    { border: 'border-l-4 border-l-amber-500', bg: 'bg-amber-50', headerBg: 'bg-amber-100' },      // depth 2
    { border: 'border-l-4 border-l-purple-500', bg: 'bg-purple-50', headerBg: 'bg-purple-100' },   // depth 3
    { border: 'border-l-4 border-l-rose-500', bg: 'bg-rose-50', headerBg: 'bg-rose-100' },         // depth 4+
  ];

  const getDepthColors = (depth: number) => sectionDepthColors[Math.min(depth, sectionDepthColors.length - 1)];

  // Render position row
  const renderPositionRow = (position: KosztorysPosition, positionNumber: number, sectionId: string | null, sectionDepth: number = 0) => {
    const isExpanded = editorState.expandedPositions.has(position.id);
    const isSelected = editorState.selectedItemId === position.id;
    const result = calculationResult?.positions[position.id];
    const quantity = result?.quantity || 0;
    const depthColors = getDepthColors(sectionDepth);

    // Przedmiar view - matching eKosztorysowanie layout
    if (viewMode === 'przedmiar') {
      const sectionPrefix = sectionId ? 'd.1.' : 'd.';
      return (
        <React.Fragment key={position.id}>
          {/* Position header row */}
          <tr
            className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${depthColors.border} ${isSelected ? 'bg-blue-100' : depthColors.bg}`}
            onClick={() => selectItem(position.id, 'position')}
          >
            <td className="px-3 py-2 text-sm align-top">
              <div className="flex flex-col items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpandPosition(position.id); }}
                  className="w-6 h-6 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs font-bold text-blue-600 hover:bg-blue-50"
                >
                  {positionNumber}
                </button>
                <span className="text-xs text-gray-400 mt-0.5">{sectionPrefix}{positionNumber}</span>
              </div>
            </td>
            <td className="px-3 py-2 text-sm font-mono text-gray-800 align-top">{position.base || ''}</td>
            <td className="px-3 py-2 text-sm text-gray-900 align-top" colSpan={2}>{position.name}</td>
            <td className="px-3 py-2 text-sm text-right text-gray-800 align-top">{position.unit.label}</td>
            <td className="px-3 py-2 text-sm text-right align-top"></td>
          </tr>
          {/* Measurement rows */}
          {position.measurements.rootIds.map((measureId, idx) => {
            const measure = position.measurements.entries[measureId];
            if (!measure) return null;
            const measureValue = evaluateMeasurementExpression(measure.expression) || 0;
            return (
              <tr key={measureId} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-1 text-sm"></td>
                <td className="px-3 py-1 text-sm text-gray-500">{measure.description || ''}</td>
                <td className="px-3 py-1 text-sm text-gray-600" colSpan={2}>{measure.expression || ''}</td>
                <td className="px-3 py-1 text-sm text-right text-gray-500">{position.unit.label}</td>
                <td className="px-3 py-1 text-sm text-right text-gray-700">{formatNumber(measureValue, 2)}</td>
              </tr>
            );
          })}
          {/* Razem row */}
          <tr className="border-b border-gray-200">
            <td colSpan={4}></td>
            <td className="px-3 py-1.5 text-sm text-right text-gray-500">Razem</td>
            <td className="px-3 py-1.5 text-sm text-right font-medium text-gray-900">{formatNumber(quantity, 2)}</td>
          </tr>
        </React.Fragment>
      );
    }

    // Pozycje view - matching eKosztorysowanie reference layout
    if (viewMode === 'pozycje') {
      const sectionPrefix = sectionId ? 'd.1.' : 'd.';
      return (
        <tr
          key={position.id}
          className={`cursor-pointer ${depthColors.border} ${isSelected ? 'bg-blue-100' : depthColors.bg + ' hover:brightness-95'}`}
          onClick={() => selectItem(position.id, 'position')}
        >
          <td className="px-3 py-3 text-sm border border-gray-300 align-top">
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-blue-600">{positionNumber}</span>
              <span className="text-xs text-gray-500">{sectionPrefix}{positionNumber}</span>
            </div>
          </td>
          <td className="px-3 py-3 text-sm font-mono text-gray-800 border border-gray-300 align-top">{position.base || ''}</td>
          <td className="px-3 py-3 text-sm text-gray-900 border border-gray-300 align-top">{position.name}</td>
          <td className="px-3 py-3 text-sm text-center text-gray-600 border border-gray-300 align-top">{position.unit.label}</td>
          <td className="px-3 py-3 text-sm text-right text-gray-800 border border-gray-300 align-top">{formatNumber(quantity, 2)}</td>
          <td className="px-3 py-3 text-sm text-right text-gray-800 border border-gray-300 align-top">{formatNumber(result?.unitCost || 0, 3)}</td>
          <td className="px-3 py-3 text-sm text-right font-medium text-gray-900 border border-gray-300 align-top">{formatNumber(result?.totalWithOverheads || 0, 3)}</td>
        </tr>
      );
    }

    // Nakłady view
    if (viewMode === 'naklady') {
      return (
        <React.Fragment key={position.id}>
          {position.resources.map((resource, index) => {
            const config = RESOURCE_TYPE_CONFIG[resource.type] || RESOURCE_TYPE_CONFIG.material;
            const resResult = result?.resources.find(r => r.id === resource.id);
            const isResourceSelected = editorState.selectedItemId === resource.id;
            const resQuantity = resResult?.calculatedQuantity || resource.norm.value * quantity;

            return (
              <tr
                key={resource.id}
                className={`border-b border-gray-100 cursor-pointer ${depthColors.border} ${isResourceSelected ? 'bg-blue-100' : depthColors.bg + ' hover:brightness-95'}`}
                onClick={() => selectItem(resource.id, 'resource')}
              >
                <td className="px-3 py-2 text-sm">
                  <span className="flex items-center gap-1">
                    {index + 1}
                    <span className={`w-2 h-2 rounded-full ${
                      resource.type === 'labor' ? 'bg-blue-500' :
                      resource.type === 'material' ? 'bg-green-500' : 'bg-orange-500'
                    }`}></span>
                  </span>
                </td>
                <td className="px-3 py-2 text-sm font-mono text-gray-600">{resource.originIndex.index || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-800">{resource.name}</td>
                <td className="px-3 py-2 text-sm text-right text-gray-600">{resource.unit.label}</td>
                <td className="px-3 py-2 text-sm text-right text-gray-600">{formatNumber(resource.unitPrice.value, 3)}</td>
                <td className="px-3 py-2 text-sm text-right text-gray-600">{formatNumber(resQuantity, 2)}</td>
                <td className="px-3 py-2 text-sm text-right font-medium">{formatNumber(resResult?.totalCost || 0, 2)}</td>
                <td className="px-3 py-2 text-sm text-right text-gray-500">{formatNumber(0, 3)}</td>
                <td className="px-3 py-2 text-sm text-right text-gray-600">{formatNumber(resQuantity, 3)}</td>
              </tr>
            );
          })}
        </React.Fragment>
      );
    }

    // Kosztorys view (default) - matching eKosztorysowanie layout
    const sectionPrefix = sectionId ? 'd.1.' : 'd.';

    // Handle position click - only select, don't toggle expand (expand only via chevron)
    const handlePositionClick = () => {
      selectItem(position.id, 'position');
    };

    return (
      <React.Fragment key={position.id}>
        {/* Position row */}
        <tr
          ref={(el) => { rowRefs.current[position.id] = el; }}
          className={`border-b border-gray-100 cursor-pointer ${depthColors.border} ${isSelected ? 'bg-blue-100' : depthColors.bg + ' hover:brightness-95'} ${highlightedItemId === position.id ? 'animate-pulse ring-2 ring-yellow-400 bg-yellow-50' : ''}`}
          onClick={handlePositionClick}
        >
          <td className="px-3 py-2 text-sm align-top">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {position.resources.length > 0 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpandPosition(position.id); }}
                    className="p-0.5 hover:bg-gray-200 rounded"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>
                ) : (
                  <span className="w-5 h-4" />
                )}
                <span
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${isExpanded ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-600 text-blue-600'}`}
                >
                  {positionNumber}
                </span>
              </div>
              <span className="text-xs text-gray-400 mt-0.5">{sectionPrefix}{positionNumber}</span>
            </div>
          </td>
          <td className="px-3 py-2 text-sm align-top">
            <div className="text-xs text-gray-800 font-mono">{position.base || ''}</div>
            {position.marker && (
              <span className="mt-1 inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded border border-gray-200">
                {POSITION_TAGS.find(t => t.id === position.marker)?.label || position.marker}
              </span>
            )}
          </td>
          <td className="px-3 py-2 text-sm align-top">
            <div className="font-medium text-gray-900">{position.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Przedmiar z sumami = {formatNumber(quantity, 2)} {position.unit.label}
            </div>
          </td>
          <td className="px-3 py-2 text-sm text-right text-gray-600 align-top">{position.unit.label}</td>
          <td className="px-3 py-2 text-sm text-right text-gray-600 align-top">{formatNumber(quantity, 2)}</td>
          <td className="px-3 py-2 text-sm text-right text-gray-600 align-top">{formatNumber(result?.unitCost || 0, 3)}</td>
          <td className="px-3 py-2 text-sm text-right align-top"></td>
          <td className="px-3 py-2 text-sm text-right align-top"></td>
          <td className="px-3 py-2 text-sm text-right align-top"></td>
        </tr>

        {/* Resources rows when expanded */}
        {isExpanded && position.resources.map((resource, index) => {
          const config = RESOURCE_TYPE_CONFIG[resource.type] || RESOURCE_TYPE_CONFIG.material;
          const resResult = result?.resources.find(r => r.id === resource.id);
          const isResourceSelected = editorState.selectedItemId === resource.id;
          const resQuantity = resResult?.calculatedQuantity || resource.norm.value * quantity;

          // Calculate values for R, M, S columns
          const rValue = resource.type === 'labor' ? resResult?.calculatedValue || 0 : 0;
          const mValue = resource.type === 'material' ? resResult?.calculatedValue || 0 : 0;
          const sValue = resource.type === 'equipment' ? resResult?.calculatedValue || 0 : 0;

          return (
            <React.Fragment key={resource.id}>
              {/* R/M/S badge row */}
              <tr className="border-b border-gray-50">
                <td className="px-3 py-0.5"></td>
                <td className="px-3 py-0.5" colSpan={8}>
                  <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded border border-gray-200">
                    {config.shortLabel}
                  </span>
                </td>
              </tr>
              {/* Resource data row */}
              <tr
                ref={(el) => { rowRefs.current[resource.id] = el; }}
                className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isResourceSelected ? 'bg-blue-50' : ''} ${highlightedItemId === resource.id ? 'animate-pulse ring-2 ring-yellow-400 bg-yellow-50' : ''}`}
                onClick={() => selectItem(resource.id, 'resource')}
              >
                <td className="px-3 py-1.5 text-sm">
                  <span className="flex items-center gap-0.5">
                    <span className="text-gray-600">{index + 1}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      resource.type === 'labor' ? 'bg-blue-500' :
                      resource.type === 'material' ? 'bg-green-500' : 'bg-orange-500'
                    }`}></span>
                  </span>
                </td>
                <td className="px-3 py-1.5 text-sm font-mono text-gray-600">{resource.originIndex.index || ''}</td>
                <td className="px-3 py-1.5 text-sm">
                  <div className="text-gray-800">{resource.name}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {resource.factor !== 1 ? `${formatNumber(resource.factor, 1)} · ` : ''}
                    {formatNumber(resource.norm.value, 2)} · {formatNumber(quantity, 2)}{resource.unit.label}/{position.unit.label} · {formatNumber(resource.unitPrice.value, 2)}PLN/{resource.unit.label}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-sm text-right text-gray-500">{resource.unit.label}</td>
                <td className="px-3 py-1.5 text-sm text-right text-gray-600">{formatNumber(resQuantity, 1)}</td>
                <td className="px-3 py-1.5 text-sm text-right text-gray-600">{formatNumber(resResult?.calculatedValue || 0, 3)}</td>
                <td className="px-3 py-1.5 text-sm text-right text-gray-600">{rValue > 0 ? formatNumber(rValue, 2) : ''}</td>
                <td className="px-3 py-1.5 text-sm text-right text-gray-600">{mValue > 0 ? formatNumber(mValue, 2) : ''}</td>
                <td className="px-3 py-1.5 text-sm text-right text-gray-600">{sValue > 0 ? formatNumber(sValue, 2) : ''}</td>
              </tr>
            </React.Fragment>
          );
        })}

        {/* Summary rows when expanded */}
        {isExpanded && (
          <>
            <tr className="border-b border-gray-100">
              <td colSpan={5}></td>
              <td className="px-3 py-1 text-xs text-right text-gray-500">RAZEM: {formatNumber(quantity, 1)}</td>
              <td colSpan={3}></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td colSpan={5} className="px-3 py-1 text-xs text-gray-600 text-right">Razem koszty bezpośrednie</td>
              <td className="px-3 py-1 text-xs text-right">{formatNumber(result?.directCostsTotal || 0, 3)}</td>
              <td className="px-3 py-1 text-xs text-right text-gray-500">{formatNumber(0, 3)}</td>
              <td className="px-3 py-1 text-xs text-right">{formatNumber(result?.directCostsTotal || 0, 2)}</td>
              <td></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td colSpan={5} className="px-3 py-1 text-xs text-gray-600 text-right">Razem z narzutami</td>
              <td className="px-3 py-1 text-xs text-right">{formatNumber(result?.totalWithOverheads || 0, 3)}</td>
              <td className="px-3 py-1 text-xs text-right text-gray-500">{formatNumber(0, 3)}</td>
              <td className="px-3 py-1 text-xs text-right">{formatNumber(result?.totalWithOverheads || 0, 2)}</td>
              <td></td>
            </tr>
            <tr className="border-b border-gray-200">
              <td colSpan={5} className="px-3 py-1 text-xs text-gray-600 text-right font-medium">Cena jednostkowa</td>
              <td className="px-3 py-1 text-xs text-right font-medium text-blue-600">{formatNumber(result?.unitCost || 0, 3)}</td>
              <td colSpan={3}></td>
            </tr>
          </>
        )}
      </React.Fragment>
    );
  };

  // Render section (with recursive subsections)
  const renderSection = (section: KosztorysSection, sectionIndex: number, depth: number = 0) => {
    const isExpanded = editorState.expandedSections.has(section.id);
    const isSelected = editorState.selectedItemId === section.id;
    const sectionResult = calculationResult?.sections[section.id];
    const hasSubsections = section.subsectionIds && section.subsectionIds.length > 0;
    const hasPositions = section.positionIds && section.positionIds.length > 0;
    const depthColors = getDepthColors(depth);

    // Determine colspan based on view mode
    const colspan = viewMode === 'przedmiar' ? 4 : viewMode === 'pozycje' ? 5 : viewMode === 'naklady' ? 7 : viewMode === 'kosztorys' ? 7 : 5;

    // Indentation based on depth
    const indentPadding = depth * 16;

    // Pozycje view - matching eKosztorysowanie reference
    if (viewMode === 'pozycje') {
      return (
        <React.Fragment key={section.id}>
          {/* Section header row */}
          <tr
            className={`cursor-pointer ${depthColors.border} ${isSelected ? 'bg-blue-200 ring-2 ring-inset ring-blue-400' : depthColors.headerBg + ' hover:brightness-95'}`}
            onClick={() => selectItem(section.id, 'section')}
          >
            <td className="px-3 py-3 text-sm border border-gray-300" style={{ paddingLeft: `${12 + indentPadding}px` }}>
              {(hasSubsections || hasPositions) && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpandSection(section.id); }}
                  className="p-0.5 hover:bg-white/50 rounded"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-600" /> : <ChevronRight className="w-4 h-4 text-gray-600" />}
                </button>
              )}
            </td>
            <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">{section.ordinalNumber}</td>
            <td colSpan={5} className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">{section.name}</td>
          </tr>

          {/* Subsections (rendered recursively) */}
          {isExpanded && section.subsectionIds?.map((subsectionId, subIndex) => {
            const subsection = estimateData.sections[subsectionId];
            if (!subsection) return null;
            return renderSection(subsection, subIndex, depth + 1);
          })}

          {/* Positions in section */}
          {isExpanded && section.positionIds.map((posId, posIndex) => {
            const position = estimateData.positions[posId];
            if (!position) return null;
            return renderPositionRow(position, posIndex + 1, section.id, depth);
          })}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={section.id}>
        {/* Section header row */}
        <tr
          className={`border-b border-gray-200 cursor-pointer ${depthColors.border} ${isSelected ? 'bg-blue-200 ring-2 ring-inset ring-blue-400' : depthColors.headerBg + ' hover:brightness-95'}`}
          onClick={() => selectItem(section.id, 'section')}
        >
          <td className="px-3 py-2 text-sm" style={{ paddingLeft: `${12 + indentPadding}px` }}>
            {(hasSubsections || hasPositions) && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpandSection(section.id); }}
                className="p-0.5 hover:bg-white/50 rounded"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-600" /> : <ChevronRight className="w-4 h-4 text-gray-600" />}
              </button>
            )}
          </td>
          <td className="px-3 py-2 text-sm font-semibold text-gray-900">{section.ordinalNumber}</td>
          <td colSpan={colspan} className="px-3 py-2 text-sm font-semibold text-gray-900">{section.name}</td>
        </tr>

        {/* Subsections (rendered recursively) */}
        {isExpanded && section.subsectionIds?.map((subsectionId, subIndex) => {
          const subsection = estimateData.sections[subsectionId];
          if (!subsection) return null;
          return renderSection(subsection, subIndex, depth + 1);
        })}

        {/* Positions in section */}
        {isExpanded && section.positionIds.map((posId, posIndex) => {
          const position = estimateData.positions[posId];
          if (!position) return null;
          return renderPositionRow(position, posIndex + 1, section.id, depth);
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
    <div className="h-full flex flex-col bg-white relative">
      {/* Single Toolbar Row */}
      <div className="bg-white border-b border-gray-200 px-2 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* Powrót button */}
          <button
            onClick={() => {
              if (editorState.isDirty) {
                setShowExitConfirmModal(true);
              } else {
                navigate('/construction/estimates');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Powrót
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Mode selection dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100 rounded"
            >
              <Menu className="w-4 h-4" />
              {leftPanelMode === 'export' ? 'Wydruki' :
               viewMode === 'przedmiar' ? 'Przedmiar' :
               viewMode === 'kosztorys' ? 'Kosztorys' :
               viewMode === 'pozycje' ? 'Pozycje' :
               viewMode === 'naklady' ? 'Nakłady' :
               viewMode === 'narzuty' ? 'Narzuty' :
               viewMode === 'zestawienia' ? 'Zestawienia' : 'Kosztorys'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showModeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => { setViewMode('przedmiar'); setActiveNavItem('przedmiar'); setLeftPanelMode('overview'); setShowModeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${viewMode === 'przedmiar' && leftPanelMode !== 'export' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <List className="w-4 h-4" />
                  Przedmiar
                </button>
                <button
                  onClick={() => { setViewMode('kosztorys'); setActiveNavItem('kosztorysy'); setLeftPanelMode('overview'); setShowModeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${viewMode === 'kosztorys' && leftPanelMode !== 'export' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <FileBarChart className="w-4 h-4" />
                  Kosztorys
                </button>
                <button
                  onClick={() => { setViewMode('pozycje'); setActiveNavItem('pozycje'); setLeftPanelMode('overview'); setShowModeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${viewMode === 'pozycje' && leftPanelMode !== 'export' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <LayoutList className="w-4 h-4" />
                  Pozycje
                </button>
                <button
                  onClick={() => { setViewMode('naklady'); setActiveNavItem('naklady'); setLeftPanelMode('overview'); setShowModeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${viewMode === 'naklady' && leftPanelMode !== 'export' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <Layers className="w-4 h-4" />
                  Nakłady
                </button>
                <button
                  onClick={() => { setViewMode('narzuty'); setActiveNavItem('narzuty'); setLeftPanelMode('overview'); setShowModeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${viewMode === 'narzuty' && leftPanelMode !== 'export' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <Percent className="w-4 h-4" />
                  Narzuty
                </button>
                <button
                  onClick={() => { setViewMode('zestawienia'); setActiveNavItem('zestawienia'); setLeftPanelMode('overview'); setShowModeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${viewMode === 'zestawienia' && leftPanelMode !== 'export' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <Table2 className="w-4 h-4" />
                  Zestawienia
                </button>
                <div className="border-t border-gray-200" />
                <button
                  onClick={() => { setLeftPanelMode('export'); setActiveNavItem('wydruki'); setShowModeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${leftPanelMode === 'export' ? 'bg-blue-50 text-blue-600' : ''}`}
                >
                  <Printer className="w-4 h-4" />
                  Wydruki
                </button>
              </div>
            )}
          </div>


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
                <button
                  onClick={() => { handleAddSubsection(); setShowDzialDropdown(false); }}
                  disabled={editorState.selectedItemType !== 'section'}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    editorState.selectedItemType === 'section'
                      ? 'hover:bg-gray-50'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  + Poddział {editorState.selectedItemType !== 'section' && '(wybierz dział)'}
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

        {/* Right side - Weryfikuj, Widok, Settings, Zapisz */}
        <div className="flex items-center gap-1">
          {/* Weryfikuj button */}
          <button
            onClick={handleSprawdzKosztorys}
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            <Sparkles className="w-4 h-4" />
            Weryfikuj
          </button>

          {/* Widok button - opens right panel */}
          <button
            onClick={() => setRightPanelMode(rightPanelMode === 'viewOptions' ? 'closed' : 'viewOptions')}
            className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded ${
              rightPanelMode === 'viewOptions' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Opcje widoku"
          >
            <Eye className="w-4 h-4" />
            Widok
          </button>

          {/* Settings icon - opens right panel */}
          <button
            onClick={() => setRightPanelMode(rightPanelMode === 'settings' ? 'closed' : 'settings')}
            className={`p-1.5 rounded ${rightPanelMode === 'settings' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Ustawienia"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Zapisz icon */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            title="Zapisz"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
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
      {(showDzialDropdown || showNakladDropdown || showKomentarzeDropdown || showUsunDropdown || showPrzesunDropdown || showUzupelnijDropdown || showKNRDropdown || showTagDropdown) && (
        <div className="fixed inset-0 z-40" onClick={() => {
          setShowDzialDropdown(false);
          setShowNakladDropdown(false);
          setShowKomentarzeDropdown(false);
          setShowUsunDropdown(false);
          setShowPrzesunDropdown(false);
          setShowUzupelnijDropdown(false);
          setShowTagDropdown(false);
          setTagSearch('');
          setShowKNRDropdown(false);
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
                leftPanelMode === 'properties' || leftPanelMode === 'settings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'
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

                  {/* Empty state */}
                  {estimateData.root.sectionIds.length === 0 && (
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

                    {/* Znacznik (Tag) - dropdown with search */}
                    <div className="relative">
                      <button
                        onClick={() => setShowTagDropdown(!showTagDropdown)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded border border-gray-200 hover:bg-gray-200"
                      >
                        {(selectedItem as KosztorysPosition).marker ? (
                          POSITION_TAGS.find(t => t.id === (selectedItem as KosztorysPosition).marker)?.label || 'Znacznik'
                        ) : (
                          <span className="text-gray-400">Znacznik <span className="text-blue-500">wpisz...</span></span>
                        )}
                      </button>
                      {showTagDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={tagSearch}
                                onChange={e => setTagSearch(e.target.value)}
                                placeholder="Wyszukaj znacznik"
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {/* Clear tag option */}
                            {(selectedItem as KosztorysPosition).marker && (
                              <button
                                onClick={() => {
                                  handleUpdateSelectedItem({ marker: null });
                                  setShowTagDropdown(false);
                                  setTagSearch('');
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 italic"
                              >
                                Usuń znacznik
                              </button>
                            )}
                            {POSITION_TAGS
                              .filter(tag => tag.label.toLowerCase().includes(tagSearch.toLowerCase()))
                              .map(tag => (
                                <button
                                  key={tag.id}
                                  onClick={() => {
                                    handleUpdateSelectedItem({ marker: tag.id });
                                    setShowTagDropdown(false);
                                    setTagSearch('');
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                    (selectedItem as KosztorysPosition).marker === tag.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                                  }`}
                                >
                                  {tag.label}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
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
                  onChange={(e) => {
                    const newTemplate = e.target.value as ExportTemplate;
                    setExportTemplate(newTemplate);
                    // Set pages based on template
                    const templatePageIds = TEMPLATE_PAGES[newTemplate] || [];
                    const newPages = templatePageIds.map(id => {
                      const page = ALL_EXPORT_PAGES.find(p => p.id === id);
                      return page ? { ...page } : null;
                    }).filter((p): p is ExportPage => p !== null);
                    setExportPages(newPages);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3"
                >
                  <option value="niestandardowy">Niestandardowy</option>
                  <option value="kosztorys_ofertowy">Kosztorys ofertowy</option>
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

                {/* Kolejność stron label */}
                <p className="text-xs text-gray-500 mb-2">Kolejność stron</p>

                {/* Draggable export pages list - full drag-and-drop support */}
                <div className="flex-1 overflow-y-auto space-y-1">
                  {exportPages.length === 0 ? (
                    <div className="text-center text-gray-400 text-xs py-4">
                      Brak stron do wydruku
                    </div>
                  ) : exportPages
                    .filter(p => !exportSearch || p.label.toLowerCase().includes(exportSearch.toLowerCase()))
                    .map((page, index) => (
                    <div
                      key={page.id}
                      className={`outline-none bg-white hover:bg-gray-50 flex items-center gap-2 rounded p-2 border focus-visible:border-gray-600 text-xs text-left cursor-grab transition-all ${
                        page.enabled ? 'border-gray-300' : 'border-gray-200 bg-gray-50 opacity-60'
                      } ${draggedExportPageId === page.id ? 'opacity-50 scale-95' : ''} ${activeExportSection === page.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
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
                        onChange={(e) => {
                          e.stopPropagation();
                          const newPages = [...exportPages];
                          const actualIndex = exportPages.findIndex(p => p.id === page.id);
                          newPages[actualIndex] = { ...page, enabled: !page.enabled };
                          setExportPages(newPages);
                        }}
                        className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                      />
                      <span
                        className="flex-1 text-xs text-gray-800 truncate cursor-pointer hover:text-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (page.enabled) {
                            scrollToExportSection(page.id);
                          }
                        }}
                      >
                        {page.label}
                      </span>
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
                <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2 relative">
                  <div className="flex-1 relative">
                    <button
                      onClick={() => setShowAddPageDropdown(!showAddPageDropdown)}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4" />
                      Dodaj
                    </button>

                    {/* Dropdown with available pages */}
                    {showAddPageDropdown && (
                      <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto min-w-[280px]">
                        <div className="p-2 space-y-0.5">
                          {ALL_EXPORT_PAGES
                            .filter(page => !exportPages.some(p => p.id === page.id))
                            .map(page => (
                              <label key={page.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => {
                                    // Immediately add page to list
                                    const pageToAdd = ALL_EXPORT_PAGES.find(p => p.id === page.id);
                                    if (pageToAdd) {
                                      setExportPages([...exportPages, { ...pageToAdd }]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                                />
                                <span className="text-sm text-gray-800">{page.label}</span>
                              </label>
                            ))}
                          {ALL_EXPORT_PAGES.filter(page => !exportPages.some(p => p.id === page.id)).length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-2">Wszystkie strony zostały dodane</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handlePrintDocument}
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
                      <div className="w-20">
                        <label className="text-xs text-gray-500">j.m.</label>
                        <select
                          value={catalogUnitIndex}
                          onChange={e => setCatalogUnitIndex(e.target.value)}
                          className="w-full px-1 py-1.5 text-xs border border-gray-400 rounded focus:ring-1 focus:ring-blue-400 focus:outline-none bg-white"
                        >
                          {UNITS_REFERENCE.map(unit => (
                            <option key={unit.index} value={unit.index}>{unit.unit}</option>
                          ))}
                        </select>
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

            {/* Title Page Editor - Strona tytułowa */}
            {leftPanelMode === 'titlePageEditor' && (
              <div className="p-3 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Strona tytułowa</h3>
                  <button
                    onClick={() => setLeftPanelMode('export')}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    ← Powrót do wydruku
                  </button>
                </div>

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

            {/* Settings panel */}
            {leftPanelMode === 'settings' && estimate && (
              <div className="p-3 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Ustawienia kosztorysu</h3>
                  <button onClick={() => setLeftPanelMode('overview')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 flex-1">
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
                          name="settingsEstimateType"
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
                          name="settingsEstimateType"
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

                  {/* Kalkulacje */}
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

                  {/* Dokładność */}
                  <div className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Dokładność</h4>
                    <div className="space-y-2">
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
                          <span className="w-6 text-center text-sm">{estimate.settings.precision.norms}</span>
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
                          <span className="w-6 text-center text-sm">{estimate.settings.precision.unitValues}</span>
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
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="pt-3 border-t border-gray-200 flex gap-2 mt-auto">
                  <button
                    onClick={() => setLeftPanelMode('overview')}
                    className="flex-1 px-3 py-2 text-sm text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={() => {
                      setEditorState(prev => ({ ...prev, isDirty: true }));
                      setLeftPanelMode('overview');
                      showNotificationMessage('Ustawienia zapisane', 'success');
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Zapisz ustawienia
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          {/* Narzuty View - matching eKosztorysowanie layout */}
          {viewMode === 'narzuty' && leftPanelMode !== 'export' && (
            <div className="p-4 space-y-6">
              {/* Koszt zakupu materiałów */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Koszt zakupu materiałów</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 w-12">L.p.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Nazwa</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Skrót</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Stawka</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Grupa</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Od materiałów</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimateData.root.overheads.filter(o => o.type === 'purchase_costs').map((overhead, index) => (
                      <tr key={overhead.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">{overhead.name || 'Koszty zakupu'}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">Kz</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">{overhead.value}%</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">-</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">✓</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Narzuty procentowe działów i pozycji */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Narzuty procentowe działów i pozycji</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 w-12">L.p.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Nazwa</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Skrót</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Stawka</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-20">Od robocizny</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Od materiałów</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-20">Od sprzętu</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Obliczane od</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Ust. na poziomie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimateData.root.overheads.filter(o => o.type === 'indirect_costs' || o.type === 'profit').map((overhead, index) => (
                      <tr key={overhead.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">
                          {overhead.type === 'indirect_costs' ? 'Koszty pośrednie' : 'Zysk'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">
                          {overhead.type === 'indirect_costs' ? 'Kp' : 'Z'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">{overhead.value}%</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">
                          {overhead.base === 'labor' || overhead.base === 'labor_and_equipment' ? '✓' : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">-</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">
                          {overhead.base === 'equipment' || overhead.base === 'labor_and_equipment' ? '✓' : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">R+S</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">kosztorys</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Dodatki */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Dodatki</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 w-12">L.p.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Nazwa</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Skrót</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Stawka</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Obliczane od</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24"></th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24"></th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Ust. na poziomie</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-sm text-gray-400 text-center">
                        Brak dodatków
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* VAT */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">VAT</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 w-12">L.p.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Nazwa</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Skrót</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-16">Stawka</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-20">Od robocizny</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Od materiałów</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-20">Od sprzętu</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Obliczane od</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 w-24">Ust. na poziomie</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-sm text-gray-400 text-center">
                        Brak stawek VAT
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Zestawienia View - matching eKosztorysowanie summary layout */}
          {viewMode === 'zestawienia' && leftPanelMode !== 'export' && (
            <div className="p-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nazwa</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Razem</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">R</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">M</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">S</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-800">Koszty bezpośrednie</td>
                    <td className="px-3 py-2 text-sm text-right font-medium">
                      {formatNumber(calculationResult?.directCostsTotal || 0, 2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-600">
                      {formatNumber(calculationResult?.laborTotal || 0, 2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-600">
                      {formatNumber(calculationResult?.materialTotal || 0, 2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-600">
                      {formatNumber(calculationResult?.equipmentTotal || 0, 2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Print Document Preview - shown when in export mode or title page editor */}
          {(leftPanelMode === 'export' || leftPanelMode === 'titlePageEditor') && (
            <div ref={printPreviewRef} className="bg-gray-100 min-h-full p-8">
              <div className="max-w-4xl mx-auto bg-white shadow-lg">
                {exportPages.filter(p => p.enabled).map((page, pageIndex) => {
                  const today = new Date().toLocaleDateString('pl-PL');

                  // Render each page type
                  if (page.type === 'strona_tytulowa') {
                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 min-h-[800px] ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="title-page-content">
                          {/* Company header - top right */}
                          {(titlePageData.companyName || titlePageData.companyAddress) && (
                            <div className="company-header">
                              {titlePageData.companyName && <div className="font-medium">{titlePageData.companyName}</div>}
                              {titlePageData.companyAddress && <div>{titlePageData.companyAddress}</div>}
                            </div>
                          )}

                          {/* Title */}
                          <h1 className="main-title">{titlePageData.title || estimate?.settings.name || ''}</h1>

                          {/* Details section */}
                          <div className="details-section">
                            {/* Order info group */}
                            {(titlePageData.orderName || titlePageData.orderAddress) && (
                              <div className="detail-group">
                                {titlePageData.orderName && (
                                  <div className="detail-row">
                                    <span className="detail-label">Nazwa zamówienia:</span>
                                    <span className="detail-value">{titlePageData.orderName}</span>
                                  </div>
                                )}
                                {titlePageData.orderAddress && (
                                  <div className="detail-row">
                                    <span className="detail-label">Adres obiektu budowlanego:</span>
                                    <span className="detail-value">{titlePageData.orderAddress}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Client info group */}
                            {(titlePageData.clientName || titlePageData.clientAddress) && (
                              <div className="detail-group">
                                {titlePageData.clientName && (
                                  <div className="detail-row">
                                    <span className="detail-label">Zamawiający:</span>
                                    <span className="detail-value">{titlePageData.clientName}</span>
                                  </div>
                                )}
                                {titlePageData.clientAddress && (
                                  <div className="detail-row">
                                    <span className="detail-label">Adres zamawiającego:</span>
                                    <span className="detail-value">{titlePageData.clientAddress}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Contractor info group */}
                            {(titlePageData.contractorName || titlePageData.contractorAddress) && (
                              <div className="detail-group">
                                {titlePageData.contractorName && (
                                  <div className="detail-row">
                                    <span className="detail-label">Wykonawca:</span>
                                    <span className="detail-value">{titlePageData.contractorName}</span>
                                  </div>
                                )}
                                {titlePageData.contractorAddress && (
                                  <div className="detail-row">
                                    <span className="detail-label">Adres wykonawcy:</span>
                                    <span className="detail-value">{titlePageData.contractorAddress}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Industry */}
                            {titlePageData.industry && (
                              <div className="detail-group">
                                <div className="detail-row">
                                  <span className="detail-label">Branża:</span>
                                  <span className="detail-value">{titlePageData.industry}</span>
                                </div>
                              </div>
                            )}

                            {/* Prepared/Checked by group */}
                            {(titlePageData.preparedBy || titlePageData.checkedBy) && (
                              <div className="detail-group">
                                {titlePageData.preparedBy && (
                                  <div className="detail-row">
                                    <span className="detail-label">Sporządził kosztorys:</span>
                                    <span className="detail-value">{titlePageData.preparedBy}{titlePageData.preparedByIndustry ? ` (branża ${titlePageData.preparedByIndustry})` : ''}</span>
                                  </div>
                                )}
                                {titlePageData.checkedBy && (
                                  <div className="detail-row">
                                    <span className="detail-label">Sprawdził przedmiar:</span>
                                    <span className="detail-value">{titlePageData.checkedBy}{titlePageData.checkedByIndustry ? ` (branża ${titlePageData.checkedByIndustry})` : ''}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Dates section */}
                          <div className="dates-section">
                            <div className="dates-row">
                              <div className="date-block">
                                <div className="date-label">Data opracowania:</div>
                                <div>{titlePageData.preparedDate || today}</div>
                              </div>
                              <div className="date-block">
                                <div className="date-label">Data zatwierdzenia:</div>
                                <div>{titlePageData.approvedDate || today}</div>
                              </div>
                            </div>
                          </div>

                          {/* Page number */}
                          <div className="page-number">
                            {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (page.type === 'kosztorys_ofertowy') {
                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="text-sm text-gray-600 mb-2">{titlePageData.title || estimate?.settings.name || ''}</div>
                        <h2 className="text-lg font-bold mb-6">Kosztorys ofertowy</h2>

                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border border-gray-400">
                              <th className="border border-gray-400 px-2 py-1 text-left w-14">Lp.</th>
                              <th className="border border-gray-400 px-2 py-1 text-left w-24">Podstawa</th>
                              <th className="border border-gray-400 px-2 py-1 text-left">Nazwa</th>
                              <th className="border border-gray-400 px-2 py-1 text-center w-12">j.m.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-16">Nakład</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-20">Koszt jedn.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-12">R</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-12">M</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-12">S</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Sections */}
                            {estimateData.root.sectionIds.map((sectionId, sIdx) => {
                              const section = estimateData.sections[sectionId];
                              if (!section) return null;
                              return (
                                <React.Fragment key={sectionId}>
                                  <tr className="border border-gray-400">
                                    <td className="border border-gray-400 px-2 py-1 font-medium">{sIdx + 1}</td>
                                    <td className="border border-gray-400 px-2 py-1"></td>
                                    <td className="border border-gray-400 px-2 py-1 font-medium" colSpan={7}>{section.name}</td>
                                  </tr>
                                  {section.positionIds.map((posId, pIdx) => {
                                    const position = estimateData.positions[posId];
                                    if (!position) return null;
                                    const result = calculationResult?.positions[posId];
                                    const quantity = result?.quantity || 0;
                                    return (
                                      <tr key={posId} className="border border-gray-400">
                                        <td className="border border-gray-400 px-2 py-1 align-top">
                                          <div className="flex flex-col items-center">
                                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{pIdx + 1}</span>
                                            <span className="text-xs text-gray-500">d.{sIdx + 1}.{pIdx + 1}</span>
                                          </div>
                                        </td>
                                        <td className="border border-gray-400 px-2 py-1 text-xs font-mono align-top">{position.base}</td>
                                        <td className="border border-gray-400 px-2 py-1 align-top">
                                          <div className="font-medium">{position.name}</div>
                                          <div className="text-xs text-gray-500">Przedmiar z sumami = {formatNumber(quantity, 2)} {position.unit.label}</div>
                                        </td>
                                        <td className="border border-gray-400 px-2 py-1 text-center align-top">{position.unit.label}</td>
                                        <td className="border border-gray-400 px-2 py-1 text-right align-top">{formatNumber(quantity, 2)}</td>
                                        <td className="border border-gray-400 px-2 py-1 text-right align-top">{formatNumber(result?.unitCost || 0, 3)}</td>
                                        <td className="border border-gray-400 px-2 py-1 text-right align-top"></td>
                                        <td className="border border-gray-400 px-2 py-1 text-right align-top"></td>
                                        <td className="border border-gray-400 px-2 py-1 text-right align-top"></td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="text-right text-xs text-gray-400 mt-8">
                          {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                        </div>
                      </div>
                    );
                  }

                  if (page.type === 'przedmiar') {
                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="text-sm text-gray-600 mb-2">{titlePageData.title || estimate?.settings.name || ''}</div>
                        <h2 className="text-lg font-bold mb-6">Przedmiar robót</h2>

                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border border-gray-400">
                              <th className="border border-gray-400 px-2 py-1 text-left w-14">L.p.</th>
                              <th className="border border-gray-400 px-2 py-1 text-left w-28">Podstawa</th>
                              <th className="border border-gray-400 px-2 py-1 text-left">Nakład</th>
                              <th className="border border-gray-400 px-2 py-1 text-center w-12">j.m.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-20">Poszczególne</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-16">Razem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estimateData.root.sectionIds.map((sectionId, sIdx) => {
                              const section = estimateData.sections[sectionId];
                              if (!section) return null;
                              return (
                                <React.Fragment key={sectionId}>
                                  <tr className="border border-gray-400">
                                    <td className="border border-gray-400 px-2 py-1 font-medium">{sIdx + 1}</td>
                                    <td className="border border-gray-400 px-2 py-1" colSpan={5}>
                                      <span className="font-medium">{section.name}</span>
                                    </td>
                                  </tr>
                                  {section.positionIds.map((posId, pIdx) => {
                                    const position = estimateData.positions[posId];
                                    if (!position) return null;
                                    const result = calculationResult?.positions[posId];
                                    const quantity = result?.quantity || 0;
                                    return (
                                      <React.Fragment key={posId}>
                                        <tr className="border border-gray-400">
                                          <td className="border border-gray-400 px-2 py-1 align-top">
                                            <div className="flex flex-col items-center">
                                              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{pIdx + 1}</span>
                                              <span className="text-xs text-gray-500">d.{sIdx + 1}.{pIdx + 1}</span>
                                            </div>
                                          </td>
                                          <td className="border border-gray-400 px-2 py-1 text-xs font-mono align-top">{position.base}</td>
                                          <td className="border border-gray-400 px-2 py-1 font-medium align-top">{position.name}</td>
                                          <td className="border border-gray-400 px-2 py-1 text-center align-top">{position.unit.label}</td>
                                          <td className="border border-gray-400 px-2 py-1 text-right align-top"></td>
                                          <td className="border border-gray-400 px-2 py-1 text-right align-top"></td>
                                        </tr>
                                        {position.measurements.rootIds.map((measureId) => {
                                          const measure = position.measurements.entries[measureId];
                                          if (!measure) return null;
                                          const measureValue = evaluateMeasurementExpression(measure.expression) || 0;
                                          return (
                                            <tr key={measureId} className="border border-gray-400">
                                              <td className="border border-gray-400 px-2 py-1"></td>
                                              <td className="border border-gray-400 px-2 py-1 text-gray-500">{measure.description || ''}</td>
                                              <td className="border border-gray-400 px-2 py-1 text-gray-600">{measure.expression || ''}</td>
                                              <td className="border border-gray-400 px-2 py-1 text-center">{position.unit.label}</td>
                                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(measureValue, 2)}</td>
                                              <td className="border border-gray-400 px-2 py-1"></td>
                                            </tr>
                                          );
                                        })}
                                        <tr className="border border-gray-400">
                                          <td className="border border-gray-400 px-2 py-1" colSpan={4}></td>
                                          <td className="border border-gray-400 px-2 py-1 text-right font-medium">Razem</td>
                                          <td className="border border-gray-400 px-2 py-1 text-right font-medium">{formatNumber(quantity, 2)}</td>
                                        </tr>
                                      </React.Fragment>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="text-right text-xs text-gray-400 mt-8">
                          {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                        </div>
                      </div>
                    );
                  }

                  if (page.type === 'tabela_elementow') {
                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="text-sm text-gray-600 mb-2">{titlePageData.title || estimate?.settings.name || ''}</div>
                        <h2 className="text-lg font-bold mb-6">Tabela elementów scalonych</h2>

                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border border-gray-400">
                              <th className="border border-gray-400 px-2 py-1 text-left w-10">Lp.</th>
                              <th className="border border-gray-400 px-2 py-1 text-left">Nazwa</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-20">Uproszczone</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-24">Robocizna</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-24">Materiały</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-24">Sprzęt</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-16">Odpady</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-24">Razem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {estimateData.root.sectionIds.map((sectionId, sIdx) => {
                              const section = estimateData.sections[sectionId];
                              if (!section) return null;
                              const sectionResult = calculationResult?.sections[sectionId];
                              return (
                                <tr key={sectionId} className="border border-gray-400">
                                  <td className="border border-gray-400 px-2 py-1">{sIdx + 1}</td>
                                  <td className="border border-gray-400 px-2 py-1">{section.name}</td>
                                  <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(0, 2)}</td>
                                  <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(sectionResult?.laborTotal || 0, 2)}</td>
                                  <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(sectionResult?.materialTotal || 0, 2)}</td>
                                  <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(sectionResult?.equipmentTotal || 0, 2)}</td>
                                  <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(0, 2)}</td>
                                  <td className="border border-gray-400 px-2 py-1 text-right font-medium">{formatNumber(sectionResult?.totalWithOverheads || 0, 2)}</td>
                                </tr>
                              );
                            })}
                            <tr className="border border-gray-400 font-medium">
                              <td className="border border-gray-400 px-2 py-1"></td>
                              <td className="border border-gray-400 px-2 py-1">Kosztorys netto</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(0, 2)}</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(calculationResult?.laborTotal || 0, 2)}</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(calculationResult?.materialTotal || 0, 2)}</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(calculationResult?.equipmentTotal || 0, 2)}</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(0, 2)}</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(calculationResult?.totalValue || 0, 2)}</td>
                            </tr>
                            <tr className="border border-gray-400 font-medium">
                              <td className="border border-gray-400 px-2 py-1"></td>
                              <td className="border border-gray-400 px-2 py-1">Kosztorys brutto</td>
                              <td className="border border-gray-400 px-2 py-1" colSpan={5}></td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(calculationResult?.totalValue || 0, 2)}</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="mt-4 text-sm text-center">
                          Słownie: {formatCurrency(calculationResult?.totalValue || 0)}
                        </div>

                        <div className="text-right text-xs text-gray-400 mt-8">
                          {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                        </div>
                      </div>
                    );
                  }

                  if (page.type === 'zestawienie_robocizny') {
                    // Calculate labor summary
                    const laborItems: { name: string; unit: string; quantity: number; unitPrice: number; total: number }[] = [];
                    let laborTotal = 0;
                    Object.values(estimateData.positions).forEach(position => {
                      position.resources.filter(r => r.type === 'labor').forEach(resource => {
                        const result = calculationResult?.positions[position.id];
                        const quantity = result?.quantity || 0;
                        const resQuantity = resource.norm.value * quantity;
                        const total = resQuantity * resource.unitPrice.value;
                        laborItems.push({
                          name: resource.name,
                          unit: resource.unit.label,
                          quantity: resQuantity,
                          unitPrice: resource.unitPrice.value,
                          total
                        });
                        laborTotal += total;
                      });
                    });

                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="text-sm text-gray-600 mb-2">{titlePageData.title || estimate?.settings.name || ''}</div>
                        <h2 className="text-lg font-bold mb-6">Zestawienie robocizny</h2>

                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border border-gray-400">
                              <th className="border border-gray-400 px-2 py-1 text-left w-10">Lp.</th>
                              <th className="border border-gray-400 px-2 py-1 text-left">Opis</th>
                              <th className="border border-gray-400 px-2 py-1 text-center w-12">j.m.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-16">Ilość</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-20">Cena jedn.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-24">Wartość</th>
                            </tr>
                          </thead>
                          <tbody>
                            {laborItems.length > 0 ? laborItems.map((item, idx) => (
                              <tr key={idx} className="border border-gray-400">
                                <td className="border border-gray-400 px-2 py-1">{idx + 1}</td>
                                <td className="border border-gray-400 px-2 py-1">{item.name}</td>
                                <td className="border border-gray-400 px-2 py-1 text-center">{item.unit}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.quantity, 1)}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.unitPrice, 2)}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.total, 2)}</td>
                              </tr>
                            )) : (
                              <tr className="border border-gray-400">
                                <td colSpan={6} className="border border-gray-400 px-2 py-4 text-center text-gray-500">Brak robocizny</td>
                              </tr>
                            )}
                            <tr className="border border-gray-400 font-medium">
                              <td className="border border-gray-400 px-2 py-1" colSpan={4}></td>
                              <td className="border border-gray-400 px-2 py-1 text-right">Razem</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(laborTotal, 2)}</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="text-right text-xs text-gray-400 mt-8">
                          {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                        </div>
                      </div>
                    );
                  }

                  if (page.type === 'zestawienie_materialow') {
                    // Calculate materials summary
                    const materialItems: { name: string; unit: string; quantity: number; unitPrice: number; total: number }[] = [];
                    let materialTotal = 0;
                    Object.values(estimateData.positions).forEach(position => {
                      position.resources.filter(r => r.type === 'material').forEach(resource => {
                        const result = calculationResult?.positions[position.id];
                        const quantity = result?.quantity || 0;
                        const resQuantity = resource.norm.value * quantity;
                        const total = resQuantity * resource.unitPrice.value;
                        materialItems.push({
                          name: resource.name,
                          unit: resource.unit.label,
                          quantity: resQuantity,
                          unitPrice: resource.unitPrice.value,
                          total
                        });
                        materialTotal += total;
                      });
                    });

                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="text-sm text-gray-600 mb-2">{titlePageData.title || estimate?.settings.name || ''}</div>
                        <h2 className="text-lg font-bold mb-6">Zestawienie materiałów</h2>

                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border border-gray-400">
                              <th className="border border-gray-400 px-2 py-1 text-left w-10">Lp.</th>
                              <th className="border border-gray-400 px-2 py-1 text-left">Opis</th>
                              <th className="border border-gray-400 px-2 py-1 text-center w-12">j.m.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-16">Ilość</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-20">Cena jedn.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-24">Wartość</th>
                            </tr>
                          </thead>
                          <tbody>
                            {materialItems.length > 0 ? materialItems.map((item, idx) => (
                              <tr key={idx} className="border border-gray-400">
                                <td className="border border-gray-400 px-2 py-1">{idx + 1}</td>
                                <td className="border border-gray-400 px-2 py-1">{item.name}</td>
                                <td className="border border-gray-400 px-2 py-1 text-center">{item.unit}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.quantity, 1)}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.unitPrice, 2)}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.total, 2)}</td>
                              </tr>
                            )) : (
                              <tr className="border border-gray-400">
                                <td colSpan={6} className="border border-gray-400 px-2 py-4 text-center text-gray-500">Brak materiałów</td>
                              </tr>
                            )}
                            <tr className="border border-gray-400 font-medium">
                              <td className="border border-gray-400 px-2 py-1" colSpan={4}></td>
                              <td className="border border-gray-400 px-2 py-1 text-right">Razem</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(materialTotal, 2)}</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="text-right text-xs text-gray-400 mt-8">
                          {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                        </div>
                      </div>
                    );
                  }

                  if (page.type === 'zestawienie_sprzetu') {
                    // Calculate equipment summary
                    const equipmentItems: { name: string; unit: string; quantity: number; unitPrice: number; total: number }[] = [];
                    let equipmentTotal = 0;
                    Object.values(estimateData.positions).forEach(position => {
                      position.resources.filter(r => r.type === 'equipment').forEach(resource => {
                        const result = calculationResult?.positions[position.id];
                        const quantity = result?.quantity || 0;
                        const resQuantity = resource.norm.value * quantity;
                        const total = resQuantity * resource.unitPrice.value;
                        equipmentItems.push({
                          name: resource.name,
                          unit: resource.unit.label,
                          quantity: resQuantity,
                          unitPrice: resource.unitPrice.value,
                          total
                        });
                        equipmentTotal += total;
                      });
                    });

                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="text-sm text-gray-600 mb-2">{titlePageData.title || estimate?.settings.name || ''}</div>
                        <h2 className="text-lg font-bold mb-6">Zestawienie sprzętu</h2>

                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border border-gray-400">
                              <th className="border border-gray-400 px-2 py-1 text-left w-10">Lp.</th>
                              <th className="border border-gray-400 px-2 py-1 text-left">Opis</th>
                              <th className="border border-gray-400 px-2 py-1 text-center w-12">j.m.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-16">Ilość</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-20">Cena jedn.</th>
                              <th className="border border-gray-400 px-2 py-1 text-right w-24">Wartość</th>
                            </tr>
                          </thead>
                          <tbody>
                            {equipmentItems.length > 0 ? equipmentItems.map((item, idx) => (
                              <tr key={idx} className="border border-gray-400">
                                <td className="border border-gray-400 px-2 py-1">{idx + 1}</td>
                                <td className="border border-gray-400 px-2 py-1">{item.name}</td>
                                <td className="border border-gray-400 px-2 py-1 text-center">{item.unit}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.quantity, 1)}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.unitPrice, 2)}</td>
                                <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(item.total, 2)}</td>
                              </tr>
                            )) : (
                              <tr className="border border-gray-400">
                                <td colSpan={6} className="border border-gray-400 px-2 py-4 text-center text-gray-500">Brak sprzętu</td>
                              </tr>
                            )}
                            <tr className="border border-gray-400 font-medium">
                              <td className="border border-gray-400 px-2 py-1" colSpan={4}></td>
                              <td className="border border-gray-400 px-2 py-1 text-right">Razem</td>
                              <td className="border border-gray-400 px-2 py-1 text-right">{formatNumber(equipmentTotal, 2)}</td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="text-right text-xs text-gray-400 mt-8">
                          {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                        </div>
                      </div>
                    );
                  }

                  // Kalkulacja szczegółowa and Kosztorys szczegółowy - placeholder
                  if (page.type === 'kalkulacja_szczegolowa' || page.type === 'kosztorys_szczegolowy') {
                    return (
                      <div
                        key={page.id}
                        ref={el => sectionRefs.current[page.id] = el}
                        className={`print-section p-12 border-b-4 border-dashed border-gray-300 ${activeExportSection === page.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setActiveExportSection(page.id)}
                      >
                        <div className="text-sm text-gray-600 mb-2">{titlePageData.title || estimate?.settings.name || ''}</div>
                        <h2 className="text-lg font-bold mb-6">{page.label}</h2>

                        <p className="text-gray-500 text-center py-12">Sekcja w przygotowaniu...</p>

                        <div className="text-right text-xs text-gray-400 mt-8">
                          {pageIndex + 1}/{exportPages.filter(p => p.enabled).length}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          )}

          {/* Standard table views (przedmiar, kosztorys, naklady) */}
          {leftPanelMode !== 'export' && (viewMode === 'przedmiar' || viewMode === 'kosztorys' || viewMode === 'naklady' || viewMode === 'pozycje') && (
            <table className={`w-full border-collapse ${viewMode === 'pozycje' ? 'border border-gray-300' : ''}`}>
              <thead className="sticky top-0 bg-gray-50 z-10">
                {viewMode === 'przedmiar' ? (
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-12">L.p.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">Podstawa</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nakład</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-14">j.m.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Poszczególne</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">Razem</th>
                  </tr>
                ) : viewMode === 'naklady' ? (
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-14">L.p.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-20">Indeks</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nazwa</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-12">j.m.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">Ilość</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Cena jednostkowa</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Wartość</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Ilość inwestora</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Ilość wykonawcy</th>
                  </tr>
                ) : viewMode === 'pozycje' ? (
                  <tr className="border-b border-gray-300">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border border-gray-300 w-14">Lp.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border border-gray-300 w-28">Podstawa</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 border border-gray-300">Nakład</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 border border-gray-300 w-12">j.m.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 border border-gray-300 w-20">Obmiar</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 border border-gray-300 w-28">Ceny jednostkowa</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 border border-gray-300 w-24">Wartość</th>
                  </tr>
                ) : (
                  /* Kosztorys view - matching eKosztorysowanie */
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-14">Lp.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">Podstawa</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nazwa</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-12">j.m.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-16">Nakład</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">Koszt jedn.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-20">R</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-16">M</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-16">S</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {/* Sections (positions can only exist within sections, not at root level) */}
                {estimateData.root.sectionIds.map((sectionId, index) => {
                  const section = estimateData.sections[sectionId];
                  if (!section) return null;
                  return renderSection(section, index);
                })}

                {/* Empty state */}
                {estimateData.root.sectionIds.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="text-gray-400 mb-4">
                        <FileText className="w-12 h-12 mx-auto mb-2" />
                        <p>Kosztorys jest pusty</p>
                        <p className="text-sm mt-1">Dodaj dział, aby rozpocząć tworzenie kosztorysu</p>
                      </div>
                      <button
                        onClick={handleAddSection}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <FolderPlus className="w-4 h-4 inline mr-1" />
                        Dodaj dział
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Properties panel - now integrated into left panel */}

        {/* Right Panel - Settings and View Options */}
        {rightPanelMode !== 'closed' && (
          <div className="shrink-0 bg-white w-[320px] h-full border-l border-gray-200 flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                {rightPanelMode === 'settings' ? 'Ustawienia' :
                 rightPanelMode === 'viewOptions' ? 'Opcje widoku' :
                 'Ustawienia pozycji'}
              </h3>
              <button onClick={() => setRightPanelMode('closed')} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Panel Content */}
            {rightPanelMode === 'settings' && estimate && (
              <div className="flex-1 overflow-y-auto p-3">
                {/* Nazwa kosztorysu */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-1">Nazwa kosztorysu</label>
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
                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-2">Rodzaj</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rightPanelEstimateType"
                        value="contractor"
                        checked={estimate.settings.type === 'contractor'}
                        onChange={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: { ...prev.settings, type: 'contractor' }
                        } : null)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-800">Kosztorys wykonawczy</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rightPanelEstimateType"
                        value="investor"
                        checked={estimate.settings.type === 'investor'}
                        onChange={() => setEstimate(prev => prev ? {
                          ...prev,
                          settings: { ...prev.settings, type: 'investor' }
                        } : null)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-800">Kosztorys inwestorski</span>
                    </label>
                  </div>
                </div>

                {/* Kalkulacje */}
                <div className="mb-4 border-t border-gray-200 pt-4">
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center justify-between text-sm text-blue-600 font-medium mb-2"
                  >
                    <span>Kalkulacje</span>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">Szablon kalkulacji podsumowania kosztorysu</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={estimate.settings.calculationTemplate}
                        onChange={(e) => setEstimate(prev => prev ? {
                          ...prev,
                          settings: { ...prev.settings, calculationTemplate: e.target.value }
                        } : null)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="overhead-on-top">Narzuty liczone dla całego kosztorysu</option>
                        <option value="overhead-cascade">Narzuty kaskadowe</option>
                        <option value="simple">Uproszczona</option>
                      </select>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-1">Opis kosztorysu</label>
                    <textarea
                      value={estimate.settings.description}
                      onChange={(e) => setEstimate(prev => prev ? {
                        ...prev,
                        settings: { ...prev.settings, description: e.target.value }
                      } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                      rows={2}
                      placeholder="KOSZTORYS NASZ"
                    />
                  </div>

                  {/* Narzuty settings */}
                  <div className="border-t border-gray-100 pt-3">
                    <label className="block text-xs text-gray-500 mb-2">Narzuty</label>
                    <div className="space-y-2">
                      {/* Koszty pośrednie (Kp) */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Koszty pośrednie (Kp)</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={estimateData.root.overheads.find(o => o.name.includes('Kp'))?.value || 65}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              const newOverheads = estimateData.root.overheads.map(o =>
                                o.name.includes('Kp') ? { ...o, value: newValue } : o
                              );
                              updateEstimateData({
                                ...estimateData,
                                root: { ...estimateData.root, overheads: newOverheads }
                              });
                            }}
                            className="w-14 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-500">%</span>
                          <span className="text-xs text-gray-400 ml-1">(R)</span>
                        </div>
                      </div>

                      {/* Zysk (Z) */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Zysk (Z)</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={estimateData.root.overheads.find(o => o.name.includes('Zysk'))?.value || 10}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              const newOverheads = estimateData.root.overheads.map(o =>
                                o.name.includes('Zysk') ? { ...o, value: newValue } : o
                              );
                              updateEstimateData({
                                ...estimateData,
                                root: { ...estimateData.root, overheads: newOverheads }
                              });
                            }}
                            className="w-14 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-500">%</span>
                          <span className="text-xs text-gray-400 ml-1">(R)</span>
                        </div>
                      </div>

                      {/* Koszty zakupu (Kz) */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Koszty zakupu (Kz)</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={estimateData.root.overheads.find(o => o.name.includes('zakupu'))?.value || 5}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              const newOverheads = estimateData.root.overheads.map(o =>
                                o.name.includes('zakupu') ? { ...o, value: newValue } : o
                              );
                              updateEstimateData({
                                ...estimateData,
                                root: { ...estimateData.root, overheads: newOverheads }
                              });
                            }}
                            className="w-14 px-2 py-1 text-sm text-right border border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-500">%</span>
                          <span className="text-xs text-gray-400 ml-1">(M)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dokładność */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center justify-between text-sm text-blue-600 font-medium mb-3"
                  >
                    <span>Dokładność</span>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 truncate">Normy</label>
                      <div className="flex items-center gap-0.5">
                        <span className="w-5 text-center text-sm">{estimate.settings.precision.norms}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => setEstimate(prev => prev ? {
                              ...prev,
                              settings: {
                                ...prev.settings,
                                precision: { ...prev.settings.precision, norms: Math.min(10, prev.settings.precision.norms + 1) }
                              }
                            } : null)}
                            className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEstimate(prev => prev ? {
                              ...prev,
                              settings: {
                                ...prev.settings,
                                precision: { ...prev.settings.precision, norms: Math.max(0, prev.settings.precision.norms - 1) }
                              }
                            } : null)}
                            className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 truncate">Wart...</label>
                      <div className="flex items-center gap-0.5">
                        <span className="w-5 text-center text-sm">{estimate.settings.precision.unitValues}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => setEstimate(prev => prev ? {
                              ...prev,
                              settings: {
                                ...prev.settings,
                                precision: { ...prev.settings.precision, unitValues: Math.min(10, prev.settings.precision.unitValues + 1) }
                              }
                            } : null)}
                            className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEstimate(prev => prev ? {
                              ...prev,
                              settings: {
                                ...prev.settings,
                                precision: { ...prev.settings.precision, unitValues: Math.max(0, prev.settings.precision.unitValues - 1) }
                              }
                            } : null)}
                            className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 truncate">Nakła...</label>
                      <div className="flex items-center gap-0.5">
                        <span className="w-5 text-center text-sm">1</span>
                        <div className="flex flex-col">
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 truncate">Pods....</label>
                      <div className="flex items-center gap-0.5">
                        <span className="w-5 text-center text-sm">3</span>
                        <div className="flex flex-col">
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 truncate">Obmi...</label>
                      <div className="flex items-center gap-0.5">
                        <span className="w-5 text-center text-sm">2</span>
                        <div className="flex flex-col">
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600 truncate">Pods....</label>
                      <div className="flex items-center gap-0.5">
                        <span className="w-5 text-center text-sm">2</span>
                        <div className="flex flex-col">
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                    <span className="text-xs text-gray-600">Zaokrąglanie liczb wg PN-70/N-02120</span>
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <HelpCircle className="w-3 h-3" />
                    </button>
                  </label>
                </div>

                {/* Współczynniki norm */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center justify-between text-sm text-blue-600 font-medium mb-3"
                  >
                    <span>Współczynniki norm</span>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Robocizna</label>
                      <input
                        type="text"
                        defaultValue="1,1"
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Materiały</label>
                      <input
                        type="text"
                        defaultValue="1,2"
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Sprzęt</label>
                      <input
                        type="text"
                        defaultValue="1,3"
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Odpady</label>
                      <input
                        type="text"
                        defaultValue="1,4"
                        className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View Options Panel Content */}
            {rightPanelMode === 'viewOptions' && (
              <div className="flex-1 overflow-y-auto p-3">
                {/* Ceny jednostkowe */}
                <div className="mb-4">
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center justify-between text-sm text-blue-600 font-medium mb-3"
                  >
                    <span>Ceny jednostkowe</span>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viewOptionsPanel.highlightZeroPrices}
                      onChange={(e) => setViewOptionsPanel(prev => ({ ...prev, highlightZeroPrices: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Podświetl wartości zerowe cen jednostkowych</span>
                  </label>
                </div>

                {/* Opcje narzutów */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center justify-between text-sm text-blue-600 font-medium mb-3"
                  >
                    <span>Opcje narzutów</span>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viewOptionsPanel.showDetailedOverheads}
                      onChange={(e) => setViewOptionsPanel(prev => ({ ...prev, showDetailedOverheads: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Pokaż szczegółowy podział narzutów w podsumowaniu pozycji</span>
                  </label>
                </div>
              </div>
            )}

            {/* Position Settings Panel Content */}
            {rightPanelMode === 'positionSettings' && selectedItem && editorState.selectedItemType === 'resource' && (
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-sm text-gray-600">Ustawienia nakładu</p>
                {/* Resource properties will be shown here */}
              </div>
            )}
          </div>
        )}
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

          {/* Alert message with expand button */}
          {alerts.length > 0 && alertsCount.current < alerts.length && (
            <div className="flex items-center gap-1 ml-2">
              <span className={`text-xs flex items-center gap-1 ${
                alerts[alertsCount.current]?.type === 'error' ? 'text-[#EF4444]' : 'text-amber-600'
              }`}>
                <AlertCircle className="w-3 h-3" />
                {alerts[alertsCount.current]?.message || 'Alerty w kosztorysie'}
              </span>
              <button
                onClick={() => setAlertsExpanded(!alertsExpanded)}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                title={alertsExpanded ? 'Zwiń listę alertów' : 'Rozwiń listę alertów'}
              >
                {alertsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>
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

      {/* Expanded Alerts Panel */}
      {alertsExpanded && alerts.length > 0 && (
        <div className="absolute bottom-[40px] left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-40 max-h-[300px] overflow-y-auto">
          <div className="sticky top-0 bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Lista alertów ({alerts.length})</span>
            <button
              onClick={() => setAlertsExpanded(false)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-[41px]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Typ</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Opis</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase max-w-[300px]">Nazwa pozycji</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alerts.map((alert, index) => (
                <tr
                  key={alert.id}
                  className={`hover:bg-gray-50 cursor-pointer ${index === alertsCount.current ? 'bg-blue-50' : ''}`}
                  onClick={() => handleNavigateToAlert(index)}
                >
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      alert.type === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      <AlertCircle className="w-3 h-3" />
                      {alert.type === 'error' ? 'Błąd' : 'Ostrzeżenie'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{alert.message}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-[300px] truncate" title={alert.positionName || ''}>
                    {alert.positionName || '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToAlert(index);
                        setAlertsExpanded(false);
                      }}
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      Idź do
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                    <span>{titlePageData.title || estimate?.settings.name || ''}</span>
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
