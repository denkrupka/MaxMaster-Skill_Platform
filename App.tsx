
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

import { AppProvider, useAppContext } from './context/AppContext';
import { Role, UserStatus } from './types';
import { AppLayout } from './components/AppLayout';

// Pages
import { LoginPage } from './pages/Login';
import { SetupPasswordPage } from './pages/SetupPassword';
import { ForgotPasswordPage } from './pages/ForgotPassword';
import { ResetPasswordPage } from './pages/ResetPassword';
import { TerminatedPage } from './pages/Terminated';
import { AdminUsersPage } from './pages/admin/Users';
import { HRDashboard } from './pages/hr/Dashboard';
import { HRCandidatesPage } from './pages/hr/Candidates';
import { HREmployeesPage } from './pages/hr/Employees';
import { HRTrialPage } from './pages/hr/Trial';
import { HRDocumentsPage } from './pages/hr/Documents';
import { HRReportsPage } from './pages/hr/Reports';
import { HRLibraryPage } from './pages/hr/Library';
import { HRSkillsPage } from './pages/hr/Skills';
import { HRTestsPage } from './pages/hr/Tests';
import { HRSettingsPage } from './pages/hr/Settings';

// Coordinator Pages
import { CoordinatorDashboard } from './pages/coordinator/Dashboard';
import { 
    CoordinatorEmployees, 
    CoordinatorVerifications, 
    CoordinatorQuality, 
    CoordinatorSkills, 
    CoordinatorLibrary, 
    CoordinatorProfile 
} from './pages/coordinator/CoordinatorPages';

// Brigadir Pages
import { BrigadirChecksPage } from './pages/brigadir/ChecksPage';
import { BrigadirTeamPage } from './pages/brigadir/TeamPage';
import { BrigadirQualityPage } from './pages/brigadir/QualityPage';
import { BrigadirDashboard } from './pages/brigadir/Dashboard';

// Employee Pages (Post-Trial)
import { EmployeeDashboard } from './pages/employee/Dashboard';
import { EmployeeSkills } from './pages/employee/Skills';
import { EmployeeTests } from './pages/employee/Tests';
import { EmployeePractice } from './pages/employee/Practice';
import { EmployeeLibrary } from './pages/employee/Library';
import { EmployeeCareer } from './pages/employee/Career';
import { EmployeeProfile } from './pages/employee/Profile';
import { EmployeeSalaryPage } from './pages/employee/Salary'; 
import { EmployeeQualityHistory } from './pages/employee/QualityHistory';
import { EmployeeReferrals } from './pages/employee/Referrals';

// Trial & Candidate Pages
import { TrialDashboard } from './pages/trial/Dashboard';
import { TrialProfilePage } from './pages/trial/Profile';
import { CandidateDashboard } from './pages/candidate/Dashboard';
import { CandidateTestsPage } from './pages/candidate/Tests';
import { CandidateProfilePage } from './pages/candidate/Profile';
import { CandidateWelcomePage } from './pages/candidate/Welcome';
import { CandidateRegisterPage } from './pages/candidate/Register';
import { CandidateSimulationPage } from './pages/candidate/Simulation';
import { CandidateThankYouPage } from './pages/candidate/ThankYou';

