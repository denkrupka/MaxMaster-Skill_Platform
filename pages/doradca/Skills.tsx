import React, { useState, useMemo } from 'react';
import {
  Award, Search, Users, Building2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Skill, SkillStatus, UserStatus } from '../../types';

export const DoradcaSkills: React.FC = () => {
  const { state } = useAppContext();
  const { skills, userSkills, allUsers, companies } = state;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(skills.map(s => s.category).filter(Boolean));
    return Array.from(cats);
  }, [skills]);

  // Calculate skill statistics
  const skillStats = useMemo(() => {
    const activeUserIds = new Set(
      allUsers
        .filter(u => u.status === UserStatus.ACTIVE || u.status === UserStatus.TRIAL)
        .filter(u => companyFilter === 'all' || u.company_id === companyFilter)
        .map(u => u.id)
    );

    return skills.map(skill => {
      const relevantUserSkills = userSkills.filter(
        us => us.skill_id === skill.id && activeUserIds.has(us.user_id)
      );

      const confirmed = relevantUserSkills.filter(us => us.status === SkillStatus.CONFIRMED).length;
      const pending = relevantUserSkills.filter(us =>
        us.status === SkillStatus.PENDING ||
        us.status === SkillStatus.THEORY_PASSED
      ).length;
      const inProgress = relevantUserSkills.filter(us =>
        us.status === SkillStatus.PRACTICE_PENDING
      ).length;

      return {
        skill,
        totalUsers: relevantUserSkills.length,
        confirmed,
        pending,
        inProgress
      };
    }).sort((a, b) => b.totalUsers - a.totalUsers);
  }, [skills, userSkills, allUsers, companyFilter]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skillStats.filter(s => {
      const matchesSearch = s.skill.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || s.skill.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [skillStats, search, categoryFilter]);

  // Top skills summary
  const topSkills = filteredSkills.slice(0, 5);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Przegląd umiejętności</h1>
        <p className="text-slate-500 mt-1">
          Analiza kompetencji pracowników we wszystkich firmach
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj umiejętności..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie kategorie</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie firmy</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Skills Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {topSkills.map((s, index) => (
          <div key={s.skill.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold text-slate-400">#{index + 1}</span>
              <Award className="w-5 h-5 text-purple-500" />
            </div>
            <p className="font-medium text-slate-900 truncate">{s.skill.name}</p>
            <p className="text-sm text-slate-500">{s.confirmed} potwierdzonych</p>
          </div>
        ))}
      </div>

      {/* Skills Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            Wszystkie umiejętności ({filteredSkills.length})
          </h2>
        </div>

        {filteredSkills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Umiejętność</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Kategoria</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Łącznie</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Potwierdzone</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">W trakcie</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Oczekujące</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSkills.map(s => (
                  <tr key={s.skill.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-slate-900">{s.skill.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {s.skill.category || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        <Users className="w-3 h-3" />
                        {s.totalUsers}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className={`text-sm ${s.confirmed > 0 ? 'font-medium text-green-600' : 'text-slate-400'}`}>
                        {s.confirmed}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className={`text-sm ${s.inProgress > 0 ? 'font-medium text-amber-600' : 'text-slate-400'}`}>
                        {s.inProgress}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className={`text-sm ${s.pending > 0 ? 'font-medium text-slate-600' : 'text-slate-400'}`}>
                        {s.pending}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Brak umiejętności spełniających kryteria</p>
          </div>
        )}
      </div>
    </div>
  );
};
