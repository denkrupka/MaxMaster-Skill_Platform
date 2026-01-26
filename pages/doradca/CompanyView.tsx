import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Clock, Search,
  User, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Mail, Phone, Calendar, Building2, Monitor, CreditCard, X, Package,
  FileText, Receipt, ArrowRight, History, Download, Plus, Minus, Check, Loader2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { UserStatus, User as UserType, Role } from '../../types';
import { Button } from '../../components/Button';
import { ROLE_LABELS } from '../../constants';
import { supabase } from '../../lib/supabase';

export const DoradcaCompanyView: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const { state, loginAsUser, refreshData } = useAppContext();
  const { companies, users, companyModules, modules } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Modal states
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserType | null>(null);
  const [showUserCabinet, setShowUserCabinet] = useState(false);
  const [subscriptionTab, setSubscriptionTab] = useState<'subscriptions' | 'payments' | 'history' | 'invoices'>('subscriptions');

  // Subscription data states
  const [bonusHistory, setBonusHistory] = useState<Array<{
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
    created_by?: string;
  }>>([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState<Array<{
    id: string;
    action: string;
    module_code?: string;
    details: string;
    created_at: string;
  }>>([]);
  const [loadingSubscriptionData, setLoadingSubscriptionData] = useState(false);

  // Module settings modal state
  const [showModuleSettingsModal, setShowModuleSettingsModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [moduleMaxUsers, setModuleMaxUsers] = useState(10);
  const [moduleDemoEndDate, setModuleDemoEndDate] = useState('');
  const [loadingModule, setLoadingModule] = useState(false);

  // Get current company
  const company = companies.find(c => c.id === companyId);

  // Get company users
  const companyUsers = useMemo(() => {
    return (users || []).filter(u => u.company_id === companyId);
  }, [users, companyId]);

  // Get company modules/subscriptions
  const companySubscriptions = useMemo(() => {
    return (companyModules || [])
      .filter(cm => cm.company_id === companyId && cm.is_active)
      .map(cm => {
        const module = (modules || []).find(m => m.code === cm.module_code);
        return { ...cm, module };
      });
  }, [companyModules, modules, companyId]);

  // Get all company modules (active and inactive)
  const getCompanyModules = (cmpId: string) => {
    return (companyModules || []).filter(cm => cm.company_id === cmpId);
  };

  // Format subscription status display
  // Logic:
  // - If at least one paid subscription (has stripe_subscription_id) -> AKTYWNA
  // - If only demo (is_active but no stripe_subscription_id) -> DEMO
  // - Otherwise -> BRAK
  const formatSubscriptionDisplay = (): { text: string; color: string } => {
    if (!company) return { text: 'BRAK', color: 'bg-gray-100 text-gray-800' };

    const activeModules = getCompanyModules(company.id).filter(m => m.is_active);

    // Check for any paid subscription (has stripe_subscription_id)
    const hasPaidSubscription = activeModules.some(m => m.stripe_subscription_id);

    if (hasPaidSubscription) {
      return { text: 'AKTYWNA', color: 'bg-green-100 text-green-800' };
    }

    // Check for DEMO (active modules without stripe subscription)
    const hasDemoModules = activeModules.some(m => !m.stripe_subscription_id);
    if (hasDemoModules) {
      return { text: 'DEMO', color: 'bg-blue-100 text-blue-800' };
    }

    // No subscriptions
    return { text: 'BRAK', color: 'bg-gray-100 text-gray-800' };
  };

  // Get module subscription status for display
  const getModuleStatus = (moduleCode: string) => {
    if (!company) return { status: 'none', text: 'Nieaktywny', color: 'bg-gray-100 text-gray-800 border-gray-200' };

    const companyMod = (companyModules || []).find(cm => cm.company_id === company.id && cm.module_code === moduleCode);
    if (!companyMod) {
      return { status: 'none', text: 'Nieaktywny', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
    if (companyMod.is_active) {
      // Check if it's a paid subscription (has Stripe ID) or demo
      if (companyMod.stripe_subscription_id) {
        return {
          status: 'active',
          text: `Aktywna (${companyMod.max_users} os.)`,
          color: 'bg-green-100 text-green-800 border-green-200',
          maxUsers: companyMod.max_users,
          pricePerUser: companyMod.price_per_user
        };
      }
      // Demo module - check per-module demo_end_date first, then fallback to company's trial_ends_at
      const demoEndDate = companyMod.demo_end_date;
      const effectiveDemoDate = demoEndDate || company.trial_ends_at;

      if (effectiveDemoDate) {
        const endDateStr = new Date(effectiveDemoDate).toLocaleDateString('pl-PL');
        return {
          status: 'demo',
          text: `DEMO do ${endDateStr} (${companyMod.max_users} os.)`,
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          maxUsers: companyMod.max_users,
          demoEndDate: effectiveDemoDate
        };
      }
      return {
        status: 'demo',
        text: `DEMO (${companyMod.max_users} os.)`,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        maxUsers: companyMod.max_users
      };
    }
    return { status: 'inactive', text: 'Nieaktywny', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  // Get payment history for company
  const paymentHistory = useMemo(() => {
    if (!company) return [];
    return (state.paymentHistory || []).filter(ph => ph.company_id === company.id);
  }, [state.paymentHistory, company]);

  // Load bonus and subscription history when modal opens
  useEffect(() => {
    const loadSubscriptionData = async () => {
      if (!showSubscriptionModal || !company) return;

      setLoadingSubscriptionData(true);
      try {
        // Load bonus history
        const { data: bonusData } = await supabase
          .from('bonus_transactions')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false });

        setBonusHistory(bonusData || []);

        // Load subscription history
        const { data: historyData } = await supabase
          .from('subscription_history')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false });

        setSubscriptionHistory(historyData || []);
      } catch (error) {
        console.error('Error loading subscription data:', error);
        setBonusHistory([]);
        setSubscriptionHistory([]);
      } finally {
        setLoadingSubscriptionData(false);
      }
    };

    loadSubscriptionData();
  }, [showSubscriptionModal, company]);

  // Log subscription change
  const logSubscriptionChange = async (companyId: string, action: string, moduleCode?: string, details?: string) => {
    const newEntry = {
      id: Date.now().toString(),
      action,
      module_code: moduleCode,
      details: details || '',
      created_at: new Date().toISOString()
    };

    // Add to local state for immediate display
    setSubscriptionHistory(prev => [newEntry, ...prev]);

    // Try to persist to database
    const { error } = await supabase.from('subscription_history').insert({
      company_id: companyId,
      action,
      module_code: moduleCode,
      details: details || '',
      created_by: state.currentUser?.id
    });

    if (error) {
      console.log('Could not log subscription change (table may not exist):', error);
    }
  };

  // Open module settings modal
  const openModuleSettings = (mod: any) => {
    if (!company) return;

    const companyMod = (companyModules || []).find(cm => cm.company_id === company.id && cm.module_code === mod.code);
    setSelectedModule(mod);
    setModuleMaxUsers(companyMod?.max_users || 10);
    // Pre-populate demo date if set
    if (companyMod?.demo_end_date) {
      setModuleDemoEndDate(companyMod.demo_end_date.split('T')[0]);
    } else {
      setModuleDemoEndDate('');
    }
    setShowModuleSettingsModal(true);
  };

  // Handle save module settings
  const handleSaveModuleSettings = async () => {
    if (!company || !selectedModule) return;

    setLoadingModule(true);
    try {
      const existingModule = (companyModules || []).find(cm => cm.company_id === company.id && cm.module_code === selectedModule.code);
      const oldMaxUsers = existingModule?.max_users || 0;
      const oldDemoEndDate = existingModule?.demo_end_date;

      if (existingModule) {
        // Update existing module - include demo_end_date
        const updateData: any = { max_users: moduleMaxUsers };
        if (moduleDemoEndDate) {
          updateData.demo_end_date = moduleDemoEndDate;
          updateData.is_active = true; // Activate module when setting demo
        }

        const { error } = await supabase
          .from('company_modules')
          .update(updateData)
          .eq('id', existingModule.id);
        if (error) throw error;

        if (oldMaxUsers !== moduleMaxUsers) {
          await logSubscriptionChange(
            company.id,
            'USERS_CHANGED',
            selectedModule.code,
            `Zmieniono liczbę użytkowników w module ${selectedModule.name_pl}: ${oldMaxUsers} → ${moduleMaxUsers}`
          );
        }

        // Log demo change if date was set or changed
        if (moduleDemoEndDate && moduleDemoEndDate !== oldDemoEndDate) {
          await logSubscriptionChange(
            company.id,
            'DEMO_STARTED',
            selectedModule.code,
            `Ustawiono okres DEMO dla modułu ${selectedModule.name_pl} do ${new Date(moduleDemoEndDate).toLocaleDateString('pl-PL')}`
          );
        }
      } else {
        // Create new module with settings (including demo if set)
        const insertData: any = {
          company_id: company.id,
          module_code: selectedModule.code,
          max_users: moduleMaxUsers,
          current_users: 0,
          price_per_user: selectedModule.base_price_per_user,
          billing_cycle: 'monthly',
          is_active: true,
          activated_at: new Date().toISOString()
        };

        if (moduleDemoEndDate) {
          insertData.demo_end_date = moduleDemoEndDate;
        }

        const { error } = await supabase.from('company_modules').insert(insertData);
        if (error) throw error;

        if (moduleDemoEndDate) {
          await logSubscriptionChange(
            company.id,
            'DEMO_STARTED',
            selectedModule.code,
            `Ustawiono okres DEMO dla modułu ${selectedModule.name_pl} do ${new Date(moduleDemoEndDate).toLocaleDateString('pl-PL')}`
          );
        } else {
          await logSubscriptionChange(
            company.id,
            'MODULE_ACTIVATED',
            selectedModule.code,
            `Aktywowano moduł ${selectedModule.name_pl} (${moduleMaxUsers} użytkowników, ${selectedModule.base_price_per_user} PLN/os)`
          );
        }
      }

      // Also update company subscription status if demo was set
      if (moduleDemoEndDate) {
        await supabase
          .from('companies')
          .update({
            subscription_status: 'trialing',
            status: 'active'
          })
          .eq('id', company.id);
      }

      setShowModuleSettingsModal(false);
      // Refresh data without page reload
      await refreshData();
    } catch (error) {
      console.error('Error saving module settings:', error);
      alert('Błąd podczas zapisywania ustawień modułu');
    } finally {
      setLoadingModule(false);
    }
  };

  // Handle end demo for a module
  const handleEndDemo = async () => {
    if (!company || !selectedModule) return;

    setLoadingModule(true);
    try {
      const existingModule = (companyModules || []).find(cm => cm.company_id === company.id && cm.module_code === selectedModule.code);
      if (!existingModule) return;

      const { error } = await supabase
        .from('company_modules')
        .update({
          demo_end_date: null,
          is_active: false,
          deactivated_at: new Date().toISOString()
        })
        .eq('id', existingModule.id);

      if (error) throw error;

      await logSubscriptionChange(
        company.id,
        'DEMO_ENDED',
        selectedModule.code,
        `Zakończono DEMO dla modułu ${selectedModule.name_pl}`
      );

      setShowModuleSettingsModal(false);
      // Refresh data without page reload
      await refreshData();
    } catch (error) {
      console.error('Error ending demo:', error);
      alert('Błąd podczas kończenia DEMO');
    } finally {
      setLoadingModule(false);
    }
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    return companyUsers.filter(user => {
      const matchesSearch =
        user.first_name.toLowerCase().includes(search.toLowerCase()) ||
        user.last_name.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.target_position?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [companyUsers, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = companyUsers.filter(u => u.status === UserStatus.ACTIVE).length;
    const trial = companyUsers.filter(u => u.status === UserStatus.TRIAL).length;
    const pending = companyUsers.filter(u => u.status === UserStatus.PENDING).length;
    return { total: companyUsers.length, active, trial, pending };
  }, [companyUsers]);

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE: return <CheckCircle className="w-4 h-4 text-green-500" />;
      case UserStatus.TRIAL: return <Clock className="w-4 h-4 text-amber-500" />;
      case UserStatus.PENDING: return <AlertTriangle className="w-4 h-4 text-blue-500" />;
      case UserStatus.INACTIVE: return <XCircle className="w-4 h-4 text-slate-400" />;
      default: return null;
    }
  };

  // Handle opening cabinet for selected employee
  const handleSelectEmployee = (employee: UserType) => {
    setSelectedEmployee(employee);
    setShowCabinetModal(false);
    setShowUserCabinet(true);
  };

  // Handle viewing as user - open in new window with user context
  const handleViewAsUser = () => {
    if (selectedEmployee) {
      // Store the selected user in localStorage for the new window to pick up
      localStorage.setItem('doradca_view_as_user', JSON.stringify(selectedEmployee));
      // Open the dashboard in a new window
      window.open(`/#/dashboard`, '_blank');
    }
  };

  if (!company) {
    return (
      <div className="p-6 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Firma nie została znaleziona</p>
        <Link to="/doradca/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
          Wróć do panelu
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/doradca/dashboard"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-slate-500">{company.industry || 'Brak branży'}</p>
          </div>
        </div>
      </div>

      {/* Action Tile-Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setShowCabinetModal(true)}
          className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl p-6 hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <Monitor className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Zarządzanie kontem użytkownika</h3>
              <p className="text-sm text-blue-100">Podgląd panelu pracownika</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setShowSubscriptionModal(true)}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-6 hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Subskrypcja</h3>
              <p className="text-sm text-emerald-100">Zarządzanie subskrypcją firmy</p>
            </div>
          </div>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Łącznie</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              <p className="text-xs text-slate-500">Aktywnych</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.trial}</p>
              <p className="text-xs text-slate-500">Okres próbny</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              <p className="text-xs text-slate-500">Kandydaci</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl mb-6">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj pracownika..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie statusy</option>
            <option value={UserStatus.ACTIVE}>Aktywni</option>
            <option value={UserStatus.TRIAL}>Okres próbny</option>
            <option value={UserStatus.PENDING}>Kandydaci</option>
            <option value={UserStatus.INACTIVE}>Nieaktywni</option>
          </select>
        </div>

        {/* Users List */}
        {filteredUsers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map(user => {
              const isExpanded = expandedUser === user.id;

              return (
                <div key={user.id} className="transition-colors">
                  <div
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {user.first_name} {user.last_name}
                          </p>
                          {getStatusIcon(user.status)}
                        </div>
                        <p className="text-sm text-slate-500">
                          {user.target_position || 'Brak stanowiska'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                      <div className="py-4">
                        {/* Contact Info */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Kontakt</h4>
                          <div className="space-y-2">
                            {user.email && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                              </div>
                            )}
                            {user.phone && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Phone className="w-4 h-4" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                            {user.hired_date && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar className="w-4 h-4" />
                                <span>Od: {new Date(user.hired_date).toLocaleDateString('pl-PL')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {companyUsers.length === 0 ? 'Brak pracowników w tej firmie' : 'Brak pracowników spełniających kryteria'}
            </p>
          </div>
        )}
      </div>

      {/* Cabinet Management Modal - Employee Selection */}
      {showCabinetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCabinetModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Zarządzanie kontem użytkownika</h2>
                  <p className="text-sm text-slate-500">Wybierz pracownika do podglądu</p>
                </div>
              </div>
              <button onClick={() => setShowCabinetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {companyUsers.length > 0 ? (
                <div className="space-y-2">
                  {companyUsers.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100 text-left transition-colors"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</p>
                        <p className="text-sm text-slate-500">{emp.target_position || 'Brak stanowiska'}</p>
                      </div>
                      {getStatusIcon(emp.status)}
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">Brak pracowników w tej firmie</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Cabinet View Modal */}
      {showUserCabinet && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUserCabinet(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-blue-500 to-indigo-600">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div className="text-white">
                  <h2 className="text-xl font-bold">{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                  <p className="text-blue-100">{selectedEmployee.target_position || 'Brak stanowiska'} • {ROLE_LABELS[selectedEmployee.role] || selectedEmployee.role}</p>
                </div>
              </div>
              <button onClick={() => setShowUserCabinet(false)} className="text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* User Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Contact Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Dane kontaktowe</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">{selectedEmployee.email || 'Brak email'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">{selectedEmployee.phone || 'Brak telefonu'}</span>
                    </div>
                  </div>
                </div>

                {/* Status Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedEmployee.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-700' :
                        selectedEmployee.status === UserStatus.TRIAL ? 'bg-amber-100 text-amber-700' :
                        selectedEmployee.status === UserStatus.PENDING ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedEmployee.status === UserStatus.ACTIVE ? 'Aktywny' :
                         selectedEmployee.status === UserStatus.TRIAL ? 'Okres próbny' :
                         selectedEmployee.status === UserStatus.PENDING ? 'Kandydat' : 'Nieaktywny'}
                      </span>
                    </div>
                    {selectedEmployee.hired_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Data zatrudnienia:</span>
                        <span className="font-medium text-slate-900">
                          {new Date(selectedEmployee.hired_date).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    )}
                    {selectedEmployee.contract_end_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Koniec umowy:</span>
                        <span className="font-medium text-slate-900">
                          {new Date(selectedEmployee.contract_end_date).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Szczegóły konta</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Rola:</span>
                    <span className="font-medium text-slate-900">{ROLE_LABELS[selectedEmployee.role] || selectedEmployee.role}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">ID użytkownika:</span>
                    <span className="font-mono text-sm text-slate-500">{selectedEmployee.id.slice(0, 8)}...</span>
                  </div>
                  {selectedEmployee.created_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Konto utworzone:</span>
                      <span className="font-medium text-slate-900">
                        {new Date(selectedEmployee.created_at).toLocaleDateString('pl-PL')}
                      </span>
                    </div>
                  )}
                  {selectedEmployee.source && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Źródło:</span>
                      <span className="font-medium text-slate-900">{selectedEmployee.source}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action to view as user */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900">Zaloguj jako użytkownik</h3>
                    <p className="text-sm text-blue-600">Pełny dostęp do panelu pracownika</p>
                  </div>
                  <Button onClick={handleViewAsUser} className="bg-blue-600 hover:bg-blue-700">
                    <Monitor className="w-4 h-4 mr-2" />
                    Otwórz panel
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <Button variant="secondary" onClick={() => {
                setShowUserCabinet(false);
                setShowCabinetModal(true);
              }} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Wybierz innego
              </Button>
              <Button onClick={() => setShowUserCabinet(false)} className="flex-1">
                Zamknij
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && company && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Subskrypcja - {company.name}</h3>
              <button onClick={() => setShowSubscriptionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subscription Status Card */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">Status subskrypcji</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 ${
                    formatSubscriptionDisplay().color
                  }`}>
                    {formatSubscriptionDisplay().text}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Balans bonusowy</p>
                  <p className="text-xl font-bold text-green-600">{company.bonus_balance?.toFixed(2) || '0.00'} PLN</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-4 border-b border-slate-200 overflow-x-auto">
              <button
                onClick={() => setSubscriptionTab('subscriptions')}
                className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
                  subscriptionTab === 'subscriptions'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Subskrypcje
              </button>
              <button
                onClick={() => setSubscriptionTab('payments')}
                className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
                  subscriptionTab === 'payments'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4 inline mr-2" />
                Płatności
              </button>
              <button
                onClick={() => setSubscriptionTab('history')}
                className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
                  subscriptionTab === 'history'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <History className="w-4 h-4 inline mr-2" />
                Historia
              </button>
              <button
                onClick={() => setSubscriptionTab('invoices')}
                className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
                  subscriptionTab === 'invoices'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Faktury
              </button>
            </div>

            <div className="p-6">
              {/* Subscriptions Tab */}
              {subscriptionTab === 'subscriptions' && (
                <div className="space-y-6">
                  {/* All Modules */}
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Moduły</h4>
                    <div className="space-y-2">
                      {modules.filter(m => m.is_active).map(mod => {
                        const moduleStatus = getModuleStatus(mod.code);
                        return (
                          <button
                            key={mod.code}
                            onClick={() => openModuleSettings(mod)}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition text-left"
                          >
                            <div>
                              <p className="font-medium text-slate-900">{mod.name_pl}</p>
                              <p className="text-sm text-slate-500">{mod.description_pl}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${moduleStatus.color}`}>
                              {moduleStatus.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Payments Tab */}
              {subscriptionTab === 'payments' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Wszystkie transakcje</h4>
                  {(() => {
                    const allTransactions = [
                      ...paymentHistory.map(p => ({
                        id: p.id,
                        type: 'payment' as const,
                        amount: Number(p.amount),
                        description: p.description || `Płatność ${p.invoice_number || ''}`,
                        status: p.status,
                        date: p.paid_at || p.created_at,
                        invoice_url: p.invoice_pdf_url
                      })),
                      ...bonusHistory.map(b => ({
                        id: b.id,
                        type: 'bonus' as const,
                        amount: b.type === 'credit' ? b.amount : -b.amount,
                        description: b.description,
                        status: 'completed' as const,
                        date: b.created_at,
                        invoice_url: undefined
                      }))
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    return allTransactions.length > 0 ? (
                      <div className="space-y-2">
                        {allTransactions.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                tx.type === 'payment' ? 'bg-blue-100' :
                                tx.amount > 0 ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                {tx.type === 'payment' ? (
                                  <CreditCard className="w-4 h-4 text-blue-600" />
                                ) : tx.amount > 0 ? (
                                  <Plus className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Minus className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-slate-900">{tx.description}</p>
                                  {tx.type === 'bonus' && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                                      Bonus
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleString('pl-PL')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className={`font-bold ${
                                tx.type === 'payment' ? 'text-slate-900' :
                                tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {tx.type === 'bonus' && tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} PLN
                              </p>
                              {tx.invoice_url && (
                                <a
                                  href={tx.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>Brak transakcji</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* History Tab */}
              {subscriptionTab === 'history' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Historia zmian subskrypcji</h4>
                  {loadingSubscriptionData ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                    </div>
                  ) : subscriptionHistory.length > 0 ? (
                    <div className="space-y-2">
                      {subscriptionHistory.map(entry => (
                        <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            entry.action === 'MODULE_ACTIVATED' ? 'bg-green-100' :
                            entry.action === 'MODULE_DEACTIVATED' ? 'bg-red-100' :
                            entry.action === 'USERS_CHANGED' ? 'bg-blue-100' :
                            entry.action === 'DEMO_STARTED' ? 'bg-yellow-100' :
                            entry.action === 'DEMO_ENDED' ? 'bg-orange-100' :
                            'bg-slate-100'
                          }`}>
                            {entry.action === 'MODULE_ACTIVATED' && <Check className="w-4 h-4 text-green-600" />}
                            {entry.action === 'MODULE_DEACTIVATED' && <X className="w-4 h-4 text-red-600" />}
                            {entry.action === 'USERS_CHANGED' && <Users className="w-4 h-4 text-blue-600" />}
                            {entry.action === 'DEMO_STARTED' && <Calendar className="w-4 h-4 text-yellow-600" />}
                            {entry.action === 'DEMO_ENDED' && <X className="w-4 h-4 text-orange-600" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{entry.details}</p>
                            <p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString('pl-PL')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>Brak historii zmian subskrypcji</p>
                    </div>
                  )}
                </div>
              )}

              {/* Invoices Tab */}
              {subscriptionTab === 'invoices' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Faktury i płatności</h4>
                  {paymentHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nr faktury</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Kwota</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paymentHistory.map(payment => (
                            <tr key={payment.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm text-slate-900">
                                {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('pl-PL') : new Date(payment.created_at).toLocaleDateString('pl-PL')}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 font-mono">{payment.invoice_number || '-'}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-slate-900">{Number(payment.amount).toFixed(2)} {payment.currency || 'PLN'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  payment.status === 'refunded' ? 'bg-blue-100 text-blue-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {payment.status === 'paid' ? 'Opłacona' : payment.status === 'failed' ? 'Niepowodzenie' : payment.status === 'refunded' ? 'Zwrócona' : 'Oczekująca'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {payment.invoice_pdf_url && (
                                  <a href={payment.invoice_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm">
                                    <Download className="w-4 h-4" /> Pobierz
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>Brak historii płatności</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module Settings Modal */}
      {showModuleSettingsModal && company && selectedModule && (() => {
        const moduleStatus = getModuleStatus(selectedModule.code);
        const companyMod = (companyModules || []).find(cm => cm.company_id === company.id && cm.module_code === selectedModule.code);
        const hasPaidSubscription = moduleStatus.status === 'active' && companyMod?.stripe_subscription_id;
        const hasActiveDemo = moduleStatus.status === 'demo' && companyMod?.is_active && (companyMod?.demo_end_date || moduleStatus.demoEndDate);
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Ustawienia modułu</h3>
              <button onClick={() => setShowModuleSettingsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-900">{selectedModule.name_pl}</p>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${moduleStatus.color}`}>
                  {moduleStatus.text}
                </span>
              </div>
              <p className="text-sm text-slate-500">{selectedModule.description_pl}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Liczba użytkowników</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModuleMaxUsers(Math.max(1, moduleMaxUsers - 1))}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={moduleMaxUsers}
                    onChange={(e) => setModuleMaxUsers(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setModuleMaxUsers(moduleMaxUsers + 1)}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {!hasPaidSubscription && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Okres DEMO do</label>
                  <input
                    type="date"
                    value={moduleDemoEndDate}
                    onChange={(e) => setModuleDemoEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {hasPaidSubscription && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    Subskrypcja opłacona. Nie można dodać okresu DEMO.
                  </p>
                </div>
              )}

              {/* End DEMO button when demo is active */}
              {hasActiveDemo && (
                <button
                  onClick={handleEndDemo}
                  disabled={loadingModule}
                  className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-red-200"
                >
                  {loadingModule ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Kończę...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Zakończ DEMO
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModuleSettingsModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveModuleSettings}
                disabled={loadingModule}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingModule ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Zapisuję...
                  </>
                ) : (
                  'Zapisz'
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
