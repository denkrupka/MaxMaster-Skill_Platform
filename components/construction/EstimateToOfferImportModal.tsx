import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2, ChevronRight, ChevronDown, 
         Calculator, ArrowRight, FileText, Package, Users, Wrench, Download } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type { EstimateStage, EstimateTask, EstimateResource, ResourceType } from '../../types';

interface EstimateToOfferImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  estimateId: string;
  offerId: string;
  onImportComplete: () => void;
}

interface StageWithTasks extends EstimateStage {
  tasks?: TaskWithResources[];
  isExpanded?: boolean;
  selected?: boolean;
}

interface TaskWithResources extends EstimateTask {
  resources?: EstimateResource[];
  isExpanded?: boolean;
  selected?: boolean;
}

interface ResourceWithSelection extends EstimateResource {
  selected?: boolean;
}

interface ImportSummary {
  laborCost: number;
  materialCost: number;
  equipmentCost: number;
  totalCost: number;
  selectedCount: number;
}

const RESOURCE_TYPE_CONFIG: Record<ResourceType, { label: string; color: string; icon: React.FC<{className?: string}> }> = {
  labor: { label: 'Robocizna', color: 'text-blue-600', icon: Users },
  material: { label: 'Materiał', color: 'text-green-600', icon: Package },
  equipment: { label: 'Sprzęt', color: 'text-orange-600', icon: Wrench },
  overhead: { label: 'Narzuty', color: 'text-gray-600', icon: Calculator }
};

