
import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, Minus, Building2, Users, CreditCard, Lock, Unlock,
  Edit2, Trash2, Eye, X, MoreVertical, Check, AlertCircle, Loader2,
  Calendar, History, FileText, Download, PlusCircle, Wallet, UserPlus,
  Mail, Phone, ChevronDown
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Company, CompanyStatus, SubscriptionStatus, User, PaymentHistory } from '../../types';
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_COLORS } from '../../constants';
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase';

export const SuperAdminCompaniesPage: React.FC = () => {
  const { state, addCompany, updateCompany, deleteCompany, blockCompany, unblockCompany, refreshData } = useAppContext();
  const { companies, users, companyModules, modules } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // New modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [subscriptionTab, setSubscriptionTab] = useState<'subscriptions' | 'payments' | 'history' | 'invoices'>('subscriptions');

  // Subscription history state
  const [subscriptionHistory, setSubscriptionHistory] = useState<Array<{
    id: string;
    action: string;
    module_code?: string;
    details: string;
    created_at: string;
  }>>([]);

  // Bonus modal state
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusDescription, setBonusDescription] = useState('');
  const [bonusHistory, setBonusHistory] = useState<Array<{
    id: string;
    amount: number;
    type: 'credit' | 'debit';
    description: string;
    created_at: string;
    created_by?: string;
  }>>([]);
  const [loadingBonus, setLoadingBonus] = useState(false);

  // Subscription modal state
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
  const [subscriptionType, setSubscriptionType] = useState<'demo' | 'full'>('full');
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  // Module settings modal state
  const [showModuleSettingsModal, setShowModuleSettingsModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [moduleMaxUsers, setModuleMaxUsers] = useState(10);
  const [moduleDemoEndDate, setModuleDemoEndDate] = useState('');
  const [loadingModule, setLoadingModule] = useState(false);

  // User modal state
  const [showUserFormModal, setShowUserFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'company_admin',
    phone: '',
    plain_password: ''
  });

  // GUS search state
  const [isSearchingGUS, setIsSearchingGUS] = useState(false);
  const [gusError, setGusError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    legal_name: '',
    tax_id: '',
    regon: '',
    address_street: '',
    address_city: '',
    address_postal_code: '',
    contact_email: '',
    contact_phone: '',
    billing_email: ''
  });

  // Get users count for company
  const getCompanyUsersCount = (companyId: string): number => {
    return users.filter(u => u.company_id === companyId).length;
  };

  // Get modules for company
  const getCompanyModules = (companyId: string) => {
    return companyModules.filter(cm => cm.company_id === companyId);
  };

  // Get users for company
  const getCompanyUsers = (companyId: string): User[] => {
    return users.filter(u => u.company_id === companyId);
  };

  // Get payment history for company
  const getCompanyPaymentHistory = (companyId: string): PaymentHistory[] => {
    return (state.paymentHistory || []).filter(ph => ph.company_id === companyId);
  };

  // Format subscription status display
  const formatSubscriptionDisplay = (company: Company): { text: string; color: string } => {
    const activeModules = getCompanyModules(company.id).filter(m => m.is_active);
    if (activeModules.length > 0) {
      return { text: 'AKTYWNA', color: 'bg-green-100 text-green-800 border-green-200' };
    }
    if (company.subscription_status === 'trialing') {
      return { text: 'DEMO', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    if (company.subscription_status === 'past_due') {
      return { text: 'ZALEGŁA PŁATNOŚĆ', color: 'bg-red-100 text-red-800 border-red-200' };
    }
    return { text: 'BRAK', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  // Get module subscription status for display
  const getModuleStatus = (companyId: string, moduleCode: string) => {
    const companyMod = companyModules.find(cm => cm.company_id === companyId && cm.module_code === moduleCode);
    if (!companyMod) {
      return { status: 'none', text: 'BRAK', color: 'bg-gray-100 text-gray-800 border-gray-200' };
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
      // Demo module - always show user count, and date if available
      const company = companies.find(c => c.id === companyId);
      if (company?.trial_ends_at) {
        const endDate = new Date(company.trial_ends_at).toLocaleDateString('pl-PL');
        return {
          status: 'demo',
          text: `DEMO do ${endDate} (${companyMod.max_users} os.)`,
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          maxUsers: companyMod.max_users,
          demoEndDate: company.trial_ends_at
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

  // Filter companies
  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return companies;
    const searchLower = searchTerm.toLowerCase();
    return companies.filter(company =>
      company.name?.toLowerCase().includes(searchLower) ||
      company.slug?.toLowerCase().includes(searchLower) ||
      company.contact_email?.toLowerCase().includes(searchLower)
    );
  }, [companies, searchTerm]);

  // Stats
  const stats = useMemo(() => ({
    total: companies.length,
    active: companies.filter(c => c.status === 'active').length,
    trial: companies.filter(c => c.status === 'trial' || c.subscription_status === 'trialing').length,
    blocked: companies.filter(c => c.is_blocked).length
  }), [companies]);

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[ąą]/g, 'a')
      .replace(/[ćć]/g, 'c')
      .replace(/[ęę]/g, 'e')
      .replace(/[łł]/g, 'l')
      .replace(/[ńń]/g, 'n')
      .replace(/[óó]/g, 'o')
      .replace(/[śś]/g, 's')
      .replace(/[źżźż]/g, 'z')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Handle form change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'name' ? { slug: generateSlug(value) } : {})
    }));
  };

  // Handle add company
  const handleAddCompany = async () => {
    try {
      await addCompany({
        ...formData,
        status: 'trial' as CompanyStatus,
        subscription_status: 'trialing' as SubscriptionStatus,
        is_blocked: false,
        bonus_balance: 0
      });
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error adding company:', error);
      alert('Błąd podczas dodawania firmy');
    }
  };

  // Handle update company
  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    try {
      await updateCompany(selectedCompany.id, formData);
      setShowEditModal(false);
      setSelectedCompany(null);
      resetForm();
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Błąd podczas aktualizacji firmy');
    }
  };

  // Handle delete company
  const handleDeleteCompany = async (company: Company) => {
    const usersCount = getCompanyUsersCount(company.id);
    if (usersCount > 0) {
      alert(`Nie można usunąć firmy, która ma ${usersCount} użytkowników. Najpierw usuń lub przenieś użytkowników.`);
      return;
    }
    if (window.confirm(`Czy na pewno chcesz usunąć firmę "${company.name}"? Ta operacja jest nieodwracalna.`)) {
      await deleteCompany(company.id);
    }
  };

  // Handle block
  const handleBlock = async () => {
    if (selectedCompany) {
      await blockCompany(selectedCompany.id, blockReason);
      setShowBlockModal(false);
      setBlockReason('');
      setSelectedCompany(null);
    }
  };

  // Handle unblock
  const handleUnblock = async (company: Company) => {
    await unblockCompany(company.id);
  };

  // Handle status change
  const handleStatusChange = async (newStatus: CompanyStatus) => {
    if (!selectedCompany) return;
    try {
      await updateCompany(selectedCompany.id, { status: newStatus });
      setSelectedCompany({ ...selectedCompany, status: newStatus });
      setShowStatusModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Błąd podczas zmiany statusu');
    }
  };

  // Handle subscription status change
  const handleSubscriptionChange = async (newStatus: SubscriptionStatus, endDate?: string) => {
    if (!selectedCompany) return;
    setLoadingSubscription(true);
    try {
      const updates: Partial<Company> = { subscription_status: newStatus };
      if (newStatus === 'trialing' && endDate) {
        updates.trial_ends_at = endDate;
      }
      await updateCompany(selectedCompany.id, updates);
      setSelectedCompany({ ...selectedCompany, ...updates });
      setSubscriptionEndDate('');
      setLoadingSubscription(false);
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Błąd podczas zmiany subskrypcji');
      setLoadingSubscription(false);
    }
  };

  // Open module settings modal
  const openModuleSettings = (mod: any) => {
    const companyMod = getCompanyModules(selectedCompany?.id || '').find(cm => cm.module_code === mod.code);
    setSelectedModule(mod);
    setModuleMaxUsers(companyMod?.max_users || 10);
    setModuleDemoEndDate('');
    setShowModuleSettingsModal(true);
  };

  // Load subscription history
  const loadSubscriptionHistory = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscription_history')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Subscription history table may not exist:', error);
        setSubscriptionHistory([]);
      } else {
        setSubscriptionHistory(data || []);
      }
    } catch (err) {
      console.log('Error loading subscription history:', err);
      setSubscriptionHistory([]);
    }
  };

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

  // Handle toggle module
  const handleToggleModule = async (mod: any, enable: boolean) => {
    if (!selectedCompany) return;
    setLoadingModule(true);
    try {
      const existingModule = getCompanyModules(selectedCompany.id).find(cm => cm.module_code === mod.code);

      if (enable && !existingModule) {
        // Create new company module
        const { error } = await supabase.from('company_modules').insert({
          company_id: selectedCompany.id,
          module_code: mod.code,
          max_users: 10,
          current_users: 0,
          price_per_user: mod.base_price_per_user,
          billing_cycle: 'monthly',
          is_active: true,
          activated_at: new Date().toISOString()
        });
        if (error) throw error;
        await logSubscriptionChange(selectedCompany.id, 'MODULE_ACTIVATED', mod.code, `Aktywowano moduł ${mod.name_pl} (10 użytkowników, ${mod.base_price_per_user} PLN/os)`);
      } else if (existingModule) {
        // Toggle existing module
        const { error } = await supabase
          .from('company_modules')
          .update({ is_active: enable })
          .eq('id', existingModule.id);
        if (error) throw error;
        await logSubscriptionChange(
          selectedCompany.id,
          enable ? 'MODULE_ACTIVATED' : 'MODULE_DEACTIVATED',
          mod.code,
          enable ? `Aktywowano moduł ${mod.name_pl}` : `Dezaktywowano moduł ${mod.name_pl}`
        );
      }

      await refreshData();
    } catch (error) {
      console.error('Error toggling module:', error);
      alert('Błąd podczas zmiany statusu modułu');
    } finally {
      setLoadingModule(false);
    }
  };

  // Handle save module settings
  const handleSaveModuleSettings = async () => {
    if (!selectedCompany || !selectedModule) return;
    setLoadingModule(true);
    try {
      const existingModule = getCompanyModules(selectedCompany.id).find(cm => cm.module_code === selectedModule.code);
      const oldMaxUsers = existingModule?.max_users || 0;

      if (existingModule) {
        // Update existing module
        const { error } = await supabase
          .from('company_modules')
          .update({ max_users: moduleMaxUsers })
          .eq('id', existingModule.id);
        if (error) throw error;
        if (oldMaxUsers !== moduleMaxUsers) {
          await logSubscriptionChange(
            selectedCompany.id,
            'USERS_CHANGED',
            selectedModule.code,
            `Zmieniono liczbę użytkowników w module ${selectedModule.name_pl}: ${oldMaxUsers} → ${moduleMaxUsers}`
          );
        }
      } else {
        // Create new module with settings
        const { error } = await supabase.from('company_modules').insert({
          company_id: selectedCompany.id,
          module_code: selectedModule.code,
          max_users: moduleMaxUsers,
          current_users: 0,
          price_per_user: selectedModule.base_price_per_user,
          billing_cycle: 'monthly',
          is_active: true,
          activated_at: new Date().toISOString()
        });
        if (error) throw error;
        await logSubscriptionChange(
          selectedCompany.id,
          'MODULE_ACTIVATED',
          selectedModule.code,
          `Aktywowano moduł ${selectedModule.name_pl} (${moduleMaxUsers} użytkowników, ${selectedModule.base_price_per_user} PLN/os)`
        );
      }

      // If demo period is set, update company subscription
      if (moduleDemoEndDate) {
        await updateCompany(selectedCompany.id, {
          subscription_status: 'trialing' as SubscriptionStatus,
          trial_ends_at: moduleDemoEndDate,
          status: 'active' as CompanyStatus
        });
        await logSubscriptionChange(
          selectedCompany.id,
          'DEMO_STARTED',
          undefined,
          `Ustawiono okres DEMO do ${new Date(moduleDemoEndDate).toLocaleDateString('pl-PL')}`
        );
      }

      setShowModuleSettingsModal(false);
      await refreshData();
    } catch (error) {
      console.error('Error saving module settings:', error);
      alert('Błąd podczas zapisywania ustawień modułu');
    } finally {
      setLoadingModule(false);
    }
  };

  // Load bonus history
  const loadBonusHistory = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('bonus_transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Bonus history table may not exist:', error);
        setBonusHistory([]);
      } else {
        setBonusHistory(data || []);
      }
    } catch (err) {
      console.log('Error loading bonus history:', err);
      setBonusHistory([]);
    }
  };

  // Handle add bonus
  const handleAddBonus = async () => {
    if (!selectedCompany || !bonusAmount) return;

    const amount = parseFloat(bonusAmount);
    if (isNaN(amount) || amount === 0) {
      alert('Podaj prawidłową kwotę');
      return;
    }

    setLoadingBonus(true);
    try {
      const newBalance = (selectedCompany.bonus_balance || 0) + amount;
      await updateCompany(selectedCompany.id, { bonus_balance: newBalance });

      // Try to save bonus transaction (table may not exist)
      const newBonusEntry = {
        id: Date.now().toString(),
        amount: Math.abs(amount),
        type: amount > 0 ? 'credit' as const : 'debit' as const,
        description: bonusDescription || (amount > 0 ? 'Doładowanie ręczne' : 'Wykorzystanie'),
        created_at: new Date().toISOString()
      };

      // Add to local state for immediate display
      setBonusHistory(prev => [newBonusEntry, ...prev]);

      // Try to persist to database
      const { error } = await supabase.from('bonus_transactions').insert({
        company_id: selectedCompany.id,
        amount: Math.abs(amount),
        type: amount > 0 ? 'credit' : 'debit',
        description: bonusDescription || (amount > 0 ? 'Doładowanie ręczne' : 'Wykorzystanie'),
        created_by: state.currentUser?.id
      });

      if (error) {
        console.log('Could not save bonus transaction (table may not exist):', error);
      }

      setSelectedCompany({ ...selectedCompany, bonus_balance: newBalance });
      setBonusAmount('');
      setBonusDescription('');
    } catch (error) {
      console.error('Error adding bonus:', error);
      alert('Błąd podczas dodawania bonusu');
    } finally {
      setLoadingBonus(false);
    }
  };

  // Handle add user
  const handleAddUser = async () => {
    if (!selectedCompany || !userFormData.email || !userFormData.first_name || !userFormData.last_name) {
      alert('Wypełnij wymagane pola');
      return;
    }

    try {
      // Generate password if not provided
      const password = userFormData.plain_password || Math.random().toString(36).slice(-8);

      const newUser = {
        email: userFormData.email,
        first_name: userFormData.first_name,
        last_name: userFormData.last_name,
        role: userFormData.role,
        phone: userFormData.phone || undefined,
        company_id: selectedCompany.id,
        status: 'active',
        is_global_user: false,
        plain_password: password,
        hired_date: new Date().toISOString().split('T')[0]
      };

      const { data, error } = await supabase.from('users').insert(newUser).select().single();
      if (error) throw error;

      setShowUserFormModal(false);
      setUserFormData({ email: '', first_name: '', last_name: '', role: 'company_admin', phone: '', plain_password: '' });
      // Refresh data
      await refreshData();
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert(error.message || 'Błąd podczas dodawania użytkownika');
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase.from('users').update({
        email: userFormData.email,
        first_name: userFormData.first_name,
        last_name: userFormData.last_name,
        role: userFormData.role,
        phone: userFormData.phone || null
      }).eq('id', editingUser.id);

      if (error) throw error;

      setShowUserFormModal(false);
      setEditingUser(null);
      setUserFormData({ email: '', first_name: '', last_name: '', role: 'company_admin', phone: '', plain_password: '' });
      await refreshData();
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.message || 'Błąd podczas aktualizacji użytkownika');
    }
  };

  // Handle delete user
  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć użytkownika ${user.first_name} ${user.last_name}?`)) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', user.id);
      if (error) throw error;
      await refreshData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Błąd podczas usuwania użytkownika');
    }
  };

  // Open user edit modal
  const openUserEditModal = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone: user.phone || '',
      plain_password: ''
    });
    setShowUserFormModal(true);
  };

  // Open edit modal
  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      slug: company.slug || '',
      legal_name: company.legal_name || '',
      tax_id: company.tax_id || '',
      regon: company.regon || '',
      address_street: company.address_street || '',
      address_city: company.address_city || '',
      address_postal_code: company.address_postal_code || '',
      contact_email: company.contact_email || '',
      contact_phone: company.contact_phone || '',
      billing_email: company.billing_email || ''
    });
    setShowEditModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      legal_name: '',
      tax_id: '',
      regon: '',
      address_street: '',
      address_city: '',
      address_postal_code: '',
      contact_email: '',
      contact_phone: '',
      billing_email: ''
    });
    setGusError(null);
  };

  // Search GUS/DataPort by NIP
  const searchGUS = async () => {
    const cleanNip = formData.tax_id.replace(/[\s-]/g, '');
    if (!cleanNip || cleanNip.length !== 10) {
      setGusError('NIP musi mieć 10 cyfr');
      return;
    }

    // Validate NIP checksum
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
      console.log('Calling GUS search for NIP:', cleanNip);

      const response = await fetch(`${supabaseUrl}/functions/v1/search-gus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ nip: cleanNip })
      });

      console.log('GUS search response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GUS search HTTP error:', response.status, errorText);
        setGusError(`Błąd serwera (${response.status}). Spróbuj później.`);
        setIsSearchingGUS(false);
        return;
      }

      const result = await response.json();
      console.log('GUS search result:', result);

      if (result.success && result.data && result.data.found !== false) {
        const d = result.data;
        const street = d.ulica ? `${d.ulica} ${d.nrNieruchomosci || ''}${d.nrLokalu ? '/' + d.nrLokalu : ''}`.trim() : '';

        setFormData(prev => ({
          ...prev,
          name: prev.name || d.nazwa || '',
          slug: prev.slug || generateSlug(d.nazwa || ''),
          legal_name: d.nazwa || prev.legal_name,
          regon: d.regon || prev.regon,
          address_street: street || prev.address_street,
          address_city: d.miejscowosc || prev.address_city,
          address_postal_code: d.kodPocztowy || prev.address_postal_code,
          contact_email: d.email || prev.contact_email,
          contact_phone: d.telefon || prev.contact_phone
        }));
      } else {
        setGusError(result.error || 'Nie znaleziono firmy o podanym NIP w rejestrze GUS');
      }
    } catch (err: any) {
      console.error('GUS search error:', err);
      if (err.message?.includes('Failed to fetch')) {
        setGusError('Błąd połączenia z serwerem. Sprawdź połączenie internetowe.');
      } else {
        setGusError('Błąd podczas wyszukiwania. Spróbuj później.');
      }
    } finally {
      setIsSearchingGUS(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie Firmami</h1>
          <p className="text-slate-500 mt-1">Wszystkie firmy na platformie</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Dodaj firmę
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Wszystkich firm</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              <p className="text-xs text-slate-500">Aktywnych</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.trial}</p>
              <p className="text-xs text-slate-500">Trial</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.blocked}</p>
              <p className="text-xs text-slate-500">Zablokowanych</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Szukaj firm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCompanies.map(company => (
          <div
            key={company.id}
            className={`bg-white rounded-xl border p-5 hover:shadow-md transition ${
              company.is_blocked ? 'border-red-200 bg-red-50' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                    {company.name?.[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-slate-900">{company.name}</h3>
                  <p className="text-sm text-slate-500">/{company.slug}</p>
                </div>
              </div>
              {company.is_blocked && (
                <Lock className="w-5 h-5 text-red-500" />
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                COMPANY_STATUS_COLORS[company.status] || 'bg-slate-100 text-slate-800 border-slate-200'
              }`}>
                {COMPANY_STATUS_LABELS[company.status] || company.status}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                formatSubscriptionDisplay(company).color
              }`}>
                {formatSubscriptionDisplay(company).text}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-slate-500">Użytkownicy</p>
                <p className="font-semibold text-slate-900">{getCompanyUsersCount(company.id)}</p>
              </div>
              <div>
                <p className="text-slate-500">Moduły</p>
                <p className="font-semibold text-slate-900">{getCompanyModules(company.id).length}</p>
              </div>
              <div>
                <p className="text-slate-500">Balans</p>
                <p className="font-semibold text-slate-900">{company.bonus_balance?.toFixed(2) || '0.00'} PLN</p>
              </div>
              <div>
                <p className="text-slate-500">Kontakt</p>
                <p className="font-semibold text-slate-900 truncate" title={company.contact_email || '-'}>
                  {company.contact_email || '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => { setSelectedCompany(company); setShowDetailModal(true); }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <Eye className="w-4 h-4" />
                Szczegóły
              </button>
              {company.is_blocked ? (
                <button
                  onClick={() => handleUnblock(company)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                  title="Odblokuj"
                >
                  <Unlock className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => { setSelectedCompany(company); setShowBlockModal(true); }}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                  title="Zablokuj"
                >
                  <Lock className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleDeleteCompany(company)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Usuń"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCompanies.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nie znaleziono firm</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {showAddModal ? 'Dodaj firmę' : 'Edytuj firmę'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NIP with GUS Search - at the top */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="tax_id"
                      value={formData.tax_id}
                      onChange={handleFormChange}
                      placeholder="0000000000"
                      maxLength={10}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={searchGUS}
                      disabled={isSearchingGUS || formData.tax_id.replace(/[\s-]/g, '').length !== 10}
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
                  {gusError && (
                    <p className="text-xs text-red-600 mt-1">{gusError}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL)</label>
                  <div className="flex items-center">
                    <span className="text-slate-500 mr-1">/</span>
                    <input
                      type="text"
                      name="slug"
                      value={formData.slug}
                      onChange={handleFormChange}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Dane do faktury</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa prawna</label>
                  <input
                    type="text"
                    name="legal_name"
                    value={formData.legal_name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">REGON</label>
                  <input
                    type="text"
                    name="regon"
                    value={formData.regon}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ulica</label>
                  <input
                    type="text"
                    name="address_street"
                    value={formData.address_street}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
                  <input
                    type="text"
                    name="address_city"
                    value={formData.address_city}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
                  <input
                    type="text"
                    name="address_postal_code"
                    value={formData.address_postal_code}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2 mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Dane kontaktowe</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email kontaktowy</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email do faktur</label>
                  <input
                    type="email"
                    name="billing_email"
                    value={formData.billing_email}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={showAddModal ? handleAddCompany : handleUpdateCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!formData.name}
                >
                  {showAddModal ? 'Dodaj firmę' : 'Zapisz zmiany'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Zablokuj firmę</h3>
              <button onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 mb-4">
              Czy na pewno chcesz zablokować firmę <strong>{selectedCompany.name}</strong>?
              Wszyscy użytkownicy tej firmy stracą dostęp.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Powód blokady</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Opcjonalnie podaj powód..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleBlock}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Zablokuj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Szczegóły firmy</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                {selectedCompany.logo_url ? (
                  <img src={selectedCompany.logo_url} alt={selectedCompany.name} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                    {selectedCompany.name?.[0]}
                  </div>
                )}
                <div>
                  <h4 className="text-xl font-bold text-slate-900">{selectedCompany.name}</h4>
                  <p className="text-slate-500">/{selectedCompany.slug}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {/* Clickable Status */}
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition text-left group"
                >
                  <p className="text-xs text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Status
                    <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    COMPANY_STATUS_COLORS[selectedCompany.status]
                  }`}>
                    {COMPANY_STATUS_LABELS[selectedCompany.status]}
                  </span>
                </button>

                {/* Clickable Subscription */}
                <button
                  onClick={() => { loadSubscriptionHistory(selectedCompany.id); loadBonusHistory(selectedCompany.id); setShowSubscriptionModal(true); }}
                  className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition text-left group"
                >
                  <p className="text-xs text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Subskrypcja
                    <CreditCard className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    formatSubscriptionDisplay(selectedCompany).color
                  }`}>
                    {formatSubscriptionDisplay(selectedCompany).text}
                  </span>
                </button>

                {/* Clickable Users */}
                <button
                  onClick={() => setShowUsersModal(true)}
                  className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition text-left group"
                >
                  <p className="text-xs text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Użytkownicy
                    <Users className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </p>
                  <p className="font-bold text-slate-900">{getCompanyUsersCount(selectedCompany.id)}</p>
                </button>

                {/* Clickable Bonus Balance */}
                <button
                  onClick={() => { loadBonusHistory(selectedCompany.id); setShowBonusModal(true); }}
                  className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition text-left group"
                >
                  <p className="text-xs text-slate-500 uppercase mb-1 flex items-center gap-1">
                    Balans bonusowy
                    <Wallet className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                  </p>
                  <p className="font-bold text-slate-900">{selectedCompany.bonus_balance?.toFixed(2) || '0.00'} PLN</p>
                </button>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">NIP</p>
                  <p className="font-medium text-slate-900">{selectedCompany.tax_id || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">REGON</p>
                  <p className="font-medium text-slate-900">{selectedCompany.regon || '-'}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h5 className="font-semibold text-slate-900 mb-3">Dane kontaktowe</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{selectedCompany.contact_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Telefon</p>
                    <p className="font-medium text-slate-900">{selectedCompany.contact_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email do faktur</p>
                    <p className="font-medium text-slate-900">{selectedCompany.billing_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Adres</p>
                    <p className="font-medium text-slate-900">
                      {selectedCompany.address_street && selectedCompany.address_city
                        ? `${selectedCompany.address_street}, ${selectedCompany.address_postal_code} ${selectedCompany.address_city}`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <h5 className="font-semibold text-slate-900 mb-3">Aktywne moduły</h5>
                {getCompanyModules(selectedCompany.id).length > 0 ? (
                  <div className="space-y-2">
                    {getCompanyModules(selectedCompany.id).map(cm => {
                      const mod = modules.find(m => m.code === cm.module_code);
                      return (
                        <div key={cm.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">{mod?.name_pl || cm.module_code}</p>
                            <p className="text-sm text-slate-500">{cm.max_users} użytkowników, {cm.price_per_user} PLN/os</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            cm.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {cm.is_active ? 'Aktywny' : 'Nieaktywny'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Brak aktywnych modułów</p>
                )}
              </div>

              {/* Edit Button */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <button
                  onClick={() => { setShowDetailModal(false); openEditModal(selectedCompany); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Edit2 className="w-4 h-4" />
                  Edytuj dane firmy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Zmień status firmy</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-600 mb-4">Wybierz nowy status dla firmy <strong>{selectedCompany.name}</strong>:</p>
            <div className="space-y-2">
              {(['active', 'trial', 'suspended', 'cancelled'] as CompanyStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                    selectedCompany.status === status
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    COMPANY_STATUS_COLORS[status]
                  }`}>
                    {COMPANY_STATUS_LABELS[status]}
                  </span>
                  {selectedCompany.status === status && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStatusModal(false)}
              className="w-full mt-4 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Subskrypcja - {selectedCompany.name}</h3>
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
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mt-1 ${
                    formatSubscriptionDisplay(selectedCompany).color
                  }`}>
                    {formatSubscriptionDisplay(selectedCompany).text}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Balans bonusowy</p>
                  <p className="text-xl font-bold text-green-600">{selectedCompany.bonus_balance?.toFixed(2) || '0.00'} PLN</p>
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
                        const moduleStatus = getModuleStatus(selectedCompany.id, mod.code);
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
                    const paymentHistory = getCompanyPaymentHistory(selectedCompany.id);
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
                                <p className="font-medium text-slate-900">{tx.description}</p>
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
                  {subscriptionHistory.length > 0 ? (
                    <div className="space-y-2">
                      {subscriptionHistory.map(entry => (
                        <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            entry.action === 'MODULE_ACTIVATED' ? 'bg-green-100' :
                            entry.action === 'MODULE_DEACTIVATED' ? 'bg-red-100' :
                            entry.action === 'USERS_CHANGED' ? 'bg-blue-100' :
                            entry.action === 'DEMO_STARTED' ? 'bg-yellow-100' :
                            'bg-slate-100'
                          }`}>
                            {entry.action === 'MODULE_ACTIVATED' && <Check className="w-4 h-4 text-green-600" />}
                            {entry.action === 'MODULE_DEACTIVATED' && <X className="w-4 h-4 text-red-600" />}
                            {entry.action === 'USERS_CHANGED' && <Users className="w-4 h-4 text-blue-600" />}
                            {entry.action === 'DEMO_STARTED' && <Calendar className="w-4 h-4 text-yellow-600" />}
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
                  {getCompanyPaymentHistory(selectedCompany.id).length > 0 ? (
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
                          {getCompanyPaymentHistory(selectedCompany.id).map(payment => (
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

      {/* Users Modal */}
      {showUsersModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Użytkownicy - {selectedCompany.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingUser(null); setUserFormData({ email: '', first_name: '', last_name: '', role: 'company_admin', phone: '', plain_password: '' }); setShowUserFormModal(true); }}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Dodaj użytkownika
                </button>
                <button onClick={() => setShowUsersModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {getCompanyUsers(selectedCompany.id).length > 0 ? (
                <div className="space-y-3">
                  {getCompanyUsers(selectedCompany.id).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Mail className="w-3 h-3" />
                            {user.email}
                            {user.phone && (
                              <>
                                <span className="mx-1">|</span>
                                <Phone className="w-3 h-3" />
                                {user.phone}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {user.role === 'company_admin' ? 'Admin' : user.role === 'hr' ? 'HR' : user.role === 'coordinator' ? 'Koordynator' : user.role}
                        </span>
                        <button
                          onClick={() => openUserEditModal(user)}
                          className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                          title="Edytuj"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Usuń"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Brak użytkowników</p>
                  <button
                    onClick={() => { setEditingUser(null); setUserFormData({ email: '', first_name: '', last_name: '', role: 'company_admin', phone: '', plain_password: '' }); setShowUserFormModal(true); }}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
                  >
                    <UserPlus className="w-4 h-4" />
                    Dodaj pierwszego użytkownika
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal (Add/Edit) */}
      {showUserFormModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingUser ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}
              </h3>
              <button onClick={() => { setShowUserFormModal(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                  <input
                    type="text"
                    value={userFormData.first_name}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                  <input
                    type="text"
                    value={userFormData.last_name}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rola</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="company_admin">Admin firmy</option>
                  <option value="hr">HR</option>
                  <option value="coordinator">Koordynator</option>
                  <option value="brigadir">Brygadzista</option>
                </select>
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hasło (opcjonalnie)</label>
                  <input
                    type="text"
                    value={userFormData.plain_password}
                    onChange={(e) => setUserFormData(prev => ({ ...prev, plain_password: e.target.value }))}
                    placeholder="Zostaw puste aby wygenerować automatycznie"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowUserFormModal(false); setEditingUser(null); }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={editingUser ? handleEditUser : handleAddUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingUser ? 'Zapisz zmiany' : 'Dodaj użytkownika'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Balance Modal */}
      {showBonusModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Balans bonusowy - {selectedCompany.name}</h3>
              <button onClick={() => setShowBonusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Current Balance */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl mb-6">
                <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-700">Aktualny balans</p>
                  <p className="text-3xl font-bold text-green-800">{selectedCompany.bonus_balance?.toFixed(2) || '0.00'} PLN</p>
                </div>
              </div>

              {/* Add Bonus Form */}
              <div className="border border-slate-200 rounded-xl p-4 mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">Dodaj/Odejmij bonus</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kwota (PLN)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      placeholder="np. 100 lub -50"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Użyj wartości ujemnej aby odjąć</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                    <input
                      type="text"
                      value={bonusDescription}
                      onChange={(e) => setBonusDescription(e.target.value)}
                      placeholder="np. Doładowanie promocyjne"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddBonus}
                  disabled={!bonusAmount || loadingBonus}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {loadingBonus ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  Zapisz
                </button>
              </div>

              {/* Bonus History */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Historia operacji</h4>
                {bonusHistory.length > 0 ? (
                  <div className="space-y-2">
                    {bonusHistory.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            entry.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {entry.type === 'credit' ? (
                              <Plus className="w-4 h-4 text-green-600" />
                            ) : (
                              <Minus className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{entry.description}</p>
                            <p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleDateString('pl-PL')}</p>
                          </div>
                        </div>
                        <p className={`font-bold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {entry.type === 'credit' ? '+' : '-'}{entry.amount.toFixed(2)} PLN
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Brak historii operacji</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module Settings Modal */}
      {showModuleSettingsModal && selectedCompany && selectedModule && (() => {
        const moduleStatus = getModuleStatus(selectedCompany.id, selectedModule.code);
        const hasPaidSubscription = moduleStatus.status === 'active' && getCompanyModules(selectedCompany.id).find(cm => cm.module_code === selectedModule.code)?.stripe_subscription_id;
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
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
