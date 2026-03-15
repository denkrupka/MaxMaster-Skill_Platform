import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Building2, User, Mail, Phone, MapPin,
  FileText, Calendar, Clock, Loader2, CheckCircle2, AlertCircle,
  Upload, X, Download, Eye, ChevronRight, Hash, Briefcase
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import type {
  KosztorysRequest,
  KosztorysRequestContact,
  KosztorysRequestStatus,
  User as UserType
} from '../../types';

// Status configuration
const STATUS_CONFIG: Record<KosztorysRequestStatus, { label: string; color: string; bgColor: string }> = {
  new: { label: 'Nowe', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  in_progress: { label: 'W pracy', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  form_filled: { label: 'Formularz', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  estimate_generated: { label: 'Kosztorys', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  estimate_approved: { label: 'Zatwierdzony', color: 'text-green-700', bgColor: 'bg-green-100' },
  estimate_revision: { label: 'Do poprawy', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  kp_sent: { label: 'KP wysłane', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  closed: { label: 'Zamknięte', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  cancelled: { label: 'Anulowane', color: 'text-red-700', bgColor: 'bg-red-100' }
};

interface ContractorOffer {
  id: string;
  contractor_id: string;
  contractor_name: string;
  contractor_nip?: string;
  contractor_email?: string;
  contractor_phone?: string;
  file_url?: string;
  file_name?: string;
  price?: number;
  currency?: string;
  delivery_days?: number;
  warranty_months?: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  responded_at?: string;
}

export const ContractorRequestPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentUser } = state;

  const [request, setRequest] = useState<KosztorysRequest | null>(null);
  const [contacts, setContacts] = useState<KosztorysRequestContact[]>([]);
  const [offers, setOffers] = useState<ContractorOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Form state
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    if (requestId) {
      loadRequest();
    }
  }, [requestId]);

  const loadRequest = async () => {
    if (!requestId) return;
    setLoading(true);
    
    try {
      // Load request with contacts
      const { data: requestData, error: requestError } = await supabase
        .from('kosztorys_requests')
        .select(`
          *,
          assigned_user:users!kosztorys_requests_assigned_user_id_fkey(id, first_name, last_name, email),
          created_by:users!kosztorys_requests_created_by_id_fkey(id, first_name, last_name),
          contacts:kosztorys_request_contacts(*)
        `)
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;
      setRequest(requestData);
      setContacts(requestData.contacts || []);

      // Load contractor offers
      const { data: offersData, error: offersError } = await supabase
        .from('contractor_offers')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (offersError) throw offersError;
      setOffers(offersData || []);

      // Set default deadline (7 days from now)
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 7);
      setDeadline(defaultDeadline.toISOString().split('T')[0]);

    } catch (err) {
      console.error('Error loading request:', err);
      showNotification('Błąd podczas ładowania zapytania', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (attachments.length === 0) return [];
    
    const urls: string[] = [];
    
    for (const file of attachments) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `request_attachments/${requestId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('construction')
        .upload(filePath, file);
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('construction')
        .getPublicUrl(filePath);
      
      urls.push(publicUrl);
    }
    
    return urls;
  };

  const handleSendRequest = async () => {
    if (selectedContacts.length === 0) {
      showNotification('Wybierz przynajmniej jeden kontakt', 'error');
      return;
    }

    setSending(true);
    
    try {
      // Upload attachments
      const attachmentUrls = await uploadAttachments();

      // Get selected contacts details
      const selectedContactsData = contacts.filter(c => selectedContacts.includes(c.id));

      // Create contractor request records
      const contractorRequests = selectedContactsData.map(contact => ({
        request_id: requestId,
        contact_id: contact.id,
        contact_email: contact.email,
        contact_name: `${contact.first_name} ${contact.last_name}`,
        message: message,
        deadline: deadline,
        attachments: attachmentUrls,
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: currentUser?.id
      }));

      const { error } = await supabase
        .from('contractor_request_sends')
        .insert(contractorRequests);

      if (error) throw error;

      // TODO: Send actual emails via edge function
      // await supabase.functions.invoke('send-contractor-request', {
      //   body: { requests: contractorRequests }
      // });

      showNotification(`Wysłano zapytanie do ${selectedContacts.length} podwykonawców`, 'success');
      
      // Clear form
      setSelectedContacts([]);
      setMessage('');
      setAttachments([]);
      
    } catch (err) {
      console.error('Error sending request:', err);
      showNotification('Błąd podczas wysyłania zapytania', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('contractor_offers')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', offerId);

      if (error) throw error;
      
      showNotification('Oferta zaakceptowana', 'success');
      loadRequest();
    } catch (err) {
      showNotification('Błąd podczas akceptowania oferty', 'error');
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('contractor_offers')
        .update({ 
          status: 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', offerId);

      if (error) throw error;
      
      showNotification('Oferta odrzucona', 'success');
      loadRequest();
    } catch (err) {
      showNotification('Błąd podczas odrzucania oferty', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">Nie znaleziono zapytania</h2>
        <button
          onClick={() => navigate('/construction/requests')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Wróć do listy
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[request.status];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/construction/requests')}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-slate-900">
                    Zapytanie ofertowe
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {request.object_code} • {request.investment_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                Utworzono: {new Date(request.created_at).toLocaleDateString('pl-PL')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className={notification.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {notification.message}
          </span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left column - Request details */}
          <div className="space-y-6">
            {/* Client info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  Klient
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase">Nazwa firmy</label>
                  <p className="font-medium text-slate-900">{request.client_name}</p>
                </div>
                {request.nip && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase">NIP</label>
                    <p className="font-medium text-slate-900">{request.nip}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-500 uppercase">Adres</label>
                  <p className="text-slate-700">
                    {request.company_street} {request.company_street_number}<br />
                    {request.company_postal_code} {request.company_city}
                  </p>
                </div>
              </div>
            </div>

            {/* Object info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Obiekt
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase">Nazwa inwestycji</label>
                  <p className="font-medium text-slate-900">{request.investment_name}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Typ instalacji</label>
                  <p className="font-medium text-slate-900">{request.installation_types}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Adres obiektu</label>
                  <p className="text-slate-700">
                    {request.object_street} {request.object_street_number}<br />
                    {request.object_postal_code} {request.object_city}
                  </p>
                </div>
                {request.notes && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase">Uwagi</label>
                    <p className="text-slate-700 text-sm">{request.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Middle column - Send request */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-slate-400" />
                  Wyślij zapytanie do podwykonawców
                </h3>
              </div>
              <div className="p-6 space-y-6">
                {/* Contacts list */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Wybierz kontakty ({selectedContacts.length} zaznaczonych)
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-2">
                    {contacts.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Brak kontaktów. Dodaj kontakty w szczegółach zapytania.
                      </p>
                    ) : (
                      contacts.map(contact => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={() => handleContactToggle(contact.id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">
                              {contact.first_name} {contact.last_name}
                              {contact.is_primary && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  Główny
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-slate-500">{contact.position}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Treść zapytania
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Wprowadź treść zapytania ofertowego..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Termin odpowiedzi
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Załączniki
                  </label>
                  <div className="space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="flex-1 text-sm text-slate-700 truncate">{file.name}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    ))}
                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Dodaj załącznik</span>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Send button */}
                <button
                  onClick={handleSendRequest}
                  disabled={sending || selectedContacts.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Wysyłanie...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Wyślij zapytanie ({selectedContacts.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right column - Received offers */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Otrzymane oferty ({offers.length})
                </h3>
              </div>
              <div className="p-6">
                {offers.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Brak otrzymanych ofert</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Oferty pojawią się tutaj po wysłaniu zapytań
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {offers.map(offer => (
                      <div
                        key={offer.id}
                        className={`border rounded-lg p-4 ${
                          offer.status === 'accepted' ? 'border-green-200 bg-green-50' :
                          offer.status === 'rejected' ? 'border-red-200 bg-red-50' :
                          'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-slate-900">{offer.contractor_name}</h4>
                            {offer.contractor_nip && (
                              <p className="text-xs text-slate-500">NIP: {offer.contractor_nip}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            offer.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            offer.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {offer.status === 'accepted' ? 'Zaakceptowana' :
                             offer.status === 'rejected' ? 'Odrzucona' : 'Oczekująca'}
                          </span>
                        </div>

                        {offer.price && (
                          <div className="mb-3">
                            <span className="text-2xl font-bold text-slate-900">
                              {offer.price.toLocaleString('pl-PL')} {offer.currency || 'PLN'}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          {offer.delivery_days && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Clock className="w-3 h-3" />
                              {offer.delivery_days} dni
                            </div>
                          )}
                          {offer.warranty_months && (
                            <div className="flex items-center gap-1 text-slate-600">
                              <Calendar className="w-3 h-3" />
                              {offer.warranty_months} mc gwarancji
                            </div>
                          )}
                        </div>

                        {offer.notes && (
                          <p className="text-sm text-slate-600 mb-3">{offer.notes}</p>
                        )}

                        {offer.file_url && (
                          <a
                            href={offer.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-3"
                          >
                            <Download className="w-4 h-4" />
                            {offer.file_name || 'Pobierz ofertę'}
                          </a>
                        )}

                        {offer.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptOffer(offer.id)}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Akceptuj
                            </button>
                            <button
                              onClick={() => handleRejectOffer(offer.id)}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                            >
                              <X className="w-4 h-4" />
                              Odrzuć
                            </button>
                          </div>
                        )}

                        <p className="text-xs text-slate-400 mt-2">
                          Otrzymano: {new Date(offer.created_at).toLocaleDateString('pl-PL')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractorRequestPage;
