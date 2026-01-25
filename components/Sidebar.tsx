
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users, CheckSquare, Award, DollarSign, BookOpen, X,
  LogOut, Layers, UserPlus, Settings,
  FileText, PieChart, Clock, FileCheck, Home, User, GraduationCap, LayoutDashboard, Briefcase, FileInput, AlertTriangle, Network,
  Building2, Target, UserCheck
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Role, UserStatus } from '../types';
import { ROLE_LABELS } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { state, logout } = useAppContext();
  const { currentUser } = state;
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  
  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link 
      to={to} 
      onClick={() => setIsOpen(false)}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
        isActive(to) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
            <span className="text-lg font-bold text-slate-800">MaxMaster</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="ml-auto lg:hidden text-slate-500">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100vh-4rem)] flex flex-col">
          <div className="mb-6">
            
            {/* --- SUPERADMIN VIEW --- */}
            {currentUser?.role === Role.SUPERADMIN && (
               <>
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Super Admin</p>
                 <NavItem to="/superadmin/users" icon={Users} label="Użytkownicy" />
                 <NavItem to="/superadmin/companies" icon={Briefcase} label="Firmy" />
               </>
            )}

            {/* --- COMPANY ADMIN VIEW --- */}
            {currentUser?.role === Role.COMPANY_ADMIN && (
               <>
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Admin Firmy</p>
                 <NavItem to="/company/dashboard" icon={LayoutDashboard} label="Dashboard" />
                 <NavItem to="/company/users" icon={Users} label="Użytkownicy" />
                 <NavItem to="/company/subscription" icon={Layers} label="Subskrypcja" />
                 <NavItem to="/company/settings" icon={Settings} label="Ustawienia" />
               </>
            )}

            {/* --- SALES VIEW --- */}
            {currentUser?.role === Role.SALES && (
               <>
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Sales CRM</p>
                 <NavItem to="/sales/dashboard" icon={LayoutDashboard} label="Dashboard" />
                 <NavItem to="/sales/pipeline" icon={Target} label="Pipeline" />
                 <div className="my-2 border-t border-slate-100"></div>
                 <NavItem to="/sales/companies" icon={Building2} label="Firmy" />
                 <NavItem to="/sales/contacts" icon={UserCheck} label="Kontakty (LPR)" />
               </>
            )}

            {/* --- ADMIN VIEW (TECHNICAL / LEGACY) --- */}
            {currentUser?.role === Role.ADMIN && (
               <>
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Panel Techniczny</p>
                 <NavItem to="/admin/users" icon={Users} label="Zarządzanie Kontami" />
               </>
            )}

            {/* --- HR VIEW (OPERATIONAL) --- */}
            {currentUser?.role === Role.HR && (
               <>
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Panel HR</p>
                 <NavItem to="/hr/dashboard" icon={Layers} label="Dashboard" />
                 <div className="my-2 border-t border-slate-100"></div>
                 <NavItem to="/hr/candidates" icon={UserPlus} label="Kandydaci" />
                 <NavItem to="/hr/trial" icon={Clock} label="Okres Próbny" />
                 <NavItem to="/hr/employees" icon={Users} label="Pracownicy" />
                 <div className="my-2 border-t border-slate-100"></div>
                 <NavItem to="/hr/documents" icon={FileText} label="Dokumenty" />
                 <div className="my-2 border-t border-slate-100"></div>
                 <NavItem to="/hr/tests" icon={FileCheck} label="Testy" />
                 <NavItem to="/hr/skills" icon={Award} label="Umiejętności" />
                 <NavItem to="/hr/library" icon={BookOpen} label="Biblioteka" />
                 <div className="my-2 border-t border-slate-100"></div>
                 <NavItem to="/hr/reports" icon={PieChart} label="Raporty" />
                 <div className="my-2 border-t border-slate-100"></div>
                 <NavItem to="/hr/settings" icon={Settings} label="Ustawienia" />
               </>
            )}

            {/* --- COORDINATOR VIEW --- */}
            {currentUser?.role === Role.COORDINATOR && (
                <>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Koordynator</p>
                    <NavItem to="/coordinator/dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <NavItem to="/coordinator/employees" icon={Users} label="Pracownicy" />
                    <NavItem to="/coordinator/verifications" icon={CheckSquare} label="Weryfikacje Praktyki" />
                    <NavItem to="/coordinator/quality" icon={AlertTriangle} label="Historia Jakości" />
                    <div className="my-2 border-t border-slate-100"></div>
                    <NavItem to="/coordinator/skills" icon={Award} label="Umiejętności" />
                    <NavItem to="/coordinator/library" icon={BookOpen} label="Biblioteka" />
                    <NavItem to="/coordinator/profile" icon={User} label="Mój Profil" />
                </>
            )}

            {/* --- CANDIDATE VIEW --- */}
            {currentUser?.role === Role.CANDIDATE && (
                <>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Kandydat</p>
                    <NavItem to="/candidate/dashboard" icon={Home} label="Panel Główny" />
                    <NavItem to="/candidate/profile" icon={User} label="Mój Profil" />
                </>
            )}

            {/* --- TRIAL EMPLOYEE VIEW --- */}
            {currentUser?.status === UserStatus.TRIAL && (
                <>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Okres Próbny</p>
                    <NavItem to="/trial/dashboard" icon={Clock} label="Mój Okres Próbny" />
                    <NavItem to="/trial/skills" icon={Award} label="Umiejętności i Uprawnienia" />
                    <NavItem to="/trial/quality" icon={AlertTriangle} label="Historia Jakości" />
                    <NavItem to="/trial/library" icon={BookOpen} label="Biblioteka" />
                    <NavItem to="/trial/career" icon={Briefcase} label="Rozwój Zawodowy" />
                    <NavItem to="/trial/referrals" icon={UserPlus} label="Zaproś znajomego" />
                    <NavItem to="/trial/profile" icon={User} label="Mój Profil" />
                </>
            )}

            {/* --- FULL EMPLOYEE VIEW (POST-TRIAL) --- */}
            {((currentUser?.role === Role.EMPLOYEE || currentUser?.role === Role.BRIGADIR) && currentUser?.status !== UserStatus.TRIAL) && (
              <>
                {/* --- BRIGADIR VIEW EXTENSION --- */}
                {currentUser?.role === Role.BRIGADIR && (
                  <>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Brygadzista</p>
                    <NavItem to="/brigadir/dashboard" icon={LayoutDashboard} label="Panel Zarządzania" />
                    <NavItem to="/brigadir/checks" icon={CheckSquare} label="Weryfikacje" />
                    <NavItem to="/brigadir/quality" icon={AlertTriangle} label="Zgłoszenia Jakości" />
                    <NavItem to="/brigadir/team" icon={Users} label="Mój Zespół" />
                    <div className="my-4 border-t border-slate-100"></div>
                  </>
                )}

                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-4">Pracownik</p>

                <NavItem to="/dashboard" icon={LayoutDashboard} label="Panel Pracownika" />
                <NavItem to="/dashboard/skills" icon={Award} label="Umiejętności i Uprawnienia" />
                <NavItem to="/dashboard/quality" icon={AlertTriangle} label="Historia Jakości" />
                <NavItem to="/dashboard/library" icon={BookOpen} label="Biblioteka" />
                <NavItem to="/dashboard/career" icon={Briefcase} label="Rozwój Zawodowy" />
                <NavItem to="/dashboard/referrals" icon={UserPlus} label="Zaproś znajomego" />
                <NavItem to="/dashboard/profile" icon={User} label="Mój Profil" />
              </>
            )}
            
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100">
             <div className="px-4 py-3 bg-slate-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-slate-900">{currentUser?.first_name} {currentUser?.last_name}</p>
                <p className="text-xs text-slate-500 capitalize">
                    {currentUser?.target_position || ROLE_LABELS[currentUser?.role || Role.EMPLOYEE]}
                </p>
             </div>
            <button onClick={logout} className="flex w-full items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut size={20} />
              <span>Wyloguj się</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
