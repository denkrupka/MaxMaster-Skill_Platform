
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, Calendar, DollarSign, Percent, User, Trash2, Edit3, GripVertical, Building2, Phone, Mail, CheckSquare, FileText, Clock, History, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { DealStage, DealPriority, CRMDeal, CRMActivity, ActivityType, CRMCompany } from '../../types';
import { DEAL_STAGE_LABELS, DEAL_STAGE_COLORS, DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS, MODULE_LABELS, ACTIVITY_TYPE_LABELS, INDUSTRY_OPTIONS, CRM_STATUS_OPTIONS, CRM_STATUS_LABELS } from '../../constants';
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase';

// Custom stage type for dynamic stages
interface CustomStage {
  id: string;
  name: string;
  color: string;
}

// Default stages based on DealStage enum
const DEFAULT_STAGES: CustomStage[] = [
  { id: DealStage.LEAD, name: 'Nowy Lead', color: 'bg-slate-500' },
  { id: DealStage.QUALIFIED, name: 'Zakwalifikowany', color: 'bg-blue-500' },
  { id: DealStage.PROPOSAL, name: 'Propozycja', color: 'bg-purple-500' },
  { id: DealStage.NEGOTIATION, name: 'Negocjacje', color: 'bg-orange-500' },
];

const STAGE_COLORS = [
  'bg-slate-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
  'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-lime-500'
];

