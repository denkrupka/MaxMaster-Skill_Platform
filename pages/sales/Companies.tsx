
import React, { useState, useMemo } from 'react';
import { Plus, Search, Building2, MapPin, Globe, Users, Edit, Trash2, X, ExternalLink } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CRMCompany } from '../../types';
import { INDUSTRY_OPTIONS } from '../../constants';

export const SalesCompanies: React.FC = () => {
  const { state } = useAppContext();
  const { crmCompanies, crmContacts, crmDeals } = state;

  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null);

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return crmCompanies.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                           c.legal_name?.toLowerCase().includes(search.toLowerCase()) ||
                           c.address_city?.toLowerCase().includes(search.toLowerCase());
      const matchesIndustry = industryFilter === 'all' || c.industry === industryFilter;
      return matchesSearch && matchesIndustry;
    });
  }, [crmCompanies, search, industryFilter]);

  // Get company stats
  const getCompanyStats = (companyId: string) => {
    const contacts = crmContacts.filter(c => c.crm_company_id === companyId);
    const deals = crmDeals.filter(d => d.crm_company_id === companyId);
    const totalDealValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    return { contactsCount: contacts.length, dealsCount: deals.length, totalDealValue };
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Firmy</h1>
          <p className="text-slate-500 mt-1">Baza firm klientów i prospektów ({crmCompanies.length})</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Szukaj firm..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-64 focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="all">Wszystkie branże</option>
            {INDUSTRY_OPTIONS.map(ind => (<option key={ind} value={ind}>{ind}</option>))}
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"><Plus className="w-4 h-4" />Dodaj firmę</button>
        </div>
      </div>

      {filteredCompanies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map(company => {
            const stats = getCompanyStats(company.id);
            return (
              <div key={company.id} onClick={() => setSelectedCompany(company)} className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-600" /></div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{company.name}</h3>
                      {company.industry && (<p className="text-xs text-slate-500">{company.industry}</p>)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {company.address_city && (<div className="flex items-center gap-2 text-slate-600"><MapPin className="w-4 h-4 text-slate-400" /><span>{company.address_city}</span></div>)}
                  {company.employee_count && (<div className="flex items-center gap-2 text-slate-600"><Users className="w-4 h-4 text-slate-400" /><span>{company.employee_count} pracowników</span></div>)}
                  {company.website && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Globe className="w-4 h-4 text-slate-400" />
                      <a href={company.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline truncate">{company.website.replace('https://', '')}</a>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                  <span>{stats.contactsCount} kontaktów</span>
                  <span>{stats.dealsCount} deali ({formatCurrency(stats.totalDealValue)})</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{crmCompanies.length === 0 ? 'Brak firm w bazie' : 'Brak firm spełniających kryteria'}</p>
          {crmCompanies.length === 0 && (<button className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">Dodaj pierwszą firmę</button>)}
        </div>
      )}

      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><Building2 className="w-6 h-6 text-blue-600" /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCompany.name}</h3>
                  {selectedCompany.legal_name && (<p className="text-sm text-slate-500">{selectedCompany.legal_name}</p>)}
                </div>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {selectedCompany.industry && (<span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">{selectedCompany.industry}</span>)}
              <div className="grid grid-cols-2 gap-4">
                {selectedCompany.tax_id && (<div><p className="text-xs text-slate-500">NIP</p><p className="font-medium text-slate-900">{selectedCompany.tax_id}</p></div>)}
                {selectedCompany.regon && (<div><p className="text-xs text-slate-500">REGON</p><p className="font-medium text-slate-900">{selectedCompany.regon}</p></div>)}
              </div>
              <div className="space-y-2">
                {selectedCompany.address_street && (<div className="flex items-center gap-2 text-slate-600"><MapPin className="w-4 h-4 text-slate-400" /><span>{selectedCompany.address_street}, {selectedCompany.address_city}</span></div>)}
                {selectedCompany.website && (<div className="flex items-center gap-2 text-slate-600"><Globe className="w-4 h-4 text-slate-400" /><a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">{selectedCompany.website} <ExternalLink className="w-3 h-3" /></a></div>)}
                {selectedCompany.employee_count && (<div className="flex items-center gap-2 text-slate-600"><Users className="w-4 h-4 text-slate-400" /><span>{selectedCompany.employee_count} pracowników</span></div>)}
              </div>
              {selectedCompany.notes && (<div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500 mb-1">Notatki</p><p className="text-slate-700">{selectedCompany.notes}</p></div>)}
              {selectedCompany.source && (<p className="text-sm text-slate-500">Źródło: {selectedCompany.source}</p>)}
            </div>
            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100">
              <button className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-2"><Edit className="w-4 h-4" />Edytuj</button>
              <button className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