export const EstimateToOfferImportModal: React.FC<EstimateToOfferImportModalProps> = ({
  isOpen,
  onClose,
  estimateId,
  offerId,
  onImportComplete
}) => {
  const { state } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [stages, setStages] = useState<StageWithTasks[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importMode, setImportMode] = useState<'all' | 'selected'>('selected');
  const [groupByType, setGroupByType] = useState(true);

  useEffect(() => {
    if (isOpen && estimateId) {
      loadEstimateData();
    }
  }, [isOpen, estimateId]);

  const loadEstimateData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('estimate_stages')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('position', { ascending: true });

      if (stagesError) throw stagesError;

      // Load tasks for each stage
      const stagesWithTasks: StageWithTasks[] = [];
      
      for (const stage of stagesData || []) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('estimate_tasks')
          .select('*')
          .eq('stage_id', stage.id)
          .order('position', { ascending: true });

        if (tasksError) throw tasksError;

        const tasksWithResources: TaskWithResources[] = [];
        
        for (const task of tasksData || []) {
          const { data: resourcesData, error: resourcesError } = await supabase
            .from('estimate_resources')
            .select('*')
            .eq('task_id', task.id)
            .order('type', { ascending: true });

          if (resourcesError) throw resourcesError;

          tasksWithResources.push({
            ...task,
            resources: resourcesData || [],
            isExpanded: false,
            selected: true
          });
        }

        stagesWithTasks.push({
          ...stage,
          tasks: tasksWithResources,
          isExpanded: false,
          selected: true
        });
      }

      setStages(stagesWithTasks);
    } catch (err: any) {
      console.error('Error loading estimate:', err);
      setError('Błąd podczas ładowania danych kosztorysu');
    } finally {
      setLoading(false);
    }
  };

  const toggleStage = (stageId: string) => {
    setStages(prev => prev.map(stage => 
      stage.id === stageId 
        ? { ...stage, isExpanded: !stage.isExpanded }
        : stage
    ));
  };

  const toggleStageSelection = (stageId: string) => {
    setStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        const newSelected = !stage.selected;
        return {
          ...stage,
          selected: newSelected,
          tasks: stage.tasks?.map(task => ({
            ...task,
            selected: newSelected,
            resources: task.resources?.map(r => ({ ...r, selected: newSelected }))
          }))
        };
      }
      return stage;
    }));
  };

  const toggleTaskSelection = (stageId: string, taskId: string) => {
    setStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          tasks: stage.tasks?.map(task => {
            if (task.id === taskId) {
              const newSelected = !task.selected;
              return {
                ...task,
                selected: newSelected,
                resources: task.resources?.map(r => ({ ...r, selected: newSelected }))
              };
            }
            return task;
          })
        };
      }
      return stage;
    }));
  };

  const toggleResourceSelection = (stageId: string, taskId: string, resourceId: string) => {
    setStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          tasks: stage.tasks?.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                resources: task.resources?.map(r => 
                  r.id === resourceId ? { ...r, selected: !r.selected } : r
                )
              };
            }
            return task;
          })
        };
      }
      return stage;
    }));
  };

  const calculateSummary = useMemo((): ImportSummary => {
    let laborCost = 0;
    let materialCost = 0;
    let equipmentCost = 0;
    let selectedCount = 0;

    stages.forEach(stage => {
      stage.tasks?.forEach(task => {
        task.resources?.forEach(resource => {
          if (resource.selected) {
            const cost = (resource.quantity || 0) * (resource.unit_cost || 0);
            selectedCount++;
            
            switch (resource.type) {
              case 'labor':
                laborCost += cost;
                break;
              case 'material':
                materialCost += cost;
                break;
              case 'equipment':
                equipmentCost += cost;
                break;
            }
          }
        });
      });
    });

    return {
      laborCost,
      materialCost,
      equipmentCost,
      totalCost: laborCost + materialCost + equipmentCost,
      selectedCount
    };
  }, [stages]);

  const handleImport = async () => {
    setImporting(true);
    setError(null);

    try {
      // Collect all selected resources
      const itemsToImport: any[] = [];
      
      stages.forEach(stage => {
        stage.tasks?.forEach(task => {
          task.resources?.forEach(resource => {
            if (resource.selected) {
              itemsToImport.push({
                offer_id: offerId,
                name: resource.name || task.name,
                description: `${stage.name} > ${task.name}`,
                type: resource.type,
                quantity: resource.quantity || 0,
                unit: resource.unit || 'szt.',
                cost_price: resource.unit_cost || 0,
                total_cost: (resource.quantity || 0) * (resource.unit_cost || 0),
                // Calculate suggested price with 20% margin by default
                unit_price: (resource.unit_cost || 0) * 1.2,
                total_price: (resource.quantity || 0) * (resource.unit_cost || 0) * 1.2,
                markup_percent: 20,
                source_resource_id: resource.id,
                source_task_id: task.id,
                source_stage_id: stage.id
              });
            }
          });
        });
      });

      if (itemsToImport.length === 0) {
        setError('Nie wybrano żadnych pozycji do importu');
        setImporting(false);
        return;
      }

      // Insert into offer_items table
      const { error: insertError } = await supabase
        .from('offer_items')
        .insert(itemsToImport);

      if (insertError) throw insertError;

      setSuccess(true);
      onImportComplete();
      
      // Close after short delay
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (err: any) {
      console.error('Import error:', err);
      setError('Błąd podczas importu: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStages([]);
    setError(null);
    setSuccess(false);
    setImportMode('selected');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-6">
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50" onClick={handleClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Import nakładów z kosztorysu
              </h3>
              <p className="text-sm text-slate-500">
                Przenieś pozycje z kosztorysu do oferty
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-lg transition">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-600">Ładowanie danych kosztorysu...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-600">{error}</p>
                <button
                  onClick={loadEstimateData}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                <h4 className="text-xl font-semibold text-slate-900">Import zakończony!</h4>
                <p className="text-slate-600 mt-2">
                  Zaimportowano {calculateSummary.selectedCount} pozycji
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Options */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={importMode === 'selected'}
                      onChange={() => setImportMode('selected')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">Importuj wybrane</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={importMode === 'all'}
                      onChange={() => setImportMode('all')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">Importuj wszystko</span>
                  </label>
                  <div className="flex-1" />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={groupByType}
                      onChange={(e) => setGroupByType(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-slate-700">Grupuj według typu</span>
                  </label>
                </div>

                {/* Stages tree */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {stages.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>Brak danych w kosztorysie</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {stages.map(stage => (
                        <div key={stage.id}>
                          {/* Stage header */}
                          <div 
                            className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                            onClick={() => toggleStage(stage.id)}
                          >
                            <input
                              type="checkbox"
                              checked={stage.selected}
                              onChange={() => toggleStageSelection(stage.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            {stage.isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="font-medium text-slate-900">{stage.name}</span>
                            <span className="text-xs text-slate-500">
                              ({stage.tasks?.length || 0} pozycji)
                            </span>
                          </div>

                          {/* Tasks */}
                          {stage.isExpanded && stage.tasks && (
                            <div className="divide-y divide-slate-100">
                              {stage.tasks.map(task => (
                                <div key={task.id} className="pl-8">
                                  {/* Task header */}
                                  <div className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                                    <input
                                      type="checkbox"
                                      checked={task.selected}
                                      onChange={() => toggleTaskSelection(stage.id, task.id)}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-medium text-slate-700">{task.name}</span>
                                    {task.quantity && task.unit && (
                                      <span className="text-xs text-slate-500">
                                        {task.quantity} {task.unit}
                                      </span>
                                    )}
                                  </div>

                                  {/* Resources */}
                                  {task.resources && task.resources.length > 0 && (
                                    <div className="pl-8 pb-2">
                                      {task.resources.map(resource => {
                                        const config = RESOURCE_TYPE_CONFIG[resource.type];
                                        const Icon = config.icon;
                                        const cost = (resource.quantity || 0) * (resource.unit_cost || 0);
                                        
                                        return (
                                          <div
                                            key={resource.id}
                                            className={`flex items-center gap-3 px-4 py-2 rounded-lg mb-1 ${
                                              resource.selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={resource.selected}
                                              onChange={() => toggleResourceSelection(stage.id, task.id, resource.id)}
                                              className="w-4 h-4 text-blue-600 rounded"
                                            />
                                            <Icon className={`w-4 h-4 ${config.color}`} />
                                            <span className="flex-1 text-sm text-slate-700">
                                              {resource.name}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                              {resource.quantity} {resource.unit}
                                            </span>
                                            <span className="text-sm font-medium text-slate-900 w-24 text-right">
                                              {cost.toFixed(2)} zł
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Summary footer */}
          {!loading && !error && !success && (
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium">Robocizna</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {calculateSummary.laborCost.toFixed(2)} zł
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="text-xs font-medium">Materiały</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {calculateSummary.materialCost.toFixed(2)} zł
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 text-orange-600 mb-1">
                    <Wrench className="w-4 h-4" />
                    <span className="text-xs font-medium">Sprzęt</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {calculateSummary.equipmentCost.toFixed(2)} zł
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 mb-1">
                    <Calculator className="w-4 h-4" />
                    <span className="text-xs font-medium">Razem</span>
                  </div>
                  <div className="text-lg font-bold text-blue-900">
                    {calculateSummary.totalCost.toFixed(2)} zł
                  </div>
                  <div className="text-xs text-blue-600">
                    {calculateSummary.selectedCount} pozycji
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Anuluj
            </button>
            
            {!loading && !error && !success && (
              <button
                onClick={handleImport}
                disabled={importing || calculateSummary.selectedCount === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importowanie...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Importuj {calculateSummary.selectedCount} pozycji
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimateToOfferImportModal;