export const SalesPipeline: React.FC = () => {
  const { state, setState, addCrmDeal, updateCrmDeal, deleteCrmDeal } = useAppContext();
  const { crmDeals, crmCompanies, crmActivities, crmContacts, modules } = state;

  // Get module price from database (base_price_per_user)
  const getModulePrice = (moduleCode: string): number => {
    const mod = modules.find(m => m.code === moduleCode);
    return mod?.base_price_per_user || 0;
  };

  const [search, setSearch] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [newDealStage, setNewDealStage] = useState<string>(DealStage.LEAD);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editedStageName, setEditedStageName] = useState('');

  // Deal detail modal states
  const [dealDetailTab, setDealDetailTab] = useState<'details' | 'history'>('details');
  const [isEditingDeal, setIsEditingDeal] = useState(false);
  const [editingModules, setEditingModules] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);

  // Edit deal form state
  const [editDealForm, setEditDealForm] = useState({
    title: '',
    crm_company_id: '',
    expected_close_date: '',
    employee_count_estimate: '',
    modules_interested: [] as string[],
    priority: DealPriority.MEDIUM,
    value: '',
    manualValue: false
  });

  // Add company modal state
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [isSearchingGUS, setIsSearchingGUS] = useState(false);
  const [gusError, setGusError] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    legal_name: '',
    tax_id: '',
    regon: '',
    industry: '',
    address_street: '',
    address_city: '',
    address_postal_code: '',
    employee_count: '',
    notes: '',
    status: 'new',
    source: ''
  });

  // Add note modal state
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({ subject: '', description: '' });
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Add task modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    activity_type: ActivityType.TASK,
    subject: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '',
    duration_minutes: '' as number | ''
  });
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Custom stages management
  const [stages, setStages] = useState<CustomStage[]>(() => {
    const saved = localStorage.getItem('crm_custom_stages');
    return saved ? JSON.parse(saved) : DEFAULT_STAGES;
  });

  // Save stages to localStorage
  useEffect(() => {
    localStorage.setItem('crm_custom_stages', JSON.stringify(stages));
  }, [stages]);

  // New deal form state
  const [newDeal, setNewDeal] = useState({
    title: '',
    crm_company_id: '',
    expected_close_date: '',
    employee_count_estimate: '',
    modules_interested: [] as string[],
    notes: '',
    priority: DealPriority.MEDIUM,
    manualValue: false,
    value: ''
  });

  // Calculate value automatically based on modules and users (monthly value)
  const calculateDealValue = (selectedModules: string[], userCount: number): number => {
    if (!selectedModules.length || !userCount) return 0;
    const monthlyPricePerUser = selectedModules.reduce((sum, mod) => sum + getModulePrice(mod), 0);
    return monthlyPricePerUser * userCount; // Monthly value
  };

  // Get calculated value for new deal
  const calculatedNewDealValue = useMemo(() => {
    const userCount = parseInt(newDeal.employee_count_estimate) || 0;
    return calculateDealValue(newDeal.modules_interested, userCount);
  }, [newDeal.modules_interested, newDeal.employee_count_estimate]);

  // Get activities for a deal
  const getDealActivities = (dealId: string) => {
    return crmActivities
      .filter(a => a.deal_id === dealId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Get activity icon
  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case ActivityType.CALL: return <Phone className="w-4 h-4" />;
      case ActivityType.EMAIL: return <Mail className="w-4 h-4" />;
      case ActivityType.MEETING: return <Calendar className="w-4 h-4" />;
      case ActivityType.NOTE: return <FileText className="w-4 h-4" />;
      case ActivityType.TASK: return <CheckSquare className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  // Get activity type color
  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case ActivityType.CALL: return 'bg-green-100 text-green-600';
      case ActivityType.EMAIL: return 'bg-blue-100 text-blue-600';
      case ActivityType.MEETING: return 'bg-purple-100 text-purple-600';
      case ActivityType.NOTE: return 'bg-slate-100 text-slate-600';
      case ActivityType.TASK: return 'bg-amber-100 text-amber-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  // Filter deals
  const filteredDeals = useMemo(() => {
    return crmDeals.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));
  }, [crmDeals, search]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, CRMDeal[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = [];
    });
    // Also add WON and LOST for summary
    grouped[DealStage.WON] = [];
    grouped[DealStage.LOST] = [];

    filteredDeals.forEach(deal => {
      if (grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    });
    return grouped;
  }, [filteredDeals, stages]);

  const handleDragStart = (dealId: string) => setDraggedDeal(dealId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (stageId: string) => {
    if (!draggedDeal) return;

    const deal = crmDeals.find(d => d.id === draggedDeal);
    if (deal && deal.stage !== stageId) {
      try {
        await updateCrmDeal(draggedDeal, { stage: stageId as DealStage });
      } catch (error) {
        console.error('Failed to update deal stage:', error);
      }
    }
    setDraggedDeal(null);
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value);

  const handleCreateDeal = async () => {
    if (!newDeal.title.trim()) return;

    // Calculate final value
    const finalValue = newDeal.manualValue && newDeal.value
      ? parseFloat(newDeal.value)
      : calculatedNewDealValue || undefined;

    try {
      await addCrmDeal({
        title: newDeal.title,
        crm_company_id: newDeal.crm_company_id || undefined,
        value: finalValue,
        probability: 50, // Default probability
        expected_close_date: newDeal.expected_close_date || undefined,
        employee_count_estimate: newDeal.employee_count_estimate ? parseInt(newDeal.employee_count_estimate) : undefined,
        modules_interested: newDeal.modules_interested.length > 0 ? newDeal.modules_interested : undefined,
        notes: newDeal.notes || undefined,
        priority: newDeal.priority,
        stage: newDealStage as DealStage
      });

      // Reset form
      setNewDeal({
        title: '',
        crm_company_id: '',
        expected_close_date: '',
        employee_count_estimate: '',
        modules_interested: [],
        notes: '',
        priority: DealPriority.MEDIUM,
        manualValue: false,
        value: ''
      });
      setShowNewDealModal(false);
    } catch (error) {
      console.error('Failed to create deal:', error);
    }
  };

  // Handle edit deal
  const openEditDealModal = () => {
    if (!selectedDeal) return;
    setEditDealForm({
      title: selectedDeal.title,
      crm_company_id: selectedDeal.crm_company_id || '',
      expected_close_date: selectedDeal.expected_close_date || '',
      employee_count_estimate: selectedDeal.employee_count_estimate?.toString() || '',
      modules_interested: selectedDeal.modules_interested || [],
      priority: selectedDeal.priority,
      value: selectedDeal.value?.toString() || '',
      manualValue: false
    });
    setIsEditingDeal(true);
  };

  // Calculate value for edit form
  const calculatedEditDealValue = useMemo(() => {
    const userCount = parseInt(editDealForm.employee_count_estimate) || 0;
    return calculateDealValue(editDealForm.modules_interested, userCount);
  }, [editDealForm.modules_interested, editDealForm.employee_count_estimate]);

  // Save edited deal
  const handleSaveEditDeal = async () => {
    if (!selectedDeal) return;

    const finalValue = editDealForm.manualValue && editDealForm.value
      ? parseFloat(editDealForm.value)
      : calculatedEditDealValue || undefined;

    try {
      await updateCrmDeal(selectedDeal.id, {
        title: editDealForm.title,
        crm_company_id: editDealForm.crm_company_id || undefined,
        expected_close_date: editDealForm.expected_close_date || undefined,
        employee_count_estimate: editDealForm.employee_count_estimate ? parseInt(editDealForm.employee_count_estimate) : undefined,
        modules_interested: editDealForm.modules_interested.length > 0 ? editDealForm.modules_interested : undefined,
        priority: editDealForm.priority,
        value: finalValue
      });

      // Update selected deal
      setSelectedDeal(prev => prev ? {
        ...prev,
        title: editDealForm.title,
        crm_company_id: editDealForm.crm_company_id || undefined,
        expected_close_date: editDealForm.expected_close_date || undefined,
        employee_count_estimate: editDealForm.employee_count_estimate ? parseInt(editDealForm.employee_count_estimate) : undefined,
        modules_interested: editDealForm.modules_interested.length > 0 ? editDealForm.modules_interested : undefined,
        priority: editDealForm.priority,
        value: finalValue
      } : null);

      setIsEditingDeal(false);
    } catch (error) {
      console.error('Failed to update deal:', error);
    }
  };

  // Update deal modules directly
  const handleUpdateDealModules = async (modules: string[]) => {
    if (!selectedDeal) return;
    const userCount = selectedDeal.employee_count_estimate || 0;
    const newValue = calculateDealValue(modules, userCount);

    try {
      await updateCrmDeal(selectedDeal.id, {
        modules_interested: modules.length > 0 ? modules : undefined,
        value: newValue || undefined
      });
      setSelectedDeal(prev => prev ? { ...prev, modules_interested: modules, value: newValue || prev.value } : null);
    } catch (error) {
      console.error('Failed to update deal modules:', error);
    }
    setEditingModules(false);
  };

  // Update deal priority directly
  const handleUpdateDealPriority = async (priority: DealPriority) => {
    if (!selectedDeal) return;
    try {
      await updateCrmDeal(selectedDeal.id, { priority });
      setSelectedDeal(prev => prev ? { ...prev, priority } : null);
    } catch (error) {
      console.error('Failed to update deal priority:', error);
    }
    setEditingPriority(false);
  };

  // Add company handlers
  const resetCompanyForm = () => {
    setCompanyForm({
      name: '',
      legal_name: '',
      tax_id: '',
      regon: '',
      industry: '',
      address_street: '',
      address_city: '',
      address_postal_code: '',
      employee_count: '',
      notes: '',
      status: 'new',
      source: ''
    });
    setGusError(null);
  };

  const searchGUS = async () => {
    const cleanNip = companyForm.tax_id.replace(/[\s-]/g, '');
    if (!cleanNip || cleanNip.length !== 10) {
      setGusError('NIP musi mieć 10 cyfr');
      return;
    }

    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanNip[i]) * weights[i];
    }
    const checkDigit = sum % 11;
    if (checkDigit === 10 || checkDigit !== parseInt(cleanNip[9])) {
      setGusError('Nieprawidłowy NIP - błędna suma kontrolna');
      return;
    }

    setIsSearchingGUS(true);
    setGusError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setGusError('Brak sesji - proszę zalogować się ponownie');
        setIsSearchingGUS(false);
        return;
      }

      const supabaseUrl = 'https://diytvuczpciikzdhldny.supabase.co';

      const response = await fetch(`${supabaseUrl}/functions/v1/search-gus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ nip: cleanNip })
      });

      if (!response.ok) {
        setGusError(`Błąd serwera (${response.status}). Spróbuj później.`);
        setIsSearchingGUS(false);
        return;
      }

      const result = await response.json();

      if (result.success && result.data && result.data.found !== false) {
        const d = result.data;
        const street = d.ulica ? `${d.ulica} ${d.nrNieruchomosci || ''}${d.nrLokalu ? '/' + d.nrLokalu : ''}`.trim() : '';

        setCompanyForm(prev => ({
          ...prev,
          name: prev.name || d.nazwa || '',
          legal_name: d.nazwa || prev.legal_name,
          regon: d.regon || prev.regon,
          address_street: street || prev.address_street,
          address_city: d.miejscowosc || prev.address_city,
          address_postal_code: d.kodPocztowy || prev.address_postal_code
        }));
      } else {
        setGusError(result.error || 'Nie znaleziono firmy o podanym NIP w rejestrze GUS');
      }
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        setGusError('Błąd połączenia z serwerem. Sprawdź połączenie internetowe.');
      } else {
        setGusError('Błąd podczas wyszukiwania. Spróbuj później.');
      }
    } finally {
      setIsSearchingGUS(false);
    }
  };

  const handleAddCompany = async () => {
    if (!companyForm.name.trim()) return;

    try {
      const { data, error } = await supabase
        .from('crm_companies')
        .insert([{
          name: companyForm.name,
          legal_name: companyForm.legal_name || null,
          tax_id: companyForm.tax_id || null,
          regon: companyForm.regon || null,
          industry: companyForm.industry || null,
          address_street: companyForm.address_street || null,
          address_city: companyForm.address_city || null,
          address_postal_code: companyForm.address_postal_code || null,
          employee_count: companyForm.employee_count ? parseInt(companyForm.employee_count) : null,
          notes: companyForm.notes || null,
          status: companyForm.status,
          source: companyForm.source || null
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: [...prev.crmCompanies, data]
      }));

      // Set the new company as selected in deal form
      setNewDeal(prev => ({ ...prev, crm_company_id: data.id }));
      setShowAddCompanyModal(false);
      resetCompanyForm();
    } catch (error) {
      console.error('Failed to add company:', error);
    }
  };

  // Add note handler
  const handleAddNote = async () => {
    if (!selectedDeal || !noteForm.subject.trim()) return;

    setIsSavingNote(true);
    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{
          activity_type: ActivityType.NOTE,
          subject: noteForm.subject.trim(),
          description: noteForm.description.trim() || null,
          deal_id: selectedDeal.id,
          crm_company_id: selectedDeal.crm_company_id || null,
          is_completed: true,
          completed_at: new Date().toISOString(),
          created_by: state.currentUser?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: [...prev.crmActivities, data]
      }));

      setNoteForm({ subject: '', description: '' });
      setShowAddNoteModal(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Add task handler
  const handleAddTask = async () => {
    if (!selectedDeal || !taskForm.subject.trim()) return;

    setIsSavingTask(true);
    try {
      const scheduledAt = taskForm.scheduled_date && taskForm.scheduled_time
        ? new Date(`${taskForm.scheduled_date}T${taskForm.scheduled_time}`).toISOString()
        : taskForm.scheduled_date
        ? new Date(`${taskForm.scheduled_date}T00:00`).toISOString()
        : null;

      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{
          activity_type: taskForm.activity_type,
          subject: taskForm.subject.trim(),
          description: taskForm.description.trim() || null,
          deal_id: selectedDeal.id,
          crm_company_id: selectedDeal.crm_company_id || null,
          scheduled_at: scheduledAt,
          duration_minutes: taskForm.duration_minutes ? Number(taskForm.duration_minutes) : null,
          is_completed: false,
          created_by: state.currentUser?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: [...prev.crmActivities, data]
      }));

      setTaskForm({
        activity_type: ActivityType.TASK,
        subject: '',
        description: '',
        scheduled_date: '',
        scheduled_time: '',
        duration_minutes: ''
      });
      setShowAddTaskModal(false);
    } catch (error) {
      console.error('Failed to add task:', error);
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten deal?')) return;
    try {
      await deleteCrmDeal(dealId);
      setSelectedDeal(null);
    } catch (error) {
      console.error('Failed to delete deal:', error);
    }
  };

  const openNewDealModal = (stageId: string) => {
    setNewDealStage(stageId);
    setShowNewDealModal(true);
  };

  // Stage management functions
  const handleEditStageName = (stageId: string, currentName: string) => {
    setEditingStage(stageId);
    setEditedStageName(currentName);
  };

  const handleSaveStageName = (stageId: string) => {
    if (editedStageName.trim()) {
      setStages(prev => prev.map(s =>
        s.id === stageId ? { ...s, name: editedStageName.trim() } : s
      ));
    }
    setEditingStage(null);
    setEditedStageName('');
  };

  const handleAddStage = () => {
    const newId = `custom_${Date.now()}`;
    const usedColors = stages.map(s => s.color);
    const availableColor = STAGE_COLORS.find(c => !usedColors.includes(c)) || STAGE_COLORS[stages.length % STAGE_COLORS.length];

    setStages(prev => [...prev, {
      id: newId,
      name: 'Nowy status',
      color: availableColor
    }]);
  };

  const handleDeleteStage = (stageId: string) => {
    const stageDeals = dealsByStage[stageId] || [];
    if (stageDeals.length > 0) {
      alert('Nie można usunąć statusu, który zawiera deale. Najpierw przenieś deale do innego statusu.');
      return;
    }

    if (stages.length <= 1) {
      alert('Musisz mieć co najmniej jeden status.');
      return;
    }

    if (confirm('Czy na pewno chcesz usunąć ten status?')) {
      setStages(prev => prev.filter(s => s.id !== stageId));
    }
  };

  const DealCard = ({ deal }: { deal: CRMDeal }) => {
    const company = crmCompanies.find(c => c.id === deal.crm_company_id);
    return (
      <div draggable onDragStart={() => handleDragStart(deal.id)} onClick={() => setSelectedDeal(deal)}
        className={`bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${draggedDeal === deal.id ? 'opacity-50 scale-95' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-slate-900 text-sm line-clamp-2">{deal.title}</h4>
          {deal.priority === DealPriority.URGENT && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">!</span>}
        </div>
        {company && <p className="text-xs text-slate-500 mb-2">{company.name}</p>}
        <div className="space-y-1.5">
          {deal.value && (<div className="flex items-center gap-1.5 text-sm"><DollarSign className="w-3.5 h-3.5 text-green-500" /><span className="font-semibold text-green-700">{formatCurrency(deal.value)}</span></div>)}
          {deal.expected_close_date && (<div className="flex items-center gap-1.5 text-xs text-slate-500"><Calendar className="w-3 h-3" /><span>{new Date(deal.expected_close_date).toLocaleDateString('pl-PL')}</span></div>)}
          {deal.employee_count_estimate && (<div className="flex items-center gap-1.5 text-xs text-slate-500"><User className="w-3 h-3" /><span>{deal.employee_count_estimate} użytkowników</span></div>)}
        </div>
        {deal.modules_interested && deal.modules_interested.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
            {deal.modules_interested.map(mod => (<span key={mod} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{MODULE_LABELS[mod] || mod}</span>))}
          </div>
        )}
      </div>
    );
  };

  const KanbanColumn = ({ stage }: { stage: CustomStage }) => {
    const stageDeals = dealsByStage[stage.id] || [];
    const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

    return (
      <div onDragOver={handleDragOver} onDrop={() => handleDrop(stage.id)} className="flex-1 min-w-[280px] max-w-[320px] bg-slate-50 rounded-xl p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${stage.color}`} />
            {editingStage === stage.id ? (
              <input
                type="text"
                value={editedStageName}
                onChange={(e) => setEditedStageName(e.target.value)}
                onBlur={() => handleSaveStageName(stage.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveStageName(stage.id);
                  if (e.key === 'Escape') {
                    setEditingStage(null);
                    setEditedStageName('');
                  }
                }}
                className="font-semibold text-slate-900 bg-white border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <h3
                className="font-semibold text-slate-900 cursor-pointer hover:text-blue-600 truncate"
                onClick={() => handleEditStageName(stage.id, stage.name)}
                title="Kliknij, aby edytować nazwę"
              >
                {stage.name}
              </h3>
            )}
            <span className="text-xs text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full flex-shrink-0">{stageDeals.length}</span>
          </div>
          <button
            onClick={() => handleDeleteStage(stage.id)}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Usuń status"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm text-slate-600 mb-3 pb-3 border-b border-slate-200">{formatCurrency(totalValue)}</div>
        <div className="space-y-2 min-h-[200px]">
          {stageDeals.map(deal => (<DealCard key={deal.id} deal={deal} />))}
        </div>
        <button
          onClick={() => openNewDealModal(stage.id)}
          className="w-full mt-3 py-2 text-slate-500 hover:text-blue-600 text-sm font-medium border border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />Dodaj deal
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM</h1>
          <p className="text-slate-500 mt-1">Zarządzaj dealami metodą Kanban</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Szukaj deali..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <button
            onClick={() => openNewDealModal(stages[0]?.id || DealStage.LEAD)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />Nowy Deal
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (<KanbanColumn key={stage.id} stage={stage} />))}

        {/* Add new stage button */}
        <div className="flex-shrink-0">
          <button
            onClick={handleAddStage}
            className="w-[280px] h-full min-h-[400px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-8 h-8" />
            <span className="font-medium">Dodaj status</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-green-800">Wygrane</h3><p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency((dealsByStage[DealStage.WON] || []).reduce((sum, d) => sum + (d.value || 0), 0))}</p></div>
            <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm font-medium">{(dealsByStage[DealStage.WON] || []).length} deali</span>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-red-800">Przegrane</h3><p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency((dealsByStage[DealStage.LOST] || []).reduce((sum, d) => sum + (d.value || 0), 0))}</p></div>
            <span className="text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm font-medium">{(dealsByStage[DealStage.LOST] || []).length} deali</span>
          </div>
        </div>
      </div>

      {/* New Deal Modal */}
      {showNewDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Nowy Deal</h3>
              <button onClick={() => setShowNewDealModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa deala *</label>
                <input
                  type="text"
                  value={newDeal.title}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="np. Firma XYZ - Wdrożenie systemu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                <div className="flex gap-2">
                  <select
                    value={newDeal.crm_company_id}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, crm_company_id: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Wybierz firmę...</option>
                    {crmCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCompanyModal(true)}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
                    title="Dodaj nową firmę"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data zamknięcia</label>
                  <input
                    type="date"
                    value={newDeal.expected_close_date}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, expected_close_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Liczba użytkowników</label>
                  <input
                    type="number"
                    value={newDeal.employee_count_estimate}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, employee_count_estimate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="np. 50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
                <select
                  value={newDeal.priority}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, priority: e.target.value as DealPriority }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.values(DealPriority).map(p => (
                    <option key={p} value={p}>{DEAL_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zainteresowane moduły</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MODULE_LABELS).map(([code, label]) => (
                    <label key={code} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newDeal.modules_interested.includes(code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewDeal(prev => ({ ...prev, modules_interested: [...prev.modules_interested, code] }));
                          } else {
                            setNewDeal(prev => ({ ...prev, modules_interested: prev.modules_interested.filter(m => m !== code) }));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{label} ({getModulePrice(code)} PLN/użytk./mies.)</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Calculated Value Display */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Szacowana wartość miesięczna</label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={newDeal.manualValue}
                      onChange={(e) => setNewDeal(prev => ({ ...prev, manualValue: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600">Wpisz ręcznie</span>
                  </label>
                </div>
                {newDeal.manualValue ? (
                  <input
                    type="number"
                    value={newDeal.value}
                    onChange={(e) => setNewDeal(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Wpisz wartość..."
                  />
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(calculatedNewDealValue)}
                    {calculatedNewDealValue > 0 && (
                      <span className="text-xs font-normal text-slate-500 ml-2">
                        ({newDeal.modules_interested.length} moduł(y) × {newDeal.employee_count_estimate || 0} użytk.)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                <textarea
                  value={newDeal.notes}
                  onChange={(e) => setNewDeal(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Dodatkowe informacje..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowNewDealModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreateDeal}
                disabled={!newDeal.title.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Utwórz deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deal Detail Modal */}
      {selectedDeal && !isEditingDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{selectedDeal.title}</h3>
              <button onClick={() => { setSelectedDeal(null); setDealDetailTab('details'); setEditingModules(false); setEditingPriority(false); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tags - Stage and Priority (clickable) */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${DEAL_STAGE_COLORS[selectedDeal.stage] || 'bg-slate-100 text-slate-700'}`}>
                {stages.find(s => s.id === selectedDeal.stage)?.name || DEAL_STAGE_LABELS[selectedDeal.stage] || selectedDeal.stage}
              </span>
              {editingPriority ? (
                <select
                  value={selectedDeal.priority}
                  onChange={(e) => handleUpdateDealPriority(e.target.value as DealPriority)}
                  onBlur={() => setEditingPriority(false)}
                  autoFocus
                  className="px-2 py-1 text-sm font-medium border border-blue-300 rounded-full focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {Object.values(DealPriority).map(p => (
                    <option key={p} value={p}>{DEAL_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => setEditingPriority(true)}
                  className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer hover:opacity-80 transition flex items-center gap-1 ${DEAL_PRIORITY_COLORS[selectedDeal.priority]}`}
                >
                  {DEAL_PRIORITY_LABELS[selectedDeal.priority]}
                  <Edit3 className="w-3 h-3 opacity-50" />
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-slate-200">
              <button
                onClick={() => setDealDetailTab('details')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${dealDetailTab === 'details' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Szczegóły
              </button>
              <button
                onClick={() => setDealDetailTab('history')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1 ${dealDetailTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <History className="w-4 h-4" />
                Historia
                {getDealActivities(selectedDeal.id).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">
                    {getDealActivities(selectedDeal.id).length}
                  </span>
                )}
              </button>
            </div>

            {/* Details Tab */}
            {dealDetailTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Wartość</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedDeal.value || 0)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Liczba użytkowników</p>
                    <p className="text-lg font-bold text-slate-900">{selectedDeal.employee_count_estimate || '—'}</p>
                  </div>
                </div>

                {selectedDeal.expected_close_date && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>Planowane zamknięcie: {new Date(selectedDeal.expected_close_date).toLocaleDateString('pl-PL')}</span>
                  </div>
                )}

                {/* Editable Modules */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-500">Zainteresowane moduły:</p>
                    <button
                      onClick={() => setEditingModules(!editingModules)}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      {editingModules ? 'Anuluj' : 'Edytuj'}
                    </button>
                  </div>
                  {editingModules ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(MODULE_LABELS).map(([code, label]) => (
                          <label key={code} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedDeal.modules_interested?.includes(code) || false}
                              onChange={(e) => {
                                const newModules = e.target.checked
                                  ? [...(selectedDeal.modules_interested || []), code]
                                  : (selectedDeal.modules_interested || []).filter(m => m !== code);
                                handleUpdateDealModules(newModules);
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedDeal.modules_interested && selectedDeal.modules_interested.length > 0 ? (
                        selectedDeal.modules_interested.map(mod => (
                          <span key={mod} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full cursor-pointer hover:bg-blue-200" onClick={() => setEditingModules(true)}>
                            {MODULE_LABELS[mod] || mod}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-sm">Brak wybranych modułów</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Company info */}
                {selectedDeal.crm_company_id && crmCompanies.find(c => c.id === selectedDeal.crm_company_id) && (
                  <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-3 rounded-lg">
                    <Building2 className="w-4 h-4" />
                    <span>{crmCompanies.find(c => c.id === selectedDeal.crm_company_id)?.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {dealDetailTab === 'history' && (
              <div className="space-y-4">
                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddNoteModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                  >
                    <FileText className="w-4 h-4" />
                    Dodaj notatkę
                  </button>
                  <button
                    onClick={() => setShowAddTaskModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Dodaj zadanie
                  </button>
                </div>

                {/* Activities list */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {getDealActivities(selectedDeal.id).length > 0 ? (
                    getDealActivities(selectedDeal.id).map(activity => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.activity_type)}`}>
                          {getActivityIcon(activity.activity_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getActivityColor(activity.activity_type)}`}>
                              {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                            </span>
                            {activity.is_completed && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Ukończone</span>
                            )}
                          </div>
                          <p className="font-medium text-slate-900 text-sm">{activity.subject}</p>
                          {activity.description && (
                            <p className="text-sm text-slate-500 mt-1">{activity.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(activity.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Brak historii aktywności</p>
                      <p className="text-xs mt-1">Dodaj notatkę lub zadanie</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={openEditDealModal}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edytuj
              </button>
              <button
                onClick={() => handleDeleteDeal(selectedDeal.id)}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {selectedDeal && isEditingDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Edytuj Deal</h3>
              <button onClick={() => setIsEditingDeal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa deala *</label>
                <input
                  type="text"
                  value={editDealForm.title}
                  onChange={(e) => setEditDealForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Firma</label>
                <select
                  value={editDealForm.crm_company_id}
                  onChange={(e) => setEditDealForm(prev => ({ ...prev, crm_company_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Wybierz firmę...</option>
                  {crmCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data zamknięcia</label>
                  <input
                    type="date"
                    value={editDealForm.expected_close_date}
                    onChange={(e) => setEditDealForm(prev => ({ ...prev, expected_close_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Liczba użytkowników</label>
                  <input
                    type="number"
                    value={editDealForm.employee_count_estimate}
                    onChange={(e) => setEditDealForm(prev => ({ ...prev, employee_count_estimate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priorytet</label>
                <select
                  value={editDealForm.priority}
                  onChange={(e) => setEditDealForm(prev => ({ ...prev, priority: e.target.value as DealPriority }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.values(DealPriority).map(p => (
                    <option key={p} value={p}>{DEAL_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zainteresowane moduły</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MODULE_LABELS).map(([code, label]) => (
                    <label key={code} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editDealForm.modules_interested.includes(code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditDealForm(prev => ({ ...prev, modules_interested: [...prev.modules_interested, code] }));
                          } else {
                            setEditDealForm(prev => ({ ...prev, modules_interested: prev.modules_interested.filter(m => m !== code) }));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{label} ({getModulePrice(code)} PLN/użytk./mies.)</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Calculated Value Display */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Szacowana wartość miesięczna</label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={editDealForm.manualValue}
                      onChange={(e) => setEditDealForm(prev => ({ ...prev, manualValue: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-600">Wpisz ręcznie</span>
                  </label>
                </div>
                {editDealForm.manualValue ? (
                  <input
                    type="number"
                    value={editDealForm.value}
                    onChange={(e) => setEditDealForm(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Wpisz wartość..."
                  />
                ) : (
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(calculatedEditDealValue)}
                    {calculatedEditDealValue > 0 && (
                      <span className="text-xs font-normal text-slate-500 ml-2">
                        ({editDealForm.modules_interested.length} moduł(y) × {editDealForm.employee_count_estimate || 0} użytk.)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsEditingDeal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveEditDeal}
                disabled={!editDealForm.title.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj firmę</h3>
              <button onClick={() => { setShowAddCompanyModal(false); resetCompanyForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NIP with GUS Search */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={companyForm.tax_id}
                      onChange={(e) => setCompanyForm(prev => ({ ...prev, tax_id: e.target.value }))}
                      placeholder="0000000000"
                      maxLength={10}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={searchGUS}
                      disabled={isSearchingGUS || companyForm.tax_id.replace(/[\s-]/g, '').length !== 10}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {isSearchingGUS ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Szukam...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Szukaj w GUS
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Wpisz NIP i kliknij "Szukaj w GUS" aby automatycznie wypełnić dane</p>
                  {gusError && <p className="text-xs text-red-600 mt-1">{gusError}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                  <input
                    type="text"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa prawna</label>
                  <input
                    type="text"
                    value={companyForm.legal_name}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, legal_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">REGON</label>
                  <input
                    type="text"
                    value={companyForm.regon}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, regon: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branża</label>
                  <select
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Wybierz branżę</option>
                    {INDUSTRY_OPTIONS.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
                  <input
                    type="text"
                    value={companyForm.address_street}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, address_street: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
                  <input
                    type="text"
                    value={companyForm.address_city}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, address_city: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
                  <input
                    type="text"
                    value={companyForm.address_postal_code}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, address_postal_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Liczba pracowników</label>
                  <input
                    type="number"
                    value={companyForm.employee_count}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, employee_count: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status CRM</label>
                  <select
                    value={companyForm.status}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CRM_STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowAddCompanyModal(false); resetCompanyForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleAddCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!companyForm.name}
                >
                  Dodaj firmę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNoteModal && selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Dodaj notatkę</h3>
              <button onClick={() => setShowAddNoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł *</label>
                <input
                  type="text"
                  value={noteForm.subject}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="np. Rozmowa telefoniczna"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Treść</label>
                <textarea
                  value={noteForm.description}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Opis rozmowy, ustalenia..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAddNoteModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteForm.subject.trim() || isSavingNote}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingNote ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Dodaj zadanie</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Typ zadania *</label>
                <select
                  value={taskForm.activity_type}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, activity_type: e.target.value as ActivityType }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={ActivityType.TASK}>Zadanie</option>
                  <option value={ActivityType.CALL}>Rozmowa telefoniczna</option>
                  <option value={ActivityType.EMAIL}>E-mail</option>
                  <option value={ActivityType.MEETING}>Spotkanie</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
                <input
                  type="text"
                  value={taskForm.subject}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nazwa zadania"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder="Opis zadania..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data wykonania</label>
                  <input
                    type="date"
                    value={taskForm.scheduled_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Godzina</label>
                  <input
                    type="time"
                    value={taskForm.scheduled_time}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Czas trwania (minuty)</label>
                <input
                  type="number"
                  value={taskForm.duration_minutes}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, duration_minutes: e.target.value ? parseInt(e.target.value) : '' }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="np. 30"
                  min="1"
                />
              </div>

              {/* Deal info */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-600 mb-1">Powiązany deal</p>
                <p className="font-medium text-blue-900">{selectedDeal.title}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddTask}
                disabled={!taskForm.subject.trim() || isSavingTask}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingTask ? 'Zapisywanie...' : 'Dodaj zadanie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
