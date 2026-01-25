
import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { NotificationBell, Toast } from './NotificationSystem';
import { useAppContext } from '../context/AppContext';
import { Role } from '../types';
import { ROLE_LABELS } from '../constants';

export const AppLayout = ({ children }: { children?: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { state } = useAppContext();
  
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        
        {/* Header - now used for both Mobile (Menu) and Desktop (Notifications) */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6">
           <div className="flex items-center">
                <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 lg:hidden mr-4">
                    <Menu size={24} />
                </button>
                <span className="font-bold text-slate-800 lg:hidden">MaxMaster</span>
           </div>
           
           {/* Right side of header (Bell + Profile hint) */}
           <div className="flex items-center gap-4 ml-auto">
                {(state.currentUser?.role === Role.HR || state.currentUser?.role === Role.DORADCA) && (
                    <NotificationBell />
                )}
                {/* Desktop Profile Hint (Optional, kept minimal) */}
                <div className="hidden lg:flex items-center gap-3 border-l border-slate-200 pl-6 h-8">
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-800 leading-none">{state.currentUser?.first_name} {state.currentUser?.last_name}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">
                            {state.currentUser?.target_position || ROLE_LABELS[state.currentUser?.role || Role.EMPLOYEE]}
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

      <Toast />
    </div>
  );
};
