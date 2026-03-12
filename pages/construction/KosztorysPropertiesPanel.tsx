/**
 * KosztorysPropertiesPanel — right-side properties panel for the cost estimate editor.
 * Extracted from KosztorysEditor.tsx for modularity.
 */
import React from 'react';
import { X, Percent } from 'lucide-react';
import { formatNumber, formatCurrency } from '../../lib/kosztorysCalculator';
import type {
  KosztorysSection,
  KosztorysPosition,
  KosztorysResource,
  KosztorysOverhead,
  KosztorysPositionCalculationResult,
} from '../../types';

export interface PropertiesPanelProps {
  selectedItem: KosztorysSection | KosztorysPosition | KosztorysResource | null;
  selectedType: 'section' | 'position' | 'resource' | null;
  calculationResult: KosztorysPositionCalculationResult | null;
  onUpdate: (updates: Partial<any>) => void;
  onClose: () => void;
  showDetailedOverheads?: boolean;
  overheads?: KosztorysOverhead[];
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedItem, selectedType, calculationResult, onUpdate, onClose, showDetailedOverheads = false, overheads = []
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
        </div>
      </div>
    </div>
  );

  const renderPositionProperties = (position: KosztorysPosition) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa pozycji</label>
        <input
          type="text"
          value={position.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ilość</label>
          <input
            type="number"
            step="0.001"
            value={position.quantity}
            onChange={e => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Jednostka</label>
          <input
            type="text"
            value={typeof position.unit === 'object' ? (position.unit as any).label : position.unit}
            onChange={e => onUpdate({ unit: { ...(typeof position.unit === 'object' ? position.unit : { unitIndex: '' }), label: e.target.value } as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>
      {calculationResult && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-800 mb-3">Kalkulacja</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Robocizna:</span>
              <span className="font-medium">{formatCurrency(calculationResult.laborTotal)} zł</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Materiały:</span>
              <span className="font-medium">{formatCurrency(calculationResult.materialTotal)} zł</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sprzęt:</span>
              <span className="font-medium">{formatCurrency(calculationResult.equipmentTotal)} zł</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
              <span>Razem:</span>
              <span className="text-blue-700">{formatCurrency(calculationResult.totalWithOverheads)} zł</span>
            </div>
          </div>
          {showDetailedOverheads && overheads.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Percent className="w-3 h-3" /> Narzuty
              </h5>
              {overheads.map(oh => (
                <div key={oh.id} className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{oh.name}</span>
                  <span>{oh.value}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderResourceProperties = (resource: KosztorysResource) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa nakładu</label>
        <input
          type="text"
          value={resource.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Norma</label>
          <input
            type="number"
            step="0.0001"
            value={typeof resource.norm === 'object' ? (resource.norm as any).value : resource.norm}
            onChange={e => onUpdate({ norm: typeof resource.norm === 'object' ? { ...(resource.norm as any), value: parseFloat(e.target.value) || 0 } : parseFloat(e.target.value) || 0 } as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cena jedn.</label>
          <input
            type="number"
            step="0.01"
            value={typeof resource.unitPrice === 'object' ? (resource.unitPrice as any).value : resource.unitPrice}
            onChange={e => onUpdate({ unitPrice: typeof resource.unitPrice === 'object' ? { ...(resource.unitPrice as any), value: parseFloat(e.target.value) || 0 } : parseFloat(e.target.value) || 0 } as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Jednostka</label>
        <input
          type="text"
          value={typeof resource.unit === 'object' ? (resource.unit as any).label : resource.unit}
          onChange={e => onUpdate({ unit: { ...(typeof resource.unit === 'object' ? resource.unit : { unitIndex: '' }), label: e.target.value } as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
    </div>
  );

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

export default PropertiesPanel;