const ProtectedRoute = ({ children, allowedRoles, checkTrial = false }: { children?: React.ReactNode, allowedRoles?: Role[], checkTrial?: boolean }) => {
  const { state } = useAppContext();
  
  if (!state.currentUser) {
    return <Navigate to="/login" replace />;
  }

  // BLOCK TERMINATED USERS
  if (state.currentUser.status === UserStatus.INACTIVE) {
      return <Navigate to="/terminated" replace />;
  }

  // Trial User Logic - redirect to /trial/* routes
  if (state.currentUser.status === UserStatus.TRIAL) {
      if (checkTrial && window.location.hash.includes('/dashboard') && !window.location.hash.includes('/trial')) {
          return <Navigate to="/trial/dashboard" replace />;
      }
  } else if (window.location.hash.includes('/trial/dashboard')) {
      return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(state.currentUser.role)) {
    if (state.currentUser.role === Role.CANDIDATE) {
        return <Navigate to="/candidate/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

// Component to handle email confirmation redirects
const EmailConfirmationHandler = () => {
  const [shouldRedirect, setShouldRedirect] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleRedirect = () => {
      // Check both URL hash and query params for auth tokens
      const fullHash = window.location.hash;
      const queryParams = new URLSearchParams(window.location.search);

      let authParamsString = '';
      let params = null;

      // First check hash (format: #access_token=...&type=... OR #error=...)
      const hashParts = fullHash.split('#');
      authParamsString = hashParts.find(p => p.includes('access_token=') || p.includes('type=') || p.includes('error=')) || '';

      if (authParamsString) {
        params = new URLSearchParams(authParamsString);
      } else if (queryParams.has('access_token') || queryParams.has('type') || queryParams.has('error')) {
        // Check query params (format: ?access_token=...&type=... OR ?error=...)
        params = queryParams;
        authParamsString = queryParams.toString();
      }

      if (params) {
        // Check for errors first
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');
        const error = params.get('error');

        if (error || errorCode) {
          // Handle expired or invalid links
          if (errorCode === 'otp_expired') {
            setError('Link aktywacyjny wygasł lub został już wykorzystany. Skontaktuj się z działem HR aby otrzymać nowy link.');
          } else {
            setError(errorDescription || 'Wystąpił błąd podczas weryfikacji linku. Skontaktuj się z działem HR.');
          }
          setShouldRedirect(true);
          return;
        }

        const type = params.get('type');
        const accessToken = params.get('access_token');

        // If it's an email confirmation or signup, redirect to setup-password
        if (accessToken && (type === 'signup' || type === 'email_confirmation' || type === 'invite')) {
          // Redirect to setup-password with tokens preserved in hash
          window.location.hash = `/setup-password#${authParamsString}`;
          return; // Don't set shouldRedirect, we're handling navigation
        }
      }

      // No auth tokens found, redirect to login
      setShouldRedirect(true);
    };

    handleRedirect();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-100">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Link wygasł</h2>
            <p className="text-slate-600">{error}</p>
          </div>
          <button
            onClick={() => window.location.hash = '/login'}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
          >
            Przejdź do logowania
          </button>
        </div>
      </div>
    );
  }

  return shouldRedirect ? <Navigate to="/login" replace /> : null;
};

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup-password" element={<SetupPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terminated" element={<TerminatedPage />} />
          <Route path="/candidate/welcome" element={<CandidateWelcomePage />} />
          <Route path="/candidate/register" element={<CandidateRegisterPage />} />
          
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={[Role.ADMIN]}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/hr/dashboard" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRDashboard /></ProtectedRoute>} />
          <Route path="/hr/candidates" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRCandidatesPage /></ProtectedRoute>} />
          <Route path="/hr/employees" element={<ProtectedRoute allowedRoles={[Role.HR]}><HREmployeesPage /></ProtectedRoute>} />
          <Route path="/hr/trial" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRTrialPage /></ProtectedRoute>} />
          <Route path="/hr/documents" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRDocumentsPage /></ProtectedRoute>} />
          <Route path="/hr/reports" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRReportsPage /></ProtectedRoute>} />
          <Route path="/hr/library" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRLibraryPage /></ProtectedRoute>} />
          <Route path="/hr/skills" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRSkillsPage /></ProtectedRoute>} />
          <Route path="/hr/tests" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRTestsPage /></ProtectedRoute>} />
          <Route path="/hr/settings" element={<ProtectedRoute allowedRoles={[Role.HR]}><HRSettingsPage /></ProtectedRoute>} />

          <Route path="/coordinator/dashboard" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/coordinator/employees" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorEmployees /></ProtectedRoute>} />
          <Route path="/coordinator/verifications" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorVerifications /></ProtectedRoute>} />
          <Route path="/coordinator/quality" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorQuality /></ProtectedRoute>} />
          <Route path="/coordinator/skills" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorSkills /></ProtectedRoute>} />
          <Route path="/coordinator/library" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorLibrary /></ProtectedRoute>} />
          <Route path="/coordinator/profile" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorProfile /></ProtectedRoute>} />

          <Route path="/candidate/dashboard" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateDashboard /></ProtectedRoute>} />
          <Route path="/candidate/simulation" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateSimulationPage /></ProtectedRoute>} />
          <Route path="/candidate/tests" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateTestsPage /></ProtectedRoute>} />
          <Route path="/candidate/thank-you" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateThankYouPage /></ProtectedRoute>} />
          <Route path="/candidate/profile" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateProfilePage /></ProtectedRoute>} />

          {/* Trial Employee Routes - Old URLs with full functionality */}
          <Route path="/trial/dashboard" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><TrialDashboard /></ProtectedRoute>} />
          <Route path="/trial/skills" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeSkills /></ProtectedRoute>} />
          <Route path="/trial/quality" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeQualityHistory /></ProtectedRoute>} />
          <Route path="/trial/library" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeLibrary /></ProtectedRoute>} />
          <Route path="/trial/career" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeCareer /></ProtectedRoute>} />
          <Route path="/trial/referrals" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeReferrals /></ProtectedRoute>} />
          <Route path="/trial/profile" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><TrialProfilePage /></ProtectedRoute>} />
          <Route path="/trial/tests" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeTests /></ProtectedRoute>} />
          <Route path="/trial/practice" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeePractice /></ProtectedRoute>} />

          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/skills" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeSkills /></ProtectedRoute>} />
          <Route path="/dashboard/tests" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeTests /></ProtectedRoute>} />
          <Route path="/dashboard/practice" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeePractice /></ProtectedRoute>} />
          <Route path="/dashboard/quality" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeQualityHistory /></ProtectedRoute>} />
          <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeReferrals /></ProtectedRoute>} />
          <Route path="/dashboard/library" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeLibrary /></ProtectedRoute>} />
          <Route path="/dashboard/career" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeCareer /></ProtectedRoute>} />
          <Route path="/dashboard/profile" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/dashboard/run-test" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR, Role.COORDINATOR]} ><CandidateTestsPage /></ProtectedRoute>} />
          <Route path="/dashboard/salary" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} ><EmployeeSalaryPage /></ProtectedRoute>} />

          <Route path="/brigadir/dashboard" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]} ><BrigadirDashboard /></ProtectedRoute>} />
          <Route path="/brigadir/checks" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]} ><BrigadirChecksPage /></ProtectedRoute>} />
          <Route path="/brigadir/team" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]} ><BrigadirTeamPage /></ProtectedRoute>} />
          <Route path="/brigadir/quality" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]} ><BrigadirQualityPage /></ProtectedRoute>} />

          <Route path="/" element={<EmailConfirmationHandler />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppProvider>
    </HashRouter>
  );
}
