import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, Award, TrendingUp, Clock, Search,
  ChevronRight, AlertTriangle, CheckCircle, BookOpen
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Company, UserStatus } from '../../types';

export const DoradcaDashboard: React.FC = () => {
  const { state } = useAppContext();
  const { companies, allUsers } = state;

  const [search, setSearch] = useState('');

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    return companies.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase())
    );
  }, [companies, search]);

  // Get stats for a company
  const getCompanyStats = (company: Company) => {
    const companyUsers = allUsers.filter(u => u.company_id === company.id);
    const employees = companyUsers.filter(u => u.status === UserStatus.ACTIVE);
    const trial = companyUsers.filter(u => u.status === UserStatus.TRIAL);
    const candidates = companyUsers.filter(u => u.status === UserStatus.PENDING);

    return {
      total: companyUsers.length,
      employees: employees.length,
      trial: trial.length,
      candidates: candidates.length
    };
  };

  // Overall stats
  const totalStats = useMemo(() => {
    const total = allUsers.length;
    const employees = allUsers.filter(u => u.status === UserStatus.ACTIVE).length;
    const trial = allUsers.filter(u => u.status === UserStatus.TRIAL).length;
    return { total, employees, trial, companies: companies.length };
  }, [allUsers, companies]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Panel Doradcy</h1>
        <p className="text-slate-500 mt-1">
          Przegląd firm i pracowników pod opieką konsultacyjną
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalStats.companies}</p>
              <p className="text-xs text-slate-500">Firm pod opieką</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalStats.employees}</p>
              <p className="text-xs text-slate-500">Pracowników</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalStats.trial}</p>
              <p className="text-xs text-slate-500">Okres próbny</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalStats.total}</p>
              <p className="text-xs text-slate-500">Wszystkich użytkowników</p>
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
            {filteredCompanies.map(company => {
              const stats = getCompanyStats(company);
              return (
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

                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>{stats.employees} aktywnych</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-600">
                        <Clock className="w-4 h-4" />
                        <span>{stats.trial} próbnych</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Users className="w-4 h-4" />
                        <span>{stats.total} łącznie</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {companies.length === 0 ? 'Brak firm pod opieką' : 'Brak firm spełniających kryteria'}
            </p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Link
          to="/doradca/skills"
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Award className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Przegląd umiejętności</h3>
            <p className="text-sm text-slate-500">Analiza kompetencji we wszystkich firmach</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
        </Link>

        <Link
          to="/doradca/library"
          className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Biblioteka materiałów</h3>
            <p className="text-sm text-slate-500">Dokumenty i materiały szkoleniowe</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
        </Link>
      </div>
    </div>
  );
};
