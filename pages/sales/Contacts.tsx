
import React, { useState, useMemo } from 'react';
import { Plus, Search, User, Building2, Phone, Mail, Star, Filter, X, ExternalLink, Briefcase } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CRMContact, CRMCompany } from '../../types';

export const SalesContacts: React.FC = () => {
  const { state } = useAppContext();
  const { crmContacts, crmCompanies, crmDeals } = state;

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [lprFilter, setLprFilter] = useState<'all' | 'lpr' | 'other'>('all');
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return crmContacts.filter(c => {
      const matchesSearch =
        c.first_name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.position?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter === 'all' || c.crm_company_id === companyFilter;
      const matchesLpr = lprFilter === 'all' ||
        (lprFilter === 'lpr' && c.is_decision_maker) ||
        (lprFilter === 'other' && !c.is_decision_maker);
      return matchesSearch && matchesCompany && matchesLpr;
    });
  }, [crmContacts, search, companyFilter, lprFilter]);

  // Get company by ID
  const getCompany = (companyId?: string): CRMCompany | undefined => {
    return crmCompanies.find(c => c.id === companyId);
  };

  // Get contact's deals
  const getContactDeals = (contactId: string) => {
    return crmDeals.filter(d => d.contact_id === contactId);
  };

  // Stats
  const lprCount = crmContacts.filter(c => c.is_decision_maker).length;
  const totalContacts = crmContacts.length;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kontakty</h1>
          <p className="text-slate-500 mt-1">
            Baza kontaktów i osób decyzyjnych (LPR) — {totalContacts} kontaktów, w tym {lprCount} LPR
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj kontaktów..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie firmy</option>
            {crmCompanies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <select
            value={lprFilter}
            onChange={(e) => setLprFilter(e.target.value as 'all' | 'lpr' | 'other')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszyscy</option>
            <option value="lpr">Tylko LPR</option>
            <option value="other">Pozostali</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" />
            Dodaj kontakt
          </button>
        </div>
      </div>

      {filteredContacts.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stanowisko</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.map(contact => {
                const company = getCompany(contact.crm_company_id);
                const deals = getContactDeals(contact.id);
                return (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${contact.is_decision_maker ? 'bg-amber-100' : 'bg-slate-100'}`}>
                          {contact.is_decision_maker ? (
                            <Star className="w-5 h-5 text-amber-600" />
                          ) : (
                            <User className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{contact.first_name} {contact.last_name}</p>
                          {contact.is_decision_maker && (
                            <span className="text-xs text-amber-600 font-medium">LPR</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {company ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-700">{company.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contact.position ? (
                        <div>
                          <p className="text-slate-700">{contact.position}</p>
                          {contact.department && (
                            <p className="text-xs text-slate-500">{contact.department}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[180px]">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        contact.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {contact.status === 'active' ? 'Aktywny' : 'Nieaktywny'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {deals.length > 0 ? (
                        <span className="text-blue-600 font-medium">{deals.length} deal{deals.length > 1 ? 'i' : ''}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {crmContacts.length === 0 ? 'Brak kontaktów w bazie' : 'Brak kontaktów spełniających kryteria'}
          </p>
          {crmContacts.length === 0 && (
            <button className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">
              Dodaj pierwszy kontakt
            </button>
          )}
        </div>
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedContact.is_decision_maker ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  {selectedContact.is_decision_maker ? (
                    <Star className="w-6 h-6 text-amber-600" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedContact.first_name} {selectedContact.last_name}
                  </h3>
                  {selectedContact.is_decision_maker && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Star className="w-3 h-3" /> Osoba decyzyjna (LPR)
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Company */}
              {selectedContact.crm_company_id && (
                <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Firma</p>
                    <p className="font-medium text-slate-900">
                      {getCompany(selectedContact.crm_company_id)?.name || '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Position & Department */}
              {(selectedContact.position || selectedContact.department) && (
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                  <div>
                    {selectedContact.position && <p className="font-medium text-slate-900">{selectedContact.position}</p>}
                    {selectedContact.department && <p className="text-sm text-slate-500">{selectedContact.department}</p>}
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-2">
                {selectedContact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-slate-400" />
                    <a href={`mailto:${selectedContact.email}`} className="text-blue-600 hover:underline">
                      {selectedContact.email}
                    </a>
                  </div>
                )}
                {selectedContact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <a href={`tel:${selectedContact.phone}`} className="text-slate-700 hover:text-blue-600">
                      {selectedContact.phone}
                    </a>
                  </div>
                )}
              </div>

              {/* Deals */}
              {getContactDeals(selectedContact.id).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Powiązane deale</p>
                  <div className="space-y-2">
                    {getContactDeals(selectedContact.id).map(deal => (
                      <div key={deal.id} className="bg-blue-50 p-2 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">{deal.title}</span>
                        <span className="text-xs text-blue-600">
                          {deal.value ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(deal.value) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedContact.notes && (
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Notatki</p>
                  <p className="text-slate-700">{selectedContact.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Edytuj
              </button>
              <button
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
