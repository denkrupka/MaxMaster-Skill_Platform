
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users, Clock, ClipboardList, CalendarOff, CalendarDays, CalendarClock,
  CalendarRange, FolderKanban, ListTodo, CheckSquare, Building2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Role } from '../types';

export type Section = 'obecnosci' | 'urlopy' | 'grafiki' | 'projekty';

interface TabDef {
  label: string;
  path: string;
  icon: React.ReactNode;
}

function getTabsForSection(section: Section, effectiveRole: Role): TabDef[] | null {
  // Employee, trial, candidate don't get section tabs
  if (
    effectiveRole === Role.EMPLOYEE ||
    effectiveRole === Role.TRIAL ||
    effectiveRole === Role.CANDIDATE ||
    effectiveRole === Role.SUPERADMIN ||
    effectiveRole === Role.SALES ||
    effectiveRole === Role.DORADCA ||
    effectiveRole === Role.ADMIN
  ) {
    return null;
  }

  if (section === 'obecnosci') {
    if (effectiveRole === Role.BRIGADIR) {
      return [
        { label: 'Czas pracy', path: '/employee/attendance', icon: <Clock className="w-4 h-4" /> },
        { label: 'Kto w pracy', path: '/company/team-now', icon: <Users className="w-4 h-4" /> },
        { label: 'Obecności', path: '/company/attendance', icon: <ClipboardList className="w-4 h-4" /> },
      ];
    }
    // COMPANY_ADMIN, HR, COORDINATOR
    return [
      { label: 'Kto w pracy', path: '/company/team-now', icon: <Users className="w-4 h-4" /> },
      { label: 'Moja ewidencja', path: '/employee/attendance', icon: <Clock className="w-4 h-4" /> },
      { label: 'Obecności', path: '/company/attendance', icon: <ClipboardList className="w-4 h-4" /> },
    ];
  }

  if (section === 'urlopy') {
    // HR has single page, no tabs
    if (effectiveRole === Role.HR) return null;
    // Brigadir doesn't have grafiki/projekty but has urlopy
    // COMPANY_ADMIN, COORDINATOR, BRIGADIR
    return [
      { label: 'Moje urlopy', path: '/employee/time-off', icon: <CalendarOff className="w-4 h-4" /> },
      { label: 'Zarządzanie urlopami', path: '/company/time-off', icon: <CalendarDays className="w-4 h-4" /> },
    ];
  }

  if (section === 'grafiki') {
    // HR has single page, no tabs
    if (effectiveRole === Role.HR) return null;
    // Brigadir doesn't have grafiki section
    if (effectiveRole === Role.BRIGADIR) return null;
    // COMPANY_ADMIN, COORDINATOR
    return [
      { label: 'Mój grafik', path: '/employee/schedule', icon: <CalendarClock className="w-4 h-4" /> },
      { label: 'Grafiki zespołu', path: '/company/schedules', icon: <CalendarRange className="w-4 h-4" /> },
    ];
  }

  if (section === 'projekty') {
    // Brigadir doesn't have projekty section
    if (effectiveRole === Role.BRIGADIR) return null;

    if (effectiveRole === Role.HR) {
      return [
        { label: 'Projekty', path: '/company/projects', icon: <FolderKanban className="w-4 h-4" /> },
        { label: 'Zadania', path: '/company/tasks', icon: <ListTodo className="w-4 h-4" /> },
        { label: 'Klienci', path: '/company/customers', icon: <Building2 className="w-4 h-4" /> },
      ];
    }

    // COMPANY_ADMIN, COORDINATOR
    return [
      { label: 'Moje zadania', path: '/employee/tasks', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Wszystkie zadania', path: '/company/tasks', icon: <ListTodo className="w-4 h-4" /> },
      { label: 'Projekty', path: '/company/projects', icon: <FolderKanban className="w-4 h-4" /> },
    ];
  }

  return null;
}

export function getAllPathsForSection(section: Section): string[] {
  const paths: Record<Section, string[]> = {
    obecnosci: ['/company/team-now', '/employee/attendance', '/company/attendance'],
    urlopy: ['/employee/time-off', '/company/time-off'],
    grafiki: ['/employee/schedule', '/company/schedules'],
    projekty: ['/employee/tasks', '/company/tasks', '/company/projects', '/company/customers'],
  };
  return paths[section];
}

interface SectionTabsProps {
  section: Section;
}

export const SectionTabs: React.FC<SectionTabsProps> = ({ section }) => {
  const { getEffectiveRole } = useAppContext();
  const location = useLocation();
  const effectiveRole = getEffectiveRole();

  const tabs = getTabsForSection(section, effectiveRole);

  if (!tabs || tabs.length <= 1) return null;

  const isTabActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
      {tabs.map((tab) => {
        const active = isTabActive(tab.path);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              active
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};
