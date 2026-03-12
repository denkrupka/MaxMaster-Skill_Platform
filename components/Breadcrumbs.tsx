import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

// Route-based auto breadcrumbs
const ROUTE_LABELS: Record<string, string> = {
  // Company Admin
  'dashboard': 'Dashboard',
  'company': 'Admin firmy',
  'settings': 'Ustawienia',
  'users': 'Użytkownicy',
  'attendance': 'Obecność',
  'time-off': 'Urlopy',
  'schedules': 'Grafiki',
  'tasks': 'Zadania',
  'projects': 'Projekty',
  'customers': 'Klienci',
  'timesheets': 'Karty pracy',
  'reports': 'Raporty',
  'subscription': 'Subskrypcja',
  'departments': 'Działy',
  'team-now': 'Zespół teraz',
  'notifications': 'Powiadomienia',
  // HR
  'hr': 'HR',
  'candidates': 'Kandydaci',
  'employees': 'Pracownicy',
  'trial': 'Staże',
  'documents': 'Dokumenty',
  'library': 'Biblioteka',
  'skills': 'Umiejętności',
  'tests': 'Testy',
  // Construction
  'construction': 'Budownictwo',
  'estimates': 'Kosztorysy',
  'offers': 'Oferty',
  'gantt': 'Harmonogram',
  'dms': 'DMS',
  'drawings': 'Rysunki',
  'finance': 'Finanse',
  'procurement': 'Zaopatrzenie',
  'approvals': 'Zatwierdzenia',
  'requests': 'Zapotrzebowania',
  // Sales
  'sales': 'Sprzedaż',
  'pipeline': 'Lejek',
  'contacts': 'Kontakty',
  'activities': 'Aktywności',
  'clients': 'Klienci',
  // Employee
  'employee': 'Pracownik',
  'profile': 'Profil',
  'schedule': 'Grafik',
  'career': 'Kariera',
  'salary': 'Wynagrodzenie',
  'referrals': 'Polecenia',
};

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-generate from path if no manual items
  const breadcrumbs = items || (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [{ label: 'Główna', path: '/dashboard' }];
    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;
      const label = ROUTE_LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1);
      if (label !== 'Dashboard' || crumbs.length > 1) {
        crumbs.push({ label, path: currentPath });
      }
    }
    return crumbs.length > 1 ? crumbs : [];
  })();

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav className={`flex items-center gap-1 text-sm mb-4 ${className}`} aria-label="Breadcrumb">
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
            {isLast ? (
              <span className="text-slate-600 font-medium truncate">{crumb.label}</span>
            ) : (
              <button
                onClick={() => crumb.path && navigate(crumb.path)}
                className="text-slate-400 hover:text-blue-600 transition flex items-center gap-1 flex-shrink-0"
              >
                {idx === 0 && <Home className="w-3.5 h-3.5" />}
                {crumb.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
