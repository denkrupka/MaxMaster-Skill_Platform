
import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Settings, Briefcase, Users, Shield, ExternalLink, Clock, Network } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/Button';
import { Role, UserStatus } from '../types';

export const LoginPage = () => {
  const { login, loginAsUser, state } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.currentUser) {
      if (state.currentUser.role === Role.ADMIN) {
        navigate('/admin/users');
      } else if (state.currentUser.role === Role.HR) {
        navigate('/hr/dashboard');
      } else if (state.currentUser.role === Role.CANDIDATE) {
        navigate('/candidate/dashboard');
      } else if (state.currentUser.role === Role.COORDINATOR) {
        navigate('/coordinator/dashboard');
      } else if (state.currentUser.status === UserStatus.TRIAL) {
        navigate('/trial/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [state.currentUser, navigate]);

  const handleTrialLogin = () => {
      // Find the trial user from constants or use the specific ID 'u1_trial'
      const trialUser = state.users.find(u => u.id === 'u1_trial');
      if (trialUser) {
          loginAsUser(trialUser);
      } else {
          alert("Brak użytkownika testowego (u1_trial).");
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">M</div>
          <h1 className="text-2xl font-bold text-slate-900">MaxMaster Skills</h1>
          <p className="text-slate-500 mt-2">Wybierz rolę do wersji demonstracyjnej</p>
        </div>

        <div className="space-y-3">
          <Button fullWidth onClick={() => login(Role.ADMIN)} className="justify-start pl-6 bg-slate-800 hover:bg-slate-900">
             <Settings className="mr-3" size={18} /> Admin (Techniczny)
          </Button>
          <Button fullWidth onClick={() => login(Role.HR)} className="justify-start pl-6 bg-purple-600 hover:bg-purple-700">
             <Briefcase className="mr-3" size={18} /> HR Manager
          </Button>
          <div className="h-px bg-slate-200 my-4"></div>
          <Button fullWidth onClick={() => login(Role.COORDINATOR)} className="justify-start pl-6 bg-orange-600 hover:bg-orange-700">
             <Network className="mr-3" size={18} /> Koordynator Robót
          </Button>
          <Button fullWidth onClick={() => login(Role.EMPLOYEE)} className="justify-start pl-6">
            <Users className="mr-3" size={18} /> Pracownik (Jan)
          </Button>
          
          <Button fullWidth onClick={handleTrialLogin} className="justify-start pl-6 bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-200">
            <Clock className="mr-3" size={18} /> Panel: Okres Próbny (Adam)
          </Button>

          <Button fullWidth variant="outline" onClick={() => login(Role.BRIGADIR)} className="justify-start pl-6">
            <Shield className="mr-3" size={18} /> Brygadzista (Tomasz)
          </Button>
          <Button fullWidth variant="ghost" onClick={() => login(Role.CANDIDATE)} className="justify-start pl-6">
            <Users className="mr-3" size={18} /> Kandydat
          </Button>
          
          {/* Temporary Link for testing the Welcome Page */}
          <div className="pt-2 text-center">
              <Link to="/candidate/welcome" className="inline-flex items-center text-xs text-blue-500 hover:text-blue-700 hover:underline">
                  <ExternalLink size={12} className="mr-1"/> Strona Powitalna (Landing)
              </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
