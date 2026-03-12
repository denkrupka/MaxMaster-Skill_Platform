
import React, { useState, useEffect } from 'react';
import { Menu, Search } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { Sidebar } from './Sidebar';
import { NotificationBell, Toast } from './NotificationSystem';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAppContext } from '../context/AppContext';
import { OnboardingWizard } from './OnboardingWizard';
import { Role } from '../types';
import { ROLE_LABELS } from '../constants';

export const AppLayout = ({ children }: { children?: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { state, getEffectiveRole } = useAppContext();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding wizard for company_admin if onboarding not completed
  useEffect(() => {
    if (
      state.currentUser?.role === 'company_admin' &&
      state.currentCompany &&
      state.currentCompany.onboarding_completed === false
    ) {
      setShowOnboarding(true);
    }
  }, [state.currentUser?.role, state.currentCompany?.onboarding_completed, state.currentCompany?.id]);

  // Listen for external collapse/expand requests (e.g. from workspace views)
  useEffect(() => {
    const handleCollapse = () => setIsSidebarCollapsed(true);
    const handleExpand = () => setIsSidebarCollapsed(false);
    window.addEventListener('sidebar-collapse', handleCollapse);
    window.addEventListener('sidebar-expand', handleExpand);
    return () => {
      window.removeEventListener('sidebar-collapse', handleCollapse);
      window.removeEventListener('sidebar-expand', handleExpand);
    };
  }, []);
  // Global search hotkey Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const effectiveRole = getEffectiveRole();
  const isSimulating = state.simulatedRole !== null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} collapsed={isSidebarCollapsed} setCollapsed={setIsSidebarCollapsed} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>

        {/* Header - now used for both Mobile (Menu) and Desktop (Notifications) */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6">
           <div className="flex items-center">
                <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 lg:hidden mr-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Menu size={24} />
                </button>
                <span className="font-bold text-slate-800 lg:hidden">MaxMaster</span>
           </div>

           {/* Right side of header (Bell + Profile hint) */}
           <div className="flex items-center gap-4 ml-auto">
                {/* Global Search Button */}
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Szukaj (Ctrl+K)"
                >
                  <Search size={16} />
                  <span className="hidden sm:inline">Szukaj...</span>
                  <kbd className="hidden lg:inline-block text-xs bg-white border border-slate-200 rounded px-1 font-mono">Ctrl+K</kbd>
                </button>
                <LanguageSwitcher />
                {(effectiveRole === Role.HR || effectiveRole === Role.DORADCA || effectiveRole === Role.COMPANY_ADMIN) && (
                    <NotificationBell />
                )}
                {/* Desktop Profile Hint (Optional, kept minimal) */}
                <div className="hidden lg:flex items-center gap-3 border-l border-slate-200 pl-6 h-8">
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-800 leading-none">{state.currentUser?.first_name} {state.currentUser?.last_name}</p>
                        <p className={`text-[10px] uppercase font-semibold ${isSimulating ? 'text-amber-600' : 'text-slate-500'}`}>
                            {isSimulating
                              ? ROLE_LABELS[state.simulatedRole!]
                              : (state.currentUser?.target_position || ROLE_LABELS[state.currentUser?.role || Role.EMPLOYEE])
                            }
                        </p>
                    </div>
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                        {state.currentUser?.first_name?.[0]}
                    </div>
                </div>
           </div>
        </header>

        <main className="flex-1 overflow-auto relative">
          {children}
        </main>
      </div>

      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <Toast />
      {showOnboarding && (
        <OnboardingWizard onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
};
