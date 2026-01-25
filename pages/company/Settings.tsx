
import React, { useState } from 'react';
import { Building2, Save, AlertTriangle, Trash2, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export const CompanySettingsPage: React.FC = () => {
  const { state, updateCompany, deleteCompany, logout } = useAppContext();
  const { currentCompany } = state;

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: currentCompany?.name || '',
    legal_name: currentCompany?.legal_name || '',
    tax_id: currentCompany?.tax_id || '',
    regon: currentCompany?.regon || '',
    address_street: currentCompany?.address_street || '',
    address_city: currentCompany?.address_city || '',
    address_postal_code: currentCompany?.address_postal_code || '',
    address_country: currentCompany?.address_country || 'Polska',
    contact_email: currentCompany?.contact_email || '',
    contact_phone: currentCompany?.contact_phone || '',
    billing_email: currentCompany?.billing_email || ''
  });

  // Handle form change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle save
  const handleSave = async () => {
    if (!currentCompany) return;

    setIsSaving(true);
    try {
      await updateCompany(currentCompany.id, formData);
      alert('Dane zapisane pomyślnie');
    } catch (error) {
      console.error('Error saving company data:', error);
      alert('Błąd podczas zapisywania danych');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete company
  const handleDeleteCompany = async () => {
    if (!currentCompany || deleteConfirmation !== currentCompany.name) return;

    try {
      await deleteCompany(currentCompany.id);
      logout();
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Błąd podczas usuwania firmy');
    }
  };

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-800">Brak przypisanej firmy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ustawienia firmy</h1>
        <p className="text-slate-500 mt-1">Zarządzaj danymi swojej firmy</p>
      </div>

      {/* Company Info Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dane firmy</h2>
            <p className="text-sm text-slate-500">Te dane będą wykorzystywane na fakturach</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa firmy *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa prawna (do faktur)</label>
            <input
              type="text"
              name="legal_name"
              value={formData.legal_name}
              onChange={handleFormChange}
              placeholder="np. Firma Sp. z o.o."
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
            <input
              type="text"
              name="tax_id"
              value={formData.tax_id}
              onChange={handleFormChange}
              placeholder="np. 1234567890"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">REGON</label>
            <input
              type="text"
              name="regon"
              value={formData.regon}
              onChange={handleFormChange}
              placeholder="np. 123456789"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Ulica i numer</label>
            <input
              type="text"
              name="address_street"
              value={formData.address_street}
              onChange={handleFormChange}
              placeholder="np. ul. Przykładowa 123"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod pocztowy</label>
            <input
              type="text"
              name="address_postal_code"
              value={formData.address_postal_code}
              onChange={handleFormChange}
              placeholder="np. 00-000"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Miasto</label>
            <input
              type="text"
              name="address_city"
              value={formData.address_city}
              onChange={handleFormChange}
              placeholder="np. Warszawa"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kraj</label>
            <input
              type="text"
              name="address_country"
              value={formData.address_country}
              onChange={handleFormChange}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Dane kontaktowe</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email kontaktowy</label>
            <input
              type="email"
              name="contact_email"
              value={formData.contact_email}
              onChange={handleFormChange}
              placeholder="kontakt@firma.pl"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
            <input
              type="tel"
              name="contact_phone"
              value={formData.contact_phone}
              onChange={handleFormChange}
              placeholder="+48 123 456 789"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Email do faktur</label>
            <input
              type="email"
              name="billing_email"
              value={formData.billing_email}
              onChange={handleFormChange}
              placeholder="faktury@firma.pl"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Na ten adres będą wysyłane faktury</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handleSave}
          disabled={isSaving || !formData.name}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
        >
          <Save className="w-5 h-5" />
          {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Strefa zagrożenia</h2>
        <p className="text-sm text-red-600 mb-4">
          Te akcje są nieodwracalne. Upewnij się, że wiesz co robisz.
        </p>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          <Trash2 className="w-5 h-5" />
          Usuń firmę
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-red-600">Usuń firmę</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="font-medium text-red-800">Ta operacja jest nieodwracalna!</p>
                  <p className="text-sm text-red-600">Wszystkie dane firmy zostaną trwale usunięte.</p>
                </div>
              </div>

              <p className="text-slate-600 mb-4">
                Wpisz nazwę firmy <strong>"{currentCompany.name}"</strong> aby potwierdzić usunięcie:
              </p>

              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={currentCompany.name}
                className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleDeleteCompany}
                disabled={deleteConfirmation !== currentCompany.name}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Usuń firmę
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
