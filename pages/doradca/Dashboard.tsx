import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Search, ChevronRight
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Company } from '../../types';

export const DoradcaDashboard: React.FC = () => {
  const { state } = useAppContext();
  const { companies } = state;

  const [search, setSearch] = useState('');

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    return (companies || []).filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase())
    );
  }, [companies, search]);

  // Overall stats - only companies count
  const totalCompanies = useMemo(() => {
    return (companies || []).length;
  }, [companies]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Panel Doradcy</h1>
        <p className="text-slate-500 mt-1">
          Przegląd firm pod opieką konsultacyjną
        </p>
      </div>

      {/* Global Stats - Only companies count */}
      <div className="mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 inline-flex">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalCompanies}</p>
              <p className="text-xs text-slate-500">Firm pod opieką</p>
            </div>
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Firmy pod opieką</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj firmy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {filteredCompanies.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredCompanies.map(company => (
              <Link
                key={company.id}
                to={`/doradca/company/${company.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{company.name}</h3>
                    <p className="text-sm text-slate-500">{company.industry || 'Brak branży'}</p>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {(companies || []).length === 0 ? 'Brak firm pod opieką' : 'Brak firm spełniających kryteria'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
