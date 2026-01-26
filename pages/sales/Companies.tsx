
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Search, Building2, MapPin, Users, Edit, Trash2, X, Phone, Mail, User, Briefcase, Check, Loader2, ChevronRight, CheckSquare, History, Star, ExternalLink, Link2, Calendar, DollarSign, Percent, UserPlus, Key, CreditCard, Shield, Wallet, FileText, Download, PlusCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CRMCompany, CRMContact, CRMDeal, DealStage, DealPriority, Role, Company, PaymentHistory } from '../../types';
import { INDUSTRY_OPTIONS, CRM_STATUS_OPTIONS, CRM_STATUS_LABELS, CRM_STATUS_COLORS, DEAL_STAGE_LABELS, DEAL_STAGE_COLORS, DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS, MODULE_LABELS } from '../../constants';
import { supabase, SUPABASE_ANON_KEY } from '../../lib/supabase';

export const SalesCompanies: React.FC = () => {
  const navigate = useNavigate();
  const { state, setState, refreshData } = useAppContext();
  const { crmCompanies, crmContacts, crmActivities, crmDeals } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTab, setDetailTab] = useState<'company' | 'contacts' | 'history'>('company');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  // Inline edit state for quick fields
  const [editingField, setEditingField] = useState<'employee_count' | 'industry' | null>(null);
  const [inlineValue, setInlineValue] = useState('');

  // Contact management state
  const [showContactModal, setShowContactModal] = useState(false);
  const [showContactChoiceModal, setShowContactChoiceModal] = useState(false);
  const [showSelectContactModal, setShowSelectContactModal] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    is_decision_maker: false
  });

  // Contact Profile modal state
  const [showContactProfileModal, setShowContactProfileModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);

  // Deal management state
  const [showDealChoiceModal, setShowDealChoiceModal] = useState(false);
  const [showSelectDealModal, setShowSelectDealModal] = useState(false);
  const [dealSearchTerm, setDealSearchTerm] = useState('');
  const [showDealDetailModal, setShowDealDetailModal] = useState(false);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);
  const [dealForm, setDealForm] = useState({
    title: '',
    value: '',
    stage: 'lead',
    expected_close_date: ''
  });

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskContact, setTaskContact] = useState<CRMContact | null>(null);
  const [taskForm, setTaskForm] = useState({
    activity_type: 'task',
    subject: '',
    description: '',
    scheduled_at: '',
    location: ''
  });

  // Portal account creation modal state
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [accountCreationMode, setAccountCreationMode] = useState<'select' | 'new'>('select');
  const [selectedAccountContact, setSelectedAccountContact] = useState<CRMContact | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });

  // Discount modal state
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [loadingDiscount, setLoadingDiscount] = useState(false);

  // Bonus modal state
  const [showBonusModal, setShowBonusModal] = useState(false);
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
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionTab, setSubscriptionTab] = useState<'subscriptions' | 'history' | 'invoices'>('subscriptions');
  const [subscriptionHistory, setSubscriptionHistory] = useState<Array<{
    id: string;
    action: string;
    module_code?: string;
    details: string;
    created_at: string;
  }>>([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  // Demo settings state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoEndDate, setDemoEndDate] = useState('');
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Task type options
  const TASK_TYPE_OPTIONS = [
    { value: 'call', label: 'Telefon' },
    { value: 'email', label: 'Email' },
    { value: 'meeting', label: 'Spotkanie' },
    { value: 'task', label: 'Zadanie' }
  ];

  // Phone formatting function
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '');

    // If starts with +48 or 48, format as Polish number
    if (cleaned.startsWith('+48')) {
      const digits = cleaned.slice(3);
      if (digits.length <= 3) return `+48 ${digits}`;
      if (digits.length <= 6) return `+48 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+48 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }

    if (cleaned.startsWith('48') && cleaned.length > 2) {
      const digits = cleaned.slice(2);
      if (digits.length <= 3) return `+48 ${digits}`;
      if (digits.length <= 6) return `+48 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+48 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }

    // If starts with +, keep it as is with basic formatting
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // For Polish numbers without country code
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setContactForm(prev => ({ ...prev, phone: formatted }));
  };

  // GUS search state
  const [isSearchingGUS, setIsSearchingGUS] = useState(false);
  const [gusError, setGusError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
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

  // Filter companies by search and CRM status
  const filteredCompanies = useMemo(() => {
    return crmCompanies.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                           c.legal_name?.toLowerCase().includes(search.toLowerCase()) ||
                           c.tax_id?.toLowerCase().includes(search.toLowerCase()) ||
                           c.address_city?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [crmCompanies, search, statusFilter]);

  // Get contacts for a company
  const getCompanyContacts = (companyId: string) => {
    return crmContacts.filter(c => c.crm_company_id === companyId);
  };

  // Get activities/history for a company
  const getCompanyHistory = (companyId: string) => {
    return crmActivities
      .filter(a => a.crm_company_id === companyId)
      .sort((a, b) => new Date(b.created_at || b.scheduled_at).getTime() - new Date(a.created_at || a.scheduled_at).getTime());
  };

  // Get deals for a contact
  const getContactDeals = (contactId: string) => {
    return crmDeals.filter(d => d.contact_id === contactId);
  };

  // Get available contacts (not linked to this company)
  const getAvailableContacts = () => {
    if (!selectedCompany) return [];
    const companyContactIds = getCompanyContacts(selectedCompany.id).map(c => c.id);
    return crmContacts.filter(c =>
      !companyContactIds.includes(c.id) &&
      (c.first_name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
       c.last_name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
       c.email?.toLowerCase().includes(contactSearchTerm.toLowerCase()))
    );
  };

  // Get available deals (not linked to this contact)
  const getAvailableDeals = () => {
    if (!selectedContact) return [];
    const contactDealIds = getContactDeals(selectedContact.id).map(d => d.id);
    return crmDeals.filter(d =>
      !contactDealIds.includes(d.id) &&
      d.title.toLowerCase().includes(dealSearchTerm.toLowerCase())
    );
  };

  // Get linked portal company for a CRM company
  const getLinkedCompany = (crmCompany: CRMCompany): Company | null => {
    if (!crmCompany.linked_company_id) return null;
    return state.companies.find(c => c.id === crmCompany.linked_company_id) || null;
  };

  // Get company modules for a linked company
  const getLinkedCompanyModules = (linkedCompanyId: string) => {
    return state.companyModules.filter(cm => cm.company_id === linkedCompanyId);
  };

  // Get max discount from system config
  const maxDiscount = state.systemConfig.salesMaxDiscountPercent || 20;

  // Get current discount for a company (from modules)
  const getCurrentDiscount = (crmCompany: CRMCompany): number | null => {
    const linkedCompany = getLinkedCompany(crmCompany);
    if (!linkedCompany) return null;

    const companyMods = getLinkedCompanyModules(linkedCompany.id);
    if (companyMods.length === 0) return null;

    // Calculate discount from price difference
    const firstMod = companyMods[0];
    const module = state.modules.find(m => m.code === firstMod.module_code);
    if (!module || module.base_price_per_user === 0) return null;

    const discountPercent = Math.round((1 - firstMod.price_per_user / module.base_price_per_user) * 100);
    return discountPercent > 0 ? discountPercent : null;
  };

  // Get payment history for linked company
  const getLinkedCompanyPaymentHistory = (linkedCompanyId: string): PaymentHistory[] => {
    return (state.paymentHistory || []).filter(ph => ph.company_id === linkedCompanyId);
  };

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
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

        setFormData(prev => ({
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

  // Reset form
  const resetForm = () => {
    setFormData({
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

  // Handle add company
  const handleAddCompany = async () => {
    try {
      const newCompany = {
        name: formData.name,
        legal_name: formData.legal_name || null,
        tax_id: formData.tax_id || null,
        regon: formData.regon || null,
        industry: formData.industry || null,
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_postal_code: formData.address_postal_code || null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
        notes: formData.notes || null,
        status: formData.status,
        source: formData.source || null,
        assigned_sales_id: state.currentUser?.id
      };

      const { data, error } = await supabase.from('crm_companies').insert([newCompany]).select().single();
      if (error) throw error;

      setState(prev => ({ ...prev, crmCompanies: [data, ...prev.crmCompanies] }));
      setShowAddModal(false);
      resetForm();

      // Open the detail modal for the newly created company
      setSelectedCompany(data);
      setShowDetailModal(true);
      setDetailTab('company');
    } catch (error) {
      console.error('Error adding company:', error);
      alert('Błąd podczas dodawania firmy');
    }
  };

  // Handle update company
  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;
    try {
      const updates = {
        name: formData.name,
        legal_name: formData.legal_name || null,
        tax_id: formData.tax_id || null,
        regon: formData.regon || null,
        industry: formData.industry || null,
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_postal_code: formData.address_postal_code || null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
        notes: formData.notes || null,
        status: formData.status,
        source: formData.source || null
      };

      const { data, error } = await supabase.from('crm_companies').update(updates).eq('id', selectedCompany.id).select().single();
      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.map(c => c.id === selectedCompany.id ? data : c)
      }));
      setSelectedCompany(data);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Błąd podczas aktualizacji firmy');
    }
  };

  // Handle delete company
  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć firmę "${selectedCompany.name}"?`)) return;

    try {
      const { error } = await supabase.from('crm_companies').delete().eq('id', selectedCompany.id);
      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.filter(c => c.id !== selectedCompany.id)
      }));
      setShowDetailModal(false);
      setSelectedCompany(null);
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Błąd podczas usuwania firmy');
    }
  };

  // Handle inline field update
  const handleInlineUpdate = async (field: 'employee_count' | 'industry', value: string) => {
    if (!selectedCompany) return;

    try {
      const updates: Record<string, any> = {};
      if (field === 'employee_count') {
        updates.employee_count = value ? parseInt(value) : null;
      } else {
        updates.industry = value || null;
      }

      const { data, error } = await supabase
        .from('crm_companies')
        .update(updates)
        .eq('id', selectedCompany.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.map(c => c.id === selectedCompany.id ? data : c)
      }));
      setSelectedCompany(data);
      setEditingField(null);
      setInlineValue('');
    } catch (error) {
      console.error('Error updating field:', error);
      alert('Błąd podczas aktualizacji');
    }
  };

  // Open detail modal
  const openDetailModal = (company: CRMCompany) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      legal_name: company.legal_name || '',
      tax_id: company.tax_id || '',
      regon: company.regon || '',
      industry: company.industry || '',
      address_street: company.address_street || '',
      address_city: company.address_city || '',
      address_postal_code: company.address_postal_code || '',
      employee_count: company.employee_count?.toString() || '',
      notes: company.notes || '',
      status: company.status || 'new',
      source: company.source || ''
    });
    setShowDetailModal(true);
    setDetailTab('company');
    setIsEditing(false);
  };

  // Contact form handlers
  const resetContactForm = () => {
    setContactForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      is_decision_maker: false
    });
    setEditingContact(null);
  };

  const openAddContactModal = () => {
    resetContactForm();
    setShowContactModal(true);
  };

  const openEditContactModal = (contact: CRMContact) => {
    setEditingContact(contact);
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      position: contact.position || '',
      is_decision_maker: contact.is_decision_maker
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!selectedCompany) return;

    try {
      if (editingContact) {
        // Update existing contact
        const { data, error } = await supabase
          .from('crm_contacts')
          .update({
            first_name: contactForm.first_name,
            last_name: contactForm.last_name,
            email: contactForm.email || null,
            phone: contactForm.phone || null,
            position: contactForm.position || null,
            is_decision_maker: contactForm.is_decision_maker
          })
          .eq('id', editingContact.id)
          .select()
          .single();

        if (error) throw error;

        setState(prev => ({
          ...prev,
          crmContacts: prev.crmContacts.map(c => c.id === editingContact.id ? data : c)
        }));
      } else {
        // Add new contact
        const { data, error } = await supabase
          .from('crm_contacts')
          .insert([{
            crm_company_id: selectedCompany.id,
            first_name: contactForm.first_name,
            last_name: contactForm.last_name,
            email: contactForm.email || null,
            phone: contactForm.phone || null,
            position: contactForm.position || null,
            is_decision_maker: contactForm.is_decision_maker,
            status: 'active'
          }])
          .select()
          .single();

        if (error) throw error;

        setState(prev => ({
          ...prev,
          crmContacts: [data, ...prev.crmContacts]
        }));
      }

      setShowContactModal(false);
      resetContactForm();
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Błąd podczas zapisywania kontaktu');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten kontakt?')) return;

    try {
      const { error } = await supabase.from('crm_contacts').delete().eq('id', contactId);
      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: prev.crmContacts.filter(c => c.id !== contactId)
      }));
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Błąd podczas usuwania kontaktu');
    }
  };

  // Update company status
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('crm_companies')
        .update({ status: newStatus })
        .eq('id', selectedCompany.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.map(c => c.id === selectedCompany.id ? data : c)
      }));
      setSelectedCompany(data);
      setIsEditingStatus(false);

      // Log activity
      await logCompanyActivity('status_change', `Zmiana statusu na: ${CRM_STATUS_LABELS[newStatus]}`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Błąd podczas aktualizacji statusu');
    }
  };

  // Log company activity
  const logCompanyActivity = async (type: string, description: string) => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{
          activity_type: type,
          subject: description,
          crm_company_id: selectedCompany.id,
          is_completed: true,
          created_by: state.currentUser?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: [data, ...prev.crmActivities]
      }));
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  // Link existing contact to company
  const handleLinkContact = async (contact: CRMContact) => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .update({ crm_company_id: selectedCompany.id })
        .eq('id', contact.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: prev.crmContacts.map(c => c.id === contact.id ? data : c)
      }));

      setShowSelectContactModal(false);
      setContactSearchTerm('');

      await logCompanyActivity('contact_linked', `Powiązano kontakt: ${contact.first_name} ${contact.last_name}`);
    } catch (error) {
      console.error('Error linking contact:', error);
      alert('Błąd podczas powiązywania kontaktu');
    }
  };

  // Open contact profile modal
  const openContactProfile = (contact: CRMContact) => {
    setSelectedContact(contact);
    setContactForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      position: contact.position || '',
      is_decision_maker: contact.is_decision_maker
    });
    setIsEditingContact(false);
    setShowContactProfileModal(true);
  };

  // Update contact from profile
  const handleUpdateContactProfile = async () => {
    if (!selectedContact) return;

    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .update({
          first_name: contactForm.first_name,
          last_name: contactForm.last_name,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          position: contactForm.position || null,
          is_decision_maker: contactForm.is_decision_maker
        })
        .eq('id', selectedContact.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmContacts: prev.crmContacts.map(c => c.id === selectedContact.id ? data : c)
      }));
      setSelectedContact(data);
      setIsEditingContact(false);
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Błąd podczas aktualizacji kontaktu');
    }
  };

  // Link deal to contact
  const handleLinkDeal = async (deal: CRMDeal) => {
    if (!selectedContact) return;

    try {
      const { data, error } = await supabase
        .from('crm_deals')
        .update({ contact_id: selectedContact.id })
        .eq('id', deal.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmDeals: prev.crmDeals.map(d => d.id === deal.id ? data : d)
      }));

      setShowSelectDealModal(false);
      setDealSearchTerm('');
    } catch (error) {
      console.error('Error linking deal:', error);
      alert('Błąd podczas powiązywania deala');
    }
  };

  // Unlink deal from contact
  const handleUnlinkDeal = async (dealId: string) => {
    try {
      const { data, error } = await supabase
        .from('crm_deals')
        .update({ contact_id: null })
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmDeals: prev.crmDeals.map(d => d.id === dealId ? data : d)
      }));
    } catch (error) {
      console.error('Error unlinking deal:', error);
      alert('Błąd podczas usuwania powiązania');
    }
  };

  // Open deal detail modal
  const openDealDetailModal = (deal: CRMDeal) => {
    setSelectedDeal(deal);
    setShowDealDetailModal(true);
  };

  // Open add deal modal
  const openAddDealModal = () => {
    setDealForm({
      title: '',
      value: '',
      stage: 'lead',
      expected_close_date: ''
    });
    setShowDealChoiceModal(false);
    setShowAddDealModal(true);
  };

  // Create new deal
  const handleCreateDeal = async () => {
    if (!selectedContact || !selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('crm_deals')
        .insert([{
          title: dealForm.title,
          value: dealForm.value ? parseFloat(dealForm.value) : null,
          stage: dealForm.stage,
          expected_close_date: dealForm.expected_close_date || null,
          contact_id: selectedContact.id,
          crm_company_id: selectedCompany.id,
          assigned_sales_id: state.currentUser?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmDeals: [data, ...prev.crmDeals]
      }));

      setShowAddDealModal(false);
      await logCompanyActivity('deal_created', `Utworzono deal: ${dealForm.title}`);
    } catch (error) {
      console.error('Error creating deal:', error);
      alert('Błąd podczas tworzenia deala');
    }
  };

  // Format activity type for display
  const formatActivityType = (type: string) => {
    const types: Record<string, string> = {
      'call': 'Telefon',
      'email': 'Email',
      'meeting': 'Spotkanie',
      'task': 'Zadanie',
      'note': 'Notatka',
      'status_change': 'Zmiana statusu',
      'contact_linked': 'Powiązanie kontaktu',
      'deal_created': 'Utworzenie deala'
    };
    return types[type] || type;
  };

  // Task modal handlers
  const openTaskModal = (contact: CRMContact) => {
    setTaskContact(contact);
    setTaskForm({
      activity_type: 'task',
      subject: `Zadanie dla ${contact.first_name} ${contact.last_name}`,
      description: '',
      scheduled_at: new Date().toISOString().slice(0, 16),
      location: ''
    });
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!selectedCompany || !taskContact) return;

    try {
      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{
          activity_type: taskForm.activity_type,
          subject: taskForm.subject,
          description: taskForm.description || null,
          crm_company_id: selectedCompany.id,
          contact_id: taskContact.id,
          scheduled_at: taskForm.scheduled_at,
          location: taskForm.location || null,
          is_completed: false,
          created_by: state.currentUser?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        crmActivities: [data, ...prev.crmActivities]
      }));

      setShowTaskModal(false);
      setTaskContact(null);
      alert('Zadanie zostało utworzone');
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Błąd podczas tworzenia zadania');
    }
  };

  // Generate random password for new account
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  };

  // Generate slug from name
  const generateCompanySlug = (name: string): string => {
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
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  };

  // Create portal account for company
  const handleCreatePortalAccount = async () => {
    if (!selectedCompany) return;

    // Determine user data
    let userData: { first_name: string; last_name: string; email: string; phone: string };

    if (accountCreationMode === 'select' && selectedAccountContact) {
      if (!selectedAccountContact.email) {
        alert('Wybrany kontakt nie ma adresu email. Uzupełnij dane kontaktu lub dodaj nowego użytkownika.');
        return;
      }
      userData = {
        first_name: selectedAccountContact.first_name,
        last_name: selectedAccountContact.last_name,
        email: selectedAccountContact.email,
        phone: selectedAccountContact.phone || ''
      };
    } else if (accountCreationMode === 'new') {
      if (!newAccountForm.email || !newAccountForm.first_name || !newAccountForm.last_name) {
        alert('Wypełnij wymagane pola: imię, nazwisko i email.');
        return;
      }
      userData = newAccountForm;
    } else {
      alert('Wybierz kontakt lub dodaj nowego użytkownika.');
      return;
    }

    setIsCreatingAccount(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Brak sesji - proszę zalogować się ponownie');
      }

      const supabaseUrl = 'https://diytvuczpciikzdhldny.supabase.co';
      const password = generatePassword();
      const companySlug = generateCompanySlug(selectedCompany.name);

      // 1. Create company in companies table
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([{
          name: selectedCompany.name,
          slug: companySlug,
          legal_name: selectedCompany.legal_name || null,
          tax_id: selectedCompany.tax_id || null,
          regon: selectedCompany.regon || null,
          address_street: selectedCompany.address_street || null,
          address_city: selectedCompany.address_city || null,
          address_postal_code: selectedCompany.address_postal_code || null,
          status: 'trial',
          is_blocked: false,
          subscription_status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
          bonus_balance: 0,
          sales_owner_id: state.currentUser?.id
        }])
        .select()
        .single();

      if (companyError) throw companyError;

      // 2. Create admin user via edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email: userData.email,
          password: password,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone || null,
          role: Role.COMPANY_ADMIN,
          status: 'invited',
          company_id: newCompany.id,
          is_global_user: false
        })
      });

      const result = await response.json();

      if (!result.success) {
        // Rollback: delete the company
        await supabase.from('companies').delete().eq('id', newCompany.id);
        throw new Error(result.error || 'Błąd podczas tworzenia użytkownika');
      }

      // 3. Update CRM company with linked_company_id
      const { data: updatedCrmCompany, error: updateError } = await supabase
        .from('crm_companies')
        .update({
          linked_company_id: newCompany.id,
          subscription_status: 'trialing',
          subscription_end_date: newCompany.trial_ends_at
        })
        .eq('id', selectedCompany.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 4. Send invitation email
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          template: 'USER_INVITATION',
          to: userData.email,
          data: {
            userName: userData.first_name,
            companyName: selectedCompany.name,
            roleName: 'Administrator firmy',
            email: userData.email,
            inviteUrl: `${window.location.origin}/login?email=${encodeURIComponent(userData.email)}`
          }
        })
      });

      // 5. Log activity
      await logCompanyActivity('status_change', `Utworzono konto w portalu dla: ${userData.first_name} ${userData.last_name} (${userData.email})`);

      // 6. Update local state
      setState(prev => ({
        ...prev,
        crmCompanies: prev.crmCompanies.map(c => c.id === selectedCompany.id ? updatedCrmCompany : c)
      }));
      setSelectedCompany(updatedCrmCompany);

      // Reset and close modal
      setShowCreateAccountModal(false);
      setAccountCreationMode('select');
      setSelectedAccountContact(null);
      setNewAccountForm({ first_name: '', last_name: '', email: '', phone: '' });

      alert(`Konto zostało utworzone pomyślnie!\n\nDane logowania:\nEmail: ${userData.email}\nHasło: ${password}\n\nEmail z zaproszeniem został wysłany.`);

    } catch (error: any) {
      console.error('Error creating portal account:', error);
      alert(error.message || 'Błąd podczas tworzenia konta w portalu');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Get subscription status label
  const getSubscriptionLabel = (company: CRMCompany): { text: string; color: string } => {
    if (!company.linked_company_id) {
      return { text: 'Brak', color: 'bg-slate-100 text-slate-600' };
    }

    switch (company.subscription_status) {
      case 'active':
        if (company.subscription_end_date) {
          const endDate = new Date(company.subscription_end_date);
          return {
            text: `Ważna do ${endDate.toLocaleDateString('pl-PL')}`,
            color: 'bg-green-100 text-green-700'
          };
        }
        return { text: 'Aktywna', color: 'bg-green-100 text-green-700' };
      case 'trialing':
        if (company.subscription_end_date) {
          const endDate = new Date(company.subscription_end_date);
          return {
            text: `DEMO do ${endDate.toLocaleDateString('pl-PL')}`,
            color: 'bg-purple-100 text-purple-700'
          };
        }
        return { text: 'DEMO', color: 'bg-purple-100 text-purple-700' };
      case 'past_due':
        return { text: 'Zaległa płatność', color: 'bg-orange-100 text-orange-700' };
      case 'cancelled':
        return { text: 'Zakończona', color: 'bg-red-100 text-red-700' };
      default:
        return { text: 'Brak', color: 'bg-slate-100 text-slate-600' };
    }
  };

  // Open discount modal
  const openDiscountModal = () => {
    if (!selectedCompany) return;
    const currentDiscount = getCurrentDiscount(selectedCompany);
    setDiscountPercent(currentDiscount || 0);
    setDiscountReason('');
    setShowDiscountModal(true);
  };

  // Apply discount to company modules
  const handleApplyDiscount = async () => {
    if (!selectedCompany) return;
    const linkedCompany = getLinkedCompany(selectedCompany);
    if (!linkedCompany) {
      alert('Firma nie ma jeszcze konta w portalu');
      return;
    }

    if (discountPercent < 0 || discountPercent > maxDiscount) {
      alert(`Zniżka musi być w zakresie 0-${maxDiscount}%`);
      return;
    }

    setLoadingDiscount(true);
    try {
      const activeModules = getLinkedCompanyModules(linkedCompany.id).filter(m => m.is_active);

      for (const mod of activeModules) {
        const module = state.modules.find(m => m.code === mod.module_code);
        if (!module) continue;

        const discountedPrice = Math.round(module.base_price_per_user * (1 - discountPercent / 100));

        await supabase
          .from('company_modules')
          .update({ price_per_user: discountedPrice })
          .eq('id', mod.id);
      }

      // Log the action
      await supabase.from('sales_actions_log').insert({
        sales_user_id: state.currentUser?.id,
        company_id: linkedCompany.id,
        action_type: 'discount',
        value: discountPercent,
        reason: discountReason || 'Zmiana rabatu',
        created_at: new Date().toISOString()
      });

      // Log activity
      await logCompanyActivity('status_change', `Zastosowano rabat ${discountPercent}% ${discountReason ? `(${discountReason})` : ''}`);

      await refreshData();
      setShowDiscountModal(false);
      alert(`Rabat ${discountPercent}% został zastosowany`);
    } catch (error) {
      console.error('Error applying discount:', error);
      alert('Błąd podczas aplikowania rabatu');
    } finally {
      setLoadingDiscount(false);
    }
  };

  // Open bonus history modal
  const openBonusModal = async () => {
    if (!selectedCompany) return;
    const linkedCompany = getLinkedCompany(selectedCompany);
    if (!linkedCompany) return;

    setShowBonusModal(true);
    setLoadingBonus(true);

    try {
      const { data, error } = await supabase
        .from('bonus_transactions')
        .select('*')
        .eq('company_id', linkedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBonusHistory(data || []);
    } catch (error) {
      console.error('Error loading bonus history:', error);
      setBonusHistory([]);
    } finally {
      setLoadingBonus(false);
    }
  };

  // Open subscription modal
  const openSubscriptionModal = async () => {
    if (!selectedCompany) return;
    const linkedCompany = getLinkedCompany(selectedCompany);
    if (!linkedCompany) {
      alert('Firma nie ma jeszcze konta w portalu');
      return;
    }

    setShowSubscriptionModal(true);
    setSubscriptionTab('subscriptions');
    setLoadingSubscription(true);

    try {
      const { data, error } = await supabase
        .from('subscription_history')
        .select('*')
        .eq('company_id', linkedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptionHistory(data || []);
    } catch (error) {
      console.error('Error loading subscription history:', error);
      setSubscriptionHistory([]);
    } finally {
      setLoadingSubscription(false);
    }
  };

  // Toggle module for linked company
  const handleToggleModule = async (mod: any, activate: boolean) => {
    if (!selectedCompany) return;
    const linkedCompany = getLinkedCompany(selectedCompany);
    if (!linkedCompany) return;

    setLoadingSubscription(true);
    try {
      const existingModule = getLinkedCompanyModules(linkedCompany.id).find(cm => cm.module_code === mod.code);

      if (activate) {
        if (existingModule) {
          await supabase
            .from('company_modules')
            .update({ is_active: true, activated_at: new Date().toISOString() })
            .eq('id', existingModule.id);
        } else {
          await supabase
            .from('company_modules')
            .insert({
              company_id: linkedCompany.id,
              module_code: mod.code,
              max_users: 10,
              current_users: 0,
              price_per_user: mod.base_price_per_user,
              billing_cycle: 'monthly',
              is_active: true,
              activated_at: new Date().toISOString()
            });
        }

        // Log history
        await supabase.from('subscription_history').insert({
          company_id: linkedCompany.id,
          action: 'MODULE_ACTIVATED',
          module_code: mod.code,
          details: `Aktywowano moduł: ${mod.name_pl}`,
          created_at: new Date().toISOString()
        });
      } else {
        if (existingModule) {
          await supabase
            .from('company_modules')
            .update({ is_active: false, deactivated_at: new Date().toISOString() })
            .eq('id', existingModule.id);

          // Log history
          await supabase.from('subscription_history').insert({
            company_id: linkedCompany.id,
            action: 'MODULE_DEACTIVATED',
            module_code: mod.code,
            details: `Dezaktywowano moduł: ${mod.name_pl}`,
            created_at: new Date().toISOString()
          });
        }
      }

      await refreshData();
      // Reload history
      const { data } = await supabase
        .from('subscription_history')
        .select('*')
        .eq('company_id', linkedCompany.id)
        .order('created_at', { ascending: false });
      setSubscriptionHistory(data || []);
    } catch (error) {
      console.error('Error toggling module:', error);
      alert('Błąd podczas zmiany modułu');
    } finally {
      setLoadingSubscription(false);
    }
  };

  // Start/extend demo period
  const handleStartDemo = async () => {
    if (!selectedCompany) return;
    const linkedCompany = getLinkedCompany(selectedCompany);
    if (!linkedCompany) return;

    if (!demoEndDate) {
      alert('Wybierz datę zakończenia okresu DEMO');
      return;
    }

    setLoadingDemo(true);
    try {
      // Update company subscription status
      await supabase
        .from('companies')
        .update({
          subscription_status: 'trialing',
          trial_ends_at: new Date(demoEndDate).toISOString()
        })
        .eq('id', linkedCompany.id);

      // Update CRM company
      await supabase
        .from('crm_companies')
        .update({
          subscription_status: 'trialing',
          subscription_end_date: new Date(demoEndDate).toISOString()
        })
        .eq('id', selectedCompany.id);

      // Log history
      await supabase.from('subscription_history').insert({
        company_id: linkedCompany.id,
        action: 'DEMO_STARTED',
        details: `Uruchomiono/przedłużono DEMO do ${new Date(demoEndDate).toLocaleDateString('pl-PL')}`,
        created_at: new Date().toISOString()
      });

      await refreshData();

      // Update selected company locally
      setSelectedCompany(prev => prev ? {
        ...prev,
        subscription_status: 'trialing',
        subscription_end_date: new Date(demoEndDate).toISOString()
      } : null);

      setShowDemoModal(false);
      setDemoEndDate('');
      alert('Okres DEMO został ustawiony');
    } catch (error) {
      console.error('Error starting demo:', error);
      alert('Błąd podczas ustawiania okresu DEMO');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Firmy</h1>
          <p className="text-slate-500 mt-1">Baza firm klientów i prospektów ({crmCompanies.length})</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj firm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie statusy</option>
            {CRM_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj firmę
          </button>
        </div>
      </div>

      {/* Companies List */}
      {filteredCompanies.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Lokalizacja</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Branża</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pracownicy</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Subskrypcja</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCompanies.map(company => (
                <tr
                  key={company.id}
                  onClick={() => openDetailModal(company)}
                  className="hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{company.name}</p>
                        {company.tax_id && (
                          <p className="text-xs text-slate-500">NIP: {company.tax_id}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {company.address_city ? (
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{company.address_city}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-600">{company.industry || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {company.employee_count ? (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>{company.employee_count}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${CRM_STATUS_COLORS[company.status] || 'bg-slate-100 text-slate-700'}`}>
                      {CRM_STATUS_LABELS[company.status] || company.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSubscriptionLabel(company).color}`}>
                      {getSubscriptionLabel(company).text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-5 h-5 text-slate-400 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{crmCompanies.length === 0 ? 'Brak firm w bazie' : 'Brak firm spełniających kryteria'}</p>
          {crmCompanies.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Dodaj pierwszą firmę
            </button>
          )}
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj firmę</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
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
                  {gusError && <p className="text-xs text-red-600 mt-1">{gusError}</p>}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branża</label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleFormChange}
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Liczba pracowników</label>
                  <input
                    type="number"
                    name="employee_count"
                    value={formData.employee_count}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status CRM</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CRM_STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Źródło</label>
                  <input
                    type="text"
                    name="source"
                    value={formData.source}
                    onChange={handleFormChange}
                    placeholder="np. LinkedIn, Polecenie, Strona www"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleAddCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!formData.name}
                >
                  Dodaj firmę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Detail Modal */}
      {showDetailModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCompany.name}</h3>
                  {/* Clickable status tag */}
                  <div className="relative">
                    {isEditingStatus ? (
                      <select
                        value={selectedCompany.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          if (newStatus !== selectedCompany.status) {
                            handleUpdateStatus(newStatus);
                          } else {
                            setIsEditingStatus(false);
                          }
                        }}
                        onBlur={() => setTimeout(() => setIsEditingStatus(false), 150)}
                        autoFocus
                        className="px-2 py-1 text-xs font-medium border border-blue-300 rounded-full focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {CRM_STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setIsEditingStatus(true)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition ${CRM_STATUS_COLORS[selectedCompany.status] || 'bg-slate-100 text-slate-700'}`}
                      >
                        {CRM_STATUS_LABELS[selectedCompany.status] || selectedCompany.status}
                        <Edit className="w-3 h-3 ml-1 opacity-50" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowDetailModal(false); setSelectedCompany(null); setIsEditing(false); setIsEditingStatus(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 px-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setDetailTab('company')}
                  className={`py-3 border-b-2 font-medium transition ${detailTab === 'company' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Dane firmy
                </button>
                <button
                  onClick={() => setDetailTab('contacts')}
                  className={`py-3 border-b-2 font-medium transition ${detailTab === 'contacts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Kontakty ({getCompanyContacts(selectedCompany.id).length})
                </button>
                <button
                  onClick={() => setDetailTab('history')}
                  className={`py-3 border-b-2 font-medium transition ${detailTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Historia ({getCompanyHistory(selectedCompany.id).length})
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Company Data Tab */}
              {detailTab === 'company' && (
                <div>
                  {isEditing ? (
                    // Edit mode
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                        <input
                          type="text"
                          name="tax_id"
                          value={formData.tax_id}
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Branża</label>
                        <select
                          name="industry"
                          value={formData.industry}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Wybierz branżę</option>
                          {INDUSTRY_OPTIONS.map(ind => (
                            <option key={ind} value={ind}>{ind}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Liczba pracowników</label>
                        <input
                          type="number"
                          name="employee_count"
                          value={formData.employee_count}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
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
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status CRM</label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {CRM_STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Źródło</label>
                        <input
                          type="text"
                          name="source"
                          value={formData.source}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                        <textarea
                          name="notes"
                          value={formData.notes}
                          onChange={handleFormChange}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2 flex gap-3 mt-4">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                        >
                          Anuluj
                        </button>
                        <button
                          onClick={handleUpdateCompany}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Zapisz zmiany
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div>
                      {/* Info cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Employee count - editable */}
                        <div
                          className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition group"
                          onClick={() => {
                            setEditingField('employee_count');
                            setInlineValue(selectedCompany.employee_count?.toString() || '');
                          }}
                        >
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span className="text-xs uppercase font-medium">Pracownicy</span>
                            </div>
                            <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          {editingField === 'employee_count' ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <input
                                type="number"
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                className="w-full px-2 py-1 text-lg font-bold border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineUpdate('employee_count', inlineValue);
                                  if (e.key === 'Escape') { setEditingField(null); setInlineValue(''); }
                                }}
                              />
                              <button
                                onClick={() => handleInlineUpdate('employee_count', inlineValue)}
                                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-lg font-bold text-slate-900">{selectedCompany.employee_count || '-'}</p>
                          )}
                        </div>

                        {/* Industry - editable */}
                        <div
                          className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition group"
                          onClick={() => {
                            setEditingField('industry');
                            setInlineValue(selectedCompany.industry || '');
                          }}
                        >
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4" />
                              <span className="text-xs uppercase font-medium">Branża</span>
                            </div>
                            <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          {editingField === 'industry' ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <select
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                className="w-full px-2 py-1 text-sm font-bold border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineUpdate('industry', inlineValue);
                                  if (e.key === 'Escape') { setEditingField(null); setInlineValue(''); }
                                }}
                              >
                                <option value="">Wybierz branżę</option>
                                {INDUSTRY_OPTIONS.map(ind => (
                                  <option key={ind} value={ind}>{ind}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleInlineUpdate('industry', inlineValue)}
                                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-lg font-bold text-slate-900">{selectedCompany.industry || '-'}</p>
                          )}
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <MapPin className="w-4 h-4" />
                            <span className="text-xs uppercase font-medium">Miasto</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{selectedCompany.address_city || '-'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <User className="w-4 h-4" />
                            <span className="text-xs uppercase font-medium">Kontakty</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{getCompanyContacts(selectedCompany.id).length}</p>
                        </div>
                      </div>

                      {/* Portal account and subscription tiles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Portal account status */}
                        <div className={`rounded-lg p-4 ${selectedCompany.linked_company_id ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 text-slate-500 mb-1">
                                <Shield className="w-4 h-4" />
                                <span className="text-xs uppercase font-medium">Konto w portalu</span>
                              </div>
                              {selectedCompany.linked_company_id ? (
                                <div className="flex items-center gap-2">
                                  <Check className="w-5 h-5 text-green-600" />
                                  <span className="font-medium text-green-700">Firma posiada konto w systemie</span>
                                </div>
                              ) : (
                                <p className="text-slate-600">Brak konta w portalu</p>
                              )}
                            </div>
                            {!selectedCompany.linked_company_id && (
                              <button
                                onClick={() => setShowCreateAccountModal(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                              >
                                <UserPlus className="w-4 h-4" />
                                Utwórz konto
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Subscription status - clickable */}
                        <div
                          className={`rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition ${selectedCompany.linked_company_id ? 'bg-slate-50' : 'bg-slate-50 opacity-50'}`}
                          onClick={() => selectedCompany.linked_company_id && openSubscriptionModal()}
                        >
                          <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <CreditCard className="w-4 h-4" />
                            <span className="text-xs uppercase font-medium">Subskrypcja</span>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${getSubscriptionLabel(selectedCompany).color}`}>
                            {getSubscriptionLabel(selectedCompany).text}
                          </span>
                        </div>
                      </div>

                      {/* Discount and Bonus tiles - only show when linked to portal */}
                      {selectedCompany.linked_company_id && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          {/* Discount tile */}
                          <div
                            className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition group"
                            onClick={openDiscountModal}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                  <Percent className="w-4 h-4" />
                                  <span className="text-xs uppercase font-medium">Rabat</span>
                                </div>
                                <p className="text-lg font-bold text-slate-900">
                                  {getCurrentDiscount(selectedCompany) !== null
                                    ? `${getCurrentDiscount(selectedCompany)}%`
                                    : 'Brak'}
                                </p>
                              </div>
                              <Edit className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </div>

                          {/* Bonus balance tile */}
                          <div
                            className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition"
                            onClick={openBonusModal}
                          >
                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                              <Wallet className="w-4 h-4" />
                              <span className="text-xs uppercase font-medium">Balans bonusowy</span>
                            </div>
                            <p className="text-lg font-bold text-green-600">
                              {getLinkedCompany(selectedCompany)?.bonus_balance?.toFixed(2) || '0.00'} PLN
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Company details */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Dane rejestrowe</h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-slate-500">Nazwa prawna</p>
                              <p className="font-medium text-slate-900">{selectedCompany.legal_name || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">NIP</p>
                              <p className="font-medium text-slate-900">{selectedCompany.tax_id || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">REGON</p>
                              <p className="font-medium text-slate-900">{selectedCompany.regon || '-'}</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Adres</h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-slate-500">Ulica</p>
                              <p className="font-medium text-slate-900">{selectedCompany.address_street || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Kod pocztowy</p>
                              <p className="font-medium text-slate-900">{selectedCompany.address_postal_code || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Miasto</p>
                              <p className="font-medium text-slate-900">{selectedCompany.address_city || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedCompany.notes && (
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">Notatki</p>
                          <p className="text-slate-700 whitespace-pre-wrap">{selectedCompany.notes}</p>
                        </div>
                      )}

                      {selectedCompany.source && (
                        <p className="mt-4 text-sm text-slate-500">Źródło: {selectedCompany.source}</p>
                      )}

                      <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edytuj
                        </button>
                        <button
                          onClick={handleDeleteCompany}
                          className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contacts Tab */}
              {detailTab === 'contacts' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-slate-900">Kontakty firmowe</h4>
                    <button
                      onClick={() => setShowContactChoiceModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Dodaj kontakt
                    </button>
                  </div>

                  {getCompanyContacts(selectedCompany.id).length > 0 ? (
                    <div className="space-y-3">
                      {getCompanyContacts(selectedCompany.id).map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                          <div
                            className="flex items-center gap-4 flex-1 cursor-pointer"
                            onClick={() => openContactProfile(contact)}
                          >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900">
                                  {contact.first_name} {contact.last_name}
                                </p>
                                {contact.is_decision_maker && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                    LPR
                                  </span>
                                )}
                              </div>
                              {contact.position && (
                                <p className="text-sm text-slate-500">{contact.position}</p>
                              )}
                              <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {contact.email}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {contact.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openTaskModal(contact)}
                              className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition"
                              title="Utwórz zadanie"
                            >
                              <CheckSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openContactProfile(contact)}
                              className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition"
                              title="Profil kontaktu"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContact(contact.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                              title="Usuń"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg">
                      <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">Brak kontaktów</p>
                      <button
                        onClick={() => setShowContactChoiceModal(true)}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Dodaj pierwszy kontakt
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {detailTab === 'history' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-4">Historia aktywności</h4>
                  {getCompanyHistory(selectedCompany.id).length > 0 ? (
                    <div className="space-y-3">
                      {getCompanyHistory(selectedCompany.id).map(activity => (
                        <div key={activity.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            activity.activity_type === 'call' ? 'bg-green-100 text-green-600' :
                            activity.activity_type === 'email' ? 'bg-blue-100 text-blue-600' :
                            activity.activity_type === 'meeting' ? 'bg-purple-100 text-purple-600' :
                            activity.activity_type === 'status_change' ? 'bg-orange-100 text-orange-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {activity.activity_type === 'call' && <Phone className="w-4 h-4" />}
                            {activity.activity_type === 'email' && <Mail className="w-4 h-4" />}
                            {activity.activity_type === 'meeting' && <Users className="w-4 h-4" />}
                            {activity.activity_type === 'task' && <CheckSquare className="w-4 h-4" />}
                            {!['call', 'email', 'meeting', 'task'].includes(activity.activity_type) && <History className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-slate-900">{activity.subject}</p>
                              <span className="text-xs text-slate-500">
                                {new Date(activity.created_at || activity.scheduled_at).toLocaleDateString('pl-PL', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
                                {formatActivityType(activity.activity_type)}
                              </span>
                              {activity.is_completed && (
                                <span className="ml-2 text-green-600">Zakończone</span>
                              )}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-slate-600 mt-2">{activity.description}</p>
                            )}
                            {activity.location && (
                              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {activity.location}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg">
                      <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">Brak historii aktywności</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Add/Edit Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingContact ? 'Edytuj kontakt' : 'Dodaj kontakt'}
              </h3>
              <button onClick={() => { setShowContactModal(false); resetContactForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                    <input
                      type="text"
                      value={contactForm.first_name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, first_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                    <input
                      type="text"
                      value={contactForm.last_name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, last_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+48 XXX XXX XXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stanowisko</label>
                  <input
                    type="text"
                    value={contactForm.position}
                    onChange={(e) => setContactForm(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_decision_maker"
                    checked={contactForm.is_decision_maker}
                    onChange={(e) => setContactForm(prev => ({ ...prev, is_decision_maker: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_decision_maker" className="text-sm text-slate-700">
                    Osoba decyzyjna (LPR)
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowContactModal(false); resetContactForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleSaveContact}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!contactForm.first_name || !contactForm.last_name}
                >
                  {editingContact ? 'Zapisz' : 'Dodaj'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && taskContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Utwórz zadanie</h3>
              <button onClick={() => { setShowTaskModal(false); setTaskContact(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">
                Zadanie dla: <span className="font-medium text-slate-700">{taskContact.first_name} {taskContact.last_name}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Typ zadania *</label>
                  <select
                    value={taskForm.activity_type}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, activity_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {TASK_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Temat *</label>
                  <input
                    type="text"
                    value={taskForm.subject}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Opis</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data i godzina *</label>
                  <input
                    type="datetime-local"
                    value={taskForm.scheduled_at}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lokalizacja</label>
                  <input
                    type="text"
                    value={taskForm.location}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="np. Biuro, Online, Adres"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowTaskModal(false); setTaskContact(null); }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCreateTask}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!taskForm.subject || !taskForm.scheduled_at}
                >
                  Utwórz zadanie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Portal Account Modal */}
      {showCreateAccountModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Utwórz konto w portalu</h3>
                <p className="text-sm text-slate-500">{selectedCompany.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateAccountModal(false);
                  setAccountCreationMode('select');
                  setSelectedAccountContact(null);
                  setNewAccountForm({ first_name: '', last_name: '', email: '', phone: '' });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {/* Mode selection */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => {
                    setAccountCreationMode('select');
                    setNewAccountForm({ first_name: '', last_name: '', email: '', phone: '' });
                  }}
                  className={`flex-1 p-4 rounded-lg border-2 transition ${
                    accountCreationMode === 'select'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Users className={`w-6 h-6 mx-auto mb-2 ${accountCreationMode === 'select' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <p className={`font-medium ${accountCreationMode === 'select' ? 'text-blue-700' : 'text-slate-700'}`}>
                    Wybierz z kontaktów
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Istniejący kontakt firmy</p>
                </button>
                <button
                  onClick={() => {
                    setAccountCreationMode('new');
                    setSelectedAccountContact(null);
                  }}
                  className={`flex-1 p-4 rounded-lg border-2 transition ${
                    accountCreationMode === 'new'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <UserPlus className={`w-6 h-6 mx-auto mb-2 ${accountCreationMode === 'new' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <p className={`font-medium ${accountCreationMode === 'new' ? 'text-blue-700' : 'text-slate-700'}`}>
                    Dodaj nowego użytkownika
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Wprowadź dane ręcznie</p>
                </button>
              </div>

              {/* Select from contacts mode */}
              {accountCreationMode === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Wybierz kontakt</label>
                  {getCompanyContacts(selectedCompany.id).length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2">
                      {getCompanyContacts(selectedCompany.id).map(contact => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => setSelectedAccountContact(contact)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition text-left ${
                            selectedAccountContact?.id === contact.id
                              ? 'bg-blue-50 border-2 border-blue-500'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedAccountContact?.id === contact.id ? 'bg-blue-500 text-white' : 'bg-slate-100'
                          }`}>
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">{contact.first_name} {contact.last_name}</p>
                            <p className="text-sm text-slate-500 truncate">
                              {contact.email || <span className="text-orange-500">Brak emaila</span>}
                            </p>
                          </div>
                          {contact.is_decision_maker && (
                            <Star className="w-4 h-4 text-yellow-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-slate-200 rounded-lg">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">Brak kontaktów przypisanych do firmy</p>
                      <p className="text-sm text-slate-400 mt-1">Dodaj nowego użytkownika lub najpierw dodaj kontakty</p>
                    </div>
                  )}

                  {selectedAccountContact && !selectedAccountContact.email && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-700">
                        Wybrany kontakt nie ma adresu email. Uzupełnij dane kontaktu lub dodaj nowego użytkownika.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* New user form mode */}
              {accountCreationMode === 'new' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                      <input
                        type="text"
                        value={newAccountForm.first_name}
                        onChange={(e) => setNewAccountForm(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Jan"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                      <input
                        type="text"
                        value={newAccountForm.last_name}
                        onChange={(e) => setNewAccountForm(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Kowalski"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={newAccountForm.email}
                      onChange={(e) => setNewAccountForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="jan.kowalski@firma.pl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={newAccountForm.phone}
                      onChange={(e) => setNewAccountForm(prev => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="+48 123 456 789"
                    />
                  </div>
                </div>
              )}

              {/* Role info */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 mb-1">
                  <Key className="w-4 h-4" />
                  <span className="font-medium">Rola: Administrator firmy</span>
                </div>
                <p className="text-sm text-blue-600">
                  Użytkownik otrzyma pełne uprawnienia do zarządzania firmą w portalu oraz email z danymi do logowania.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateAccountModal(false);
                    setAccountCreationMode('select');
                    setSelectedAccountContact(null);
                    setNewAccountForm({ first_name: '', last_name: '', email: '', phone: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                  disabled={isCreatingAccount}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCreatePortalAccount}
                  disabled={
                    isCreatingAccount ||
                    (accountCreationMode === 'select' && (!selectedAccountContact || !selectedAccountContact.email)) ||
                    (accountCreationMode === 'new' && (!newAccountForm.email || !newAccountForm.first_name || !newAccountForm.last_name))
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Tworzenie...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Utwórz konto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Choice Modal */}
      {showContactChoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj kontakt</h3>
              <button onClick={() => setShowContactChoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setShowContactChoiceModal(false);
                  resetContactForm();
                  setShowContactModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Dodaj nowy kontakt</p>
                  <p className="text-sm text-slate-500">Utwórz nową osobę kontaktową</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowContactChoiceModal(false);
                  setContactSearchTerm('');
                  setShowSelectContactModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Wybierz z kontaktów</p>
                  <p className="text-sm text-slate-500">Powiąż istniejący kontakt</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Contact Modal */}
      {showSelectContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Wybierz kontakt</h3>
              <button onClick={() => setShowSelectContactModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  placeholder="Szukaj kontaktu..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {getAvailableContacts().length > 0 ? (
                <div className="space-y-2">
                  {getAvailableContacts().map(contact => (
                    <button
                      type="button"
                      key={contact.id}
                      onClick={() => handleLinkContact(contact)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition text-left"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{contact.first_name} {contact.last_name}</p>
                        <p className="text-sm text-slate-500">{contact.email || contact.phone || 'Brak danych'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Brak dostępnych kontaktów</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Profile Modal */}
      {showContactProfileModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedContact.first_name} {selectedContact.last_name}</h3>
                  {selectedContact.is_decision_maker && (
                    <span className="text-sm text-amber-600 flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Osoba decyzyjna (LPR)
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { setShowContactProfileModal(false); setSelectedContact(null); setIsEditingContact(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {isEditingContact ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Imię *</label>
                      <input
                        type="text"
                        value={contactForm.first_name}
                        onChange={(e) => setContactForm(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nazwisko *</label>
                      <input
                        type="text"
                        value={contactForm.last_name}
                        onChange={(e) => setContactForm(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="+48 XXX XXX XXX"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stanowisko</label>
                    <input
                      type="text"
                      value={contactForm.position}
                      onChange={(e) => setContactForm(prev => ({ ...prev, position: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="profile_is_decision_maker"
                      checked={contactForm.is_decision_maker}
                      onChange={(e) => setContactForm(prev => ({ ...prev, is_decision_maker: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="profile_is_decision_maker" className="text-sm text-slate-700">
                      Osoba decyzyjna (LPR)
                    </label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditingContact(false)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateContactProfile}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Zapisz
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-4">
                  {/* Company info */}
                  {selectedCompany && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Firma</p>
                        <p className="font-medium text-slate-900">{selectedCompany.name}</p>
                      </div>
                    </div>
                  )}

                  {/* Position */}
                  {selectedContact.position && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Briefcase className="w-5 h-5 text-slate-400" />
                      <p className="font-medium text-slate-900">{selectedContact.position}</p>
                    </div>
                  )}

                  {/* Email */}
                  {selectedContact.email && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Mail className="w-5 h-5 text-slate-400" />
                      <a href={`mailto:${selectedContact.email}`} className="text-blue-600 hover:underline">
                        {selectedContact.email}
                      </a>
                    </div>
                  )}

                  {/* Phone */}
                  {selectedContact.phone && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Phone className="w-5 h-5 text-slate-400" />
                      <a href={`tel:${selectedContact.phone}`} className="text-blue-600 hover:underline">
                        {selectedContact.phone}
                      </a>
                    </div>
                  )}

                  {/* Deals */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-slate-500">Powiązane deale</p>
                      <button
                        onClick={() => setShowDealChoiceModal(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Dodaj deal
                      </button>
                    </div>
                    {getContactDeals(selectedContact.id).length > 0 ? (
                      <div className="space-y-2">
                        {getContactDeals(selectedContact.id).map(deal => (
                          <div key={deal.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <div>
                              <p className="font-medium text-slate-900">{deal.title}</p>
                              <p className="text-sm text-blue-600 font-semibold">
                                {deal.value?.toLocaleString('pl-PL')} zł
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => navigate('/sales/pipeline')}
                                className="p-2 text-slate-500 hover:bg-blue-100 rounded-lg transition"
                                title="Przejdź do deala"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUnlinkDeal(deal.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Usuń powiązanie"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">Brak powiązanych deali</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => setIsEditingContact(true)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edytuj
                    </button>
                    <button
                      onClick={() => { setShowContactProfileModal(false); setSelectedContact(null); }}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                      Zamknij
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deal Choice Modal */}
      {showDealChoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj deal</h3>
              <button onClick={() => setShowDealChoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={openAddDealModal}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Dodaj nowy deal</p>
                  <p className="text-sm text-slate-500">Utwórz nową szansę sprzedaży</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowDealChoiceModal(false);
                  setDealSearchTerm('');
                  setShowSelectDealModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900">Wybierz z istniejących</p>
                  <p className="text-sm text-slate-500">Powiąż istniejący deal</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Deal Modal */}
      {showSelectDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Wybierz deal</h3>
              <button onClick={() => setShowSelectDealModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={dealSearchTerm}
                  onChange={(e) => setDealSearchTerm(e.target.value)}
                  placeholder="Szukaj deala..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {getAvailableDeals().length > 0 ? (
                <div className="space-y-2">
                  {getAvailableDeals().map(deal => (
                    <button
                      type="button"
                      key={deal.id}
                      onClick={() => handleLinkDeal(deal)}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition text-left"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{deal.title}</p>
                        <p className="text-sm text-slate-500">{deal.stage}</p>
                      </div>
                      <p className="font-semibold text-blue-600">{deal.value?.toLocaleString('pl-PL')} zł</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Brak dostępnych deali</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deal Detail Modal */}
      {showDealDetailModal && selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{selectedDeal.title}</h3>
              <button onClick={() => { setShowDealDetailModal(false); setSelectedDeal(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Stage and Priority badges */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${DEAL_STAGE_COLORS[selectedDeal.stage as DealStage] || 'bg-slate-100 text-slate-700'}`}>
                  {DEAL_STAGE_LABELS[selectedDeal.stage as DealStage] || selectedDeal.stage}
                </span>
                {selectedDeal.priority && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${DEAL_PRIORITY_COLORS[selectedDeal.priority as DealPriority] || 'bg-slate-100 text-slate-600'}`}>
                    {DEAL_PRIORITY_LABELS[selectedDeal.priority as DealPriority] || selectedDeal.priority}
                  </span>
                )}
              </div>

              {/* Value and Probability */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Wartość</p>
                  <p className="text-lg font-bold text-green-600">
                    {selectedDeal.value ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(selectedDeal.value) : '—'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Prawdopodobieństwo</p>
                  <p className="text-lg font-bold text-slate-900">{selectedDeal.probability || 0}%</p>
                </div>
              </div>

              {/* Expected close date */}
              {selectedDeal.expected_close_date && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Planowane zamknięcie: {new Date(selectedDeal.expected_close_date).toLocaleDateString('pl-PL')}</span>
                </div>
              )}

              {/* Employee count estimate */}
              {selectedDeal.employee_count_estimate && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4" />
                  <span>Szacowana liczba użytkowników: {selectedDeal.employee_count_estimate}</span>
                </div>
              )}

              {/* Interested modules */}
              {selectedDeal.modules_interested && selectedDeal.modules_interested.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Zainteresowane moduły:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDeal.modules_interested.map(mod => (
                      <span key={mod} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                        {MODULE_LABELS[mod] || mod}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Company info */}
              {selectedCompany && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Firma</p>
                    <p className="font-medium text-slate-900">{selectedCompany.name}</p>
                  </div>
                </div>
              )}

              {/* Contact info */}
              {selectedContact && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <User className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Kontakt</p>
                    <p className="font-medium text-slate-900">{selectedContact.first_name} {selectedContact.last_name}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedDeal.notes && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Notatki:</p>
                  <p className="text-slate-700">{selectedDeal.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Edytuj
              </button>
              <button
                onClick={() => { setShowDealDetailModal(false); setSelectedDeal(null); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      {showAddDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Dodaj nowy deal</h3>
              <button onClick={() => setShowAddDealModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {selectedContact && (
                <p className="text-sm text-slate-500 mb-4">
                  Deal dla: <span className="font-medium text-slate-700">{selectedContact.first_name} {selectedContact.last_name}</span>
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł *</label>
                  <input
                    type="text"
                    value={dealForm.title}
                    onChange={(e) => setDealForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="np. Wdrożenie systemu CRM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Wartość (PLN)</label>
                  <input
                    type="number"
                    value={dealForm.value}
                    onChange={(e) => setDealForm(prev => ({ ...prev, value: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Etap</label>
                  <select
                    value={dealForm.stage}
                    onChange={(e) => setDealForm(prev => ({ ...prev, stage: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="lead">Lead</option>
                    <option value="qualified">Zakwalifikowany</option>
                    <option value="proposal">Propozycja</option>
                    <option value="negotiation">Negocjacje</option>
                    <option value="won">Wygrany</option>
                    <option value="lost">Przegrany</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Przewidywana data zamknięcia</label>
                  <input
                    type="date"
                    value={dealForm.expected_close_date}
                    onChange={(e) => setDealForm(prev => ({ ...prev, expected_close_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddDealModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCreateDeal}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!dealForm.title}
                >
                  Dodaj deal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {showDiscountModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Rabat - {selectedCompany.name}</h3>
              <button onClick={() => setShowDiscountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-sm text-blue-800">
                <strong>Maksymalny rabat:</strong> {maxDiscount}%
              </p>
              <p className="text-xs text-blue-600 mt-1">Limit ustalony przez administratora systemu</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Procent rabatu (max {maxDiscount}%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={maxDiscount}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(maxDiscount, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-2 pr-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={maxDiscount}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
                  className="w-full mt-2 accent-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Powód (opcjonalnie)</label>
                <textarea
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Opisz powód przyznania rabatu..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDiscountModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleApplyDiscount}
                disabled={loadingDiscount}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Zastosuj rabat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus History Modal */}
      {showBonusModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
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
                  <p className="text-3xl font-bold text-green-800">
                    {getLinkedCompany(selectedCompany)?.bonus_balance?.toFixed(2) || '0.00'} PLN
                  </p>
                </div>
              </div>

              {/* Bonus History */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Historia operacji</h4>
                {loadingBonus ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                  </div>
                ) : bonusHistory.length > 0 ? (
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

      {/* Subscription Modal */}
      {showSubscriptionModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
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
                    getSubscriptionLabel(selectedCompany).color
                  }`}>
                    {getSubscriptionLabel(selectedCompany).text}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Balans bonusowy</p>
                  <p className="text-xl font-bold text-green-600">
                    {getLinkedCompany(selectedCompany)?.bonus_balance?.toFixed(2) || '0.00'} PLN
                  </p>
                </div>
              </div>

              {/* Demo button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    const today = new Date();
                    today.setDate(today.getDate() + 14);
                    setDemoEndDate(today.toISOString().split('T')[0]);
                    setShowDemoModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <Calendar className="w-4 h-4" />
                  Nalicz DEMO
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-4 border-b border-slate-200">
              <button
                onClick={() => setSubscriptionTab('subscriptions')}
                className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
                  subscriptionTab === 'subscriptions'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Subskrypcje
              </button>
              <button
                onClick={() => setSubscriptionTab('history')}
                className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
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
                className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
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
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Moduły</h4>
                    <div className="space-y-2">
                      {state.modules.filter(m => m.is_active).map(mod => {
                        const linkedCompany = getLinkedCompany(selectedCompany);
                        const companyMod = linkedCompany
                          ? getLinkedCompanyModules(linkedCompany.id).find(cm => cm.module_code === mod.code)
                          : null;
                        const isActive = companyMod?.is_active;
                        return (
                          <div key={mod.code} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{mod.name_pl}</p>
                              <p className="text-sm text-slate-500">
                                {isActive && companyMod
                                  ? `${companyMod.max_users} użytkowników, ${companyMod.price_per_user} PLN/os/mies.`
                                  : `${mod.base_price_per_user} PLN/os/mies.`
                                }
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              {isActive && companyMod && (
                                <p className="font-bold text-slate-900">{(companyMod.max_users * companyMod.price_per_user).toFixed(2)} PLN/mies.</p>
                              )}
                              <button
                                onClick={() => handleToggleModule(mod, !isActive)}
                                disabled={loadingSubscription}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                  isActive ? 'bg-green-500' : 'bg-slate-300'
                                } ${loadingSubscription ? 'opacity-50' : ''}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                  isActive ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {subscriptionTab === 'history' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Historia zmian subskrypcji</h4>
                  {loadingSubscription ? (
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
                  {(() => {
                    const linkedCompany = getLinkedCompany(selectedCompany);
                    const payments = linkedCompany ? getLinkedCompanyPaymentHistory(linkedCompany.id) : [];
                    return payments.length > 0 ? (
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
                            {payments.map(payment => (
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
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demo Modal */}
      {showDemoModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Nalicz DEMO</h3>
              <button onClick={() => setShowDemoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-600 mb-4">
              Ustaw okres DEMO dla firmy <strong>{selectedCompany.name}</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data zakończenia DEMO</label>
                <input
                  type="date"
                  value={demoEndDate}
                  onChange={(e) => setDemoEndDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDemoModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleStartDemo}
                disabled={loadingDemo || !demoEndDate}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingDemo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Ustaw DEMO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
