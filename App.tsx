
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
import { SubscriptionExpiredAdminPage } from './pages/SubscriptionExpiredAdmin';
import { SubscriptionExpiredUserPage } from './pages/SubscriptionExpiredUser';
import { ModuleAccessDeniedPage } from './pages/ModuleAccessDenied';
import { AdminUsersPage } from './pages/admin/Users';

// SuperAdmin Pages
import { SuperAdminUsersPage } from './pages/superadmin/Users';
import { SuperAdminCompaniesPage } from './pages/superadmin/Companies';
import { SuperAdminSettingsPage } from './pages/superadmin/Settings';
import { SuperAdminDashboard } from './pages/superadmin/Dashboard';
import { SuperAdminClients } from './pages/superadmin/Clients';

// Company Admin Pages
import { CompanyDashboard } from './pages/company/Dashboard';
import { CompanyUsersPage } from './pages/company/Users';
import { CompanySubscriptionPage } from './pages/company/Subscription';
import { CompanySettingsPage } from './pages/company/Settings';
import { CompanyReferralsPage } from './pages/company/Referrals';

// Sales Pages
import { SalesDashboard } from './pages/sales/Dashboard';
import { SalesPipeline } from './pages/sales/Pipeline';
import { SalesCompanies } from './pages/sales/Companies';
import { SalesContacts } from './pages/sales/Contacts';
import { SalesActivities } from './pages/sales/Activities';
import { SalesClients } from './pages/sales/Clients';

// Doradca (Consultant) Pages
import { DoradcaDashboard } from './pages/doradca/Dashboard';
import { DoradcaCompanyView } from './pages/doradca/CompanyView';
import { DoradcaCompanies } from './pages/doradca/Companies';
import { DoradcaLibrary } from './pages/doradca/Library';

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

const ProtectedRoute = ({ children, allowedRoles, checkTrial = false, noLayout = false, requiredModule }: { children?: React.ReactNode, allowedRoles?: Role[], checkTrial?: boolean, noLayout?: boolean, requiredModule?: 'recruitment' | 'skills' }) => {
  const { state, getEffectiveRole } = useAppContext();

  if (!state.currentUser) {
    return <Navigate to="/login" replace />;
  }

  // BLOCK TERMINATED USERS
  if (state.currentUser.status === UserStatus.INACTIVE) {
      return <Navigate to="/terminated" replace />;
  }

  // SUBSCRIPTION CHECK for company users (non-global users)
  // Logic (same as super admin panel):
  // - BRAK: no active subscription and no demo → show expired pages
  // - DEMO: has demo modules but no paid subscriptions → allow access
  // - AKTYWNA: has active paid subscription → allow access
  const isGlobalUser = state.currentUser.is_global_user === true;
  const currentPath = window.location.hash.replace('#', '');

  if (!isGlobalUser && state.currentUser.company_id) {
    // Check if company has any active modules
    const companyModules = state.companyModules.filter(cm =>
      cm.company_id === state.currentUser?.company_id && cm.is_active
    );

    // Check for paid subscription (has stripe_subscription_id)
    const hasPaidSubscription = companyModules.some(cm => cm.stripe_subscription_id);

    // Check for demo modules (active but no stripe_subscription_id)
    const hasDemoModules = companyModules.some(cm => !cm.stripe_subscription_id);

    // Subscription status: BRAK if no paid subscription AND no demo
    const isSubscriptionBrak = !hasPaidSubscription && !hasDemoModules;

    // If subscription status is BRAK (no active modules at all)
    if (isSubscriptionBrak) {
      if (state.currentUser.role === Role.COMPANY_ADMIN) {
        // Company admin can access subscription, referrals, and settings pages
        if (!currentPath.includes('/company/subscription') &&
            !currentPath.includes('/company/referrals') &&
            !currentPath.includes('/company/settings') &&
            !currentPath.includes('/subscription-expired-admin')) {
          return <Navigate to="/subscription-expired-admin" replace />;
        }
      } else {
        // Other company users get blocked completely
        if (!currentPath.includes('/subscription-expired-user')) {
          return <Navigate to="/subscription-expired-user" replace />;
        }
      }
    }

    // Module-specific access check for candidates and employees
    if (state.currentUser.role === Role.CANDIDATE || state.currentUser.role === Role.TRIAL) {
      // Check if recruitment module has available seats
      const recruitmentModule = companyModules.find(cm => cm.module_code === 'recruitment');
      if (!recruitmentModule || recruitmentModule.max_users <= 0) {
        // Check if user has access to skills module instead
        const skillsModule = companyModules.find(cm => cm.module_code === 'skills');
        const userHasSkillsAccess = state.moduleUserAccess.some(
          mua => mua.user_id === state.currentUser?.id && mua.module_code === 'skills' && mua.is_enabled
        );

        if (!skillsModule || !userHasSkillsAccess) {
          // No recruitment module and no skills access - show expired page
          if (!currentPath.includes('/subscription-expired-user')) {
            return <Navigate to="/subscription-expired-user" replace />;
          }
        }
      }
    }

    // MODULE ACCESS CHECK for company users
    // Company admins and superadmins simulating roles bypass module access check
    const isSimulatingRole = state.simulatedRole !== null &&
      (state.currentUser?.role === Role.COMPANY_ADMIN || state.currentUser?.role === Role.SUPERADMIN);
    if (requiredModule && !currentPath.includes('/module-access-denied') && !isSimulatingRole) {
      // Get user's module access for the required module
      const userHasModuleAccess = state.moduleUserAccess.some(
        mua => mua.user_id === state.currentUser?.id &&
               mua.module_code === requiredModule &&
               mua.is_enabled
      );

      // HR role always needs to check module access for protected routes
      // Other roles (employee, brigadir, coordinator) also need access
      if (!userHasModuleAccess) {
        // Check if the company has the module at all
        const companyHasModule = companyModules.some(cm => cm.module_code === requiredModule);

        if (!companyHasModule || !userHasModuleAccess) {
          return <Navigate to={`/module-access-denied?module=${requiredModule}`} replace />;
        }
      }
    }
  }

  // Trial User Logic - redirect to /trial/* routes
  if (state.currentUser.status === UserStatus.TRIAL) {
      if (checkTrial && window.location.hash.includes('/dashboard') && !window.location.hash.includes('/trial')) {
          return <Navigate to="/trial/dashboard" replace />;
      }
  } else if (window.location.hash.includes('/trial/dashboard')) {
      return <Navigate to="/dashboard" replace />;
  }

  const effectiveRole = getEffectiveRole() || state.currentUser.role;
  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    // Redirect based on actual (not simulated) role
    if (state.currentUser.role === Role.SUPERADMIN) {
        return <Navigate to="/superadmin/dashboard" replace />;
    }
    if (state.currentUser.role === Role.SALES) {
        return <Navigate to="/sales/dashboard" replace />;
    }
    if (state.currentUser.role === Role.DORADCA) {
        return <Navigate to="/doradca/dashboard" replace />;
    }
    if (state.currentUser.role === Role.CANDIDATE) {
        return <Navigate to="/candidate/dashboard" replace />;
    }
    if (state.currentUser.role === Role.HR) {
        return <Navigate to="/hr/dashboard" replace />;
    }
    if (state.currentUser.role === Role.ADMIN) {
        return <Navigate to="/admin/users" replace />;
    }
    if (state.currentUser.role === Role.COMPANY_ADMIN) {
        return <Navigate to="/company/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Skip AppLayout wrapper for certain pages (like full-screen test interfaces)
  if (noLayout) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
};

// Component to handle email confirmation redirects
const EmailConfirmationHandler = () => {
  const [redirecting, setRedirecting] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleRedirect = () => {
      console.log('[EmailConfirmationHandler] Starting redirect handling');
      console.log('[EmailConfirmationHandler] Current URL:', window.location.href);
      console.log('[EmailConfirmationHandler] Hash:', window.location.hash);
      console.log('[EmailConfirmationHandler] Search:', window.location.search);

      // Check both URL hash and query params for auth tokens
      const fullHash = window.location.hash;
      const queryParams = new URLSearchParams(window.location.search);

      let authParamsString = '';
      let params = null;

      // First check hash (format: #access_token=...&type=... OR #error=...)
      // When Supabase redirects, the URL looks like: domain.com/#access_token=...
      // So fullHash = "#access_token=..."
      // We need to remove the leading # and parse the rest
      if (fullHash && fullHash.length > 1) {
        const hashWithoutLeadingPound = fullHash.substring(1); // Remove leading #
        console.log('[EmailConfirmationHandler] Hash params:', hashWithoutLeadingPound);

        if (hashWithoutLeadingPound.includes('access_token=') ||
            hashWithoutLeadingPound.includes('type=') ||
            hashWithoutLeadingPound.includes('error=')) {
          authParamsString = hashWithoutLeadingPound;
          params = new URLSearchParams(authParamsString);
        }
      }

      // Fallback: check query params
      if (!params && (queryParams.has('access_token') || queryParams.has('type') || queryParams.has('error'))) {
        console.log('[EmailConfirmationHandler] Found params in query string');
        params = queryParams;
        authParamsString = queryParams.toString();
      }

      if (params) {
        console.log('[EmailConfirmationHandler] Parsed params:', Object.fromEntries(params.entries()));

        // Check for errors first
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');
        const error = params.get('error');

        if (error || errorCode) {
          console.log('[EmailConfirmationHandler] Error detected:', { error, errorCode, errorDescription });
          // Handle expired or invalid links
          if (errorCode === 'otp_expired') {
            setError('Link aktywacyjny wygasł lub został już wykorzystany. Skontaktuj się z działem HR aby otrzymać nowy link.');
          } else {
            setError(errorDescription || 'Wystąpił błąd podczas weryfikacji linku. Skontaktuj się z działem HR.');
          }
          setRedirecting(false);
          return;
        }

        const type = params.get('type');
        const accessToken = params.get('access_token');

        console.log('[EmailConfirmationHandler] Type:', type, 'AccessToken present:', !!accessToken);

        // If we have access token, redirect based on type
        if (accessToken) {
          let targetRoute = '/setup-password'; // default for invite/signup

          if (type === 'recovery') {
            targetRoute = '/reset-password';
            console.log('[EmailConfirmationHandler] Redirecting to reset-password with params');
          } else if (type === 'signup' || type === 'email_confirmation' || type === 'invite') {
            targetRoute = '/setup-password';
            console.log('[EmailConfirmationHandler] Redirecting to setup-password with params');
          }

          // Redirect with tokens preserved in hash
          const newHash = `${targetRoute}#${authParamsString}`;
          console.log('[EmailConfirmationHandler] New hash:', newHash);
          window.location.hash = newHash;
          // Don't set redirecting to false, let the navigation happen
          return;
        }
      }

      // No auth tokens found, redirect to login
      console.log('[EmailConfirmationHandler] No valid auth tokens found, redirecting to login');
      setRedirecting(false);
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

  // Show loading while processing redirect
  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Przetwarzanie linku aktywacyjnego...</p>
        </div>
      </div>
    );
  }

  return <Navigate to="/login" replace />;
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
          <Route path="/subscription-expired-admin" element={<SubscriptionExpiredAdminPage />} />
          <Route path="/subscription-expired-user" element={<SubscriptionExpiredUserPage />} />
          <Route path="/module-access-denied" element={<ModuleAccessDeniedPage />} />
          <Route path="/candidate/welcome" element={<CandidateWelcomePage />} />
          <Route path="/candidate/register" element={<CandidateRegisterPage />} />
          
          {/* SuperAdmin Routes */}
          <Route path="/superadmin/dashboard" element={<ProtectedRoute allowedRoles={[Role.SUPERADMIN]}><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/superadmin/users" element={<ProtectedRoute allowedRoles={[Role.SUPERADMIN]}><SuperAdminUsersPage /></ProtectedRoute>} />
          <Route path="/superadmin/companies" element={<ProtectedRoute allowedRoles={[Role.SUPERADMIN]}><SuperAdminCompaniesPage /></ProtectedRoute>} />
          <Route path="/superadmin/clients" element={<ProtectedRoute allowedRoles={[Role.SUPERADMIN]}><SuperAdminClients /></ProtectedRoute>} />
          <Route path="/superadmin/skills" element={<ProtectedRoute allowedRoles={[Role.SUPERADMIN]}><HRSkillsPage /></ProtectedRoute>} />
          <Route path="/superadmin/library" element={<ProtectedRoute allowedRoles={[Role.SUPERADMIN]}><HRLibraryPage /></ProtectedRoute>} />
          <Route path="/superadmin/settings" element={<ProtectedRoute allowedRoles={[Role.SUPERADMIN]}><SuperAdminSettingsPage /></ProtectedRoute>} />

          {/* Company Admin Routes */}
          <Route path="/company/dashboard" element={<ProtectedRoute allowedRoles={[Role.COMPANY_ADMIN]}><CompanyDashboard /></ProtectedRoute>} />
          <Route path="/company/users" element={<ProtectedRoute allowedRoles={[Role.COMPANY_ADMIN]}><CompanyUsersPage /></ProtectedRoute>} />
          <Route path="/company/subscription" element={<ProtectedRoute allowedRoles={[Role.COMPANY_ADMIN]}><CompanySubscriptionPage /></ProtectedRoute>} />
          <Route path="/company/referrals" element={<ProtectedRoute allowedRoles={[Role.COMPANY_ADMIN]}><CompanyReferralsPage /></ProtectedRoute>} />
          <Route path="/company/settings" element={<ProtectedRoute allowedRoles={[Role.COMPANY_ADMIN]}><CompanySettingsPage /></ProtectedRoute>} />

          {/* Sales CRM Routes - also accessible by SuperAdmin in simulation mode */}
          <Route path="/sales/dashboard" element={<ProtectedRoute allowedRoles={[Role.SALES, Role.SUPERADMIN]}><SalesDashboard /></ProtectedRoute>} />
          <Route path="/sales/pipeline" element={<ProtectedRoute allowedRoles={[Role.SALES, Role.SUPERADMIN]}><SalesPipeline /></ProtectedRoute>} />
          <Route path="/sales/clients" element={<ProtectedRoute allowedRoles={[Role.SALES, Role.SUPERADMIN]}><SalesClients /></ProtectedRoute>} />
          <Route path="/sales/companies" element={<ProtectedRoute allowedRoles={[Role.SALES, Role.SUPERADMIN]}><SalesCompanies /></ProtectedRoute>} />
          <Route path="/sales/contacts" element={<ProtectedRoute allowedRoles={[Role.SALES, Role.SUPERADMIN]}><SalesContacts /></ProtectedRoute>} />
          <Route path="/sales/activities" element={<ProtectedRoute allowedRoles={[Role.SALES, Role.SUPERADMIN]}><SalesActivities /></ProtectedRoute>} />

          {/* Doradca (Consultant) Routes - also accessible by SuperAdmin in simulation mode */}
          <Route path="/doradca/dashboard" element={<ProtectedRoute allowedRoles={[Role.DORADCA, Role.SUPERADMIN]}><DoradcaDashboard /></ProtectedRoute>} />
          <Route path="/doradca/companies" element={<ProtectedRoute allowedRoles={[Role.DORADCA, Role.SUPERADMIN]}><DoradcaCompanies /></ProtectedRoute>} />
          <Route path="/doradca/company/:companyId" element={<ProtectedRoute allowedRoles={[Role.DORADCA, Role.SUPERADMIN]}><DoradcaCompanyView /></ProtectedRoute>} />
          <Route path="/doradca/library" element={<ProtectedRoute allowedRoles={[Role.DORADCA, Role.SUPERADMIN]}><DoradcaLibrary /></ProtectedRoute>} />

          {/* Legacy Admin Route */}
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.SUPERADMIN]}><AdminUsersPage /></ProtectedRoute>} />
          {/* HR Routes - also accessible by SuperAdmin in simulation mode */}
          <Route path="/hr/dashboard" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]}><HRDashboard /></ProtectedRoute>} />
          <Route path="/hr/candidates" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]} requiredModule="recruitment"><HRCandidatesPage /></ProtectedRoute>} />
          <Route path="/hr/employees" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]}><HREmployeesPage /></ProtectedRoute>} />
          <Route path="/hr/trial" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]} requiredModule="recruitment"><HRTrialPage /></ProtectedRoute>} />
          <Route path="/hr/documents" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]}><HRDocumentsPage /></ProtectedRoute>} />
          <Route path="/hr/reports" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]}><HRReportsPage /></ProtectedRoute>} />
          <Route path="/hr/library" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]} requiredModule="skills"><HRLibraryPage /></ProtectedRoute>} />
          <Route path="/hr/skills" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]} requiredModule="skills"><HRSkillsPage /></ProtectedRoute>} />
          <Route path="/hr/tests" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]} requiredModule="skills"><HRTestsPage /></ProtectedRoute>} />
          <Route path="/hr/settings" element={<ProtectedRoute allowedRoles={[Role.HR, Role.SUPERADMIN]}><HRSettingsPage /></ProtectedRoute>} />

          <Route path="/coordinator/dashboard" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/coordinator/employees" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorEmployees /></ProtectedRoute>} />
          <Route path="/coordinator/verifications" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]} requiredModule="skills"><CoordinatorVerifications /></ProtectedRoute>} />
          <Route path="/coordinator/quality" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]} requiredModule="skills"><CoordinatorQuality /></ProtectedRoute>} />
          <Route path="/coordinator/skills" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]} requiredModule="skills"><CoordinatorSkills /></ProtectedRoute>} />
          <Route path="/coordinator/library" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]} requiredModule="skills"><CoordinatorLibrary /></ProtectedRoute>} />
          <Route path="/coordinator/profile" element={<ProtectedRoute allowedRoles={[Role.COORDINATOR]}><CoordinatorProfile /></ProtectedRoute>} />

          <Route path="/candidate/dashboard" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateDashboard /></ProtectedRoute>} />
          <Route path="/candidate/simulation" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateSimulationPage /></ProtectedRoute>} />
          <Route path="/candidate/tests" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]} noLayout={true}><CandidateTestsPage /></ProtectedRoute>} />
          <Route path="/candidate/thank-you" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateThankYouPage /></ProtectedRoute>} />
          <Route path="/candidate/profile" element={<ProtectedRoute allowedRoles={[Role.CANDIDATE]}><CandidateProfilePage /></ProtectedRoute>} />

          {/* Trial Employee Routes - Old URLs with full functionality */}
          <Route path="/trial/dashboard" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><TrialDashboard /></ProtectedRoute>} />
          <Route path="/trial/skills" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true} requiredModule="skills"><EmployeeSkills /></ProtectedRoute>} />
          <Route path="/trial/quality" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true} requiredModule="skills"><EmployeeQualityHistory /></ProtectedRoute>} />
          <Route path="/trial/library" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true} requiredModule="skills"><EmployeeLibrary /></ProtectedRoute>} />
          <Route path="/trial/career" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeCareer /></ProtectedRoute>} />
          <Route path="/trial/referrals" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><EmployeeReferrals /></ProtectedRoute>} />
          <Route path="/trial/profile" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true}><TrialProfilePage /></ProtectedRoute>} />
          <Route path="/trial/tests" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true} requiredModule="skills"><EmployeeTests /></ProtectedRoute>} />
          <Route path="/trial/practice" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE]} checkTrial={true} requiredModule="skills"><EmployeePractice /></ProtectedRoute>} />

          <Route path="/dashboard" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]}><EmployeeDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/skills" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} requiredModule="skills"><EmployeeSkills /></ProtectedRoute>} />
          <Route path="/dashboard/tests" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} requiredModule="skills"><EmployeeTests /></ProtectedRoute>} />
          <Route path="/dashboard/practice" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} requiredModule="skills"><EmployeePractice /></ProtectedRoute>} />
          <Route path="/dashboard/quality" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} requiredModule="skills"><EmployeeQualityHistory /></ProtectedRoute>} />
          <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]}><EmployeeReferrals /></ProtectedRoute>} />
          <Route path="/dashboard/library" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]} requiredModule="skills"><EmployeeLibrary /></ProtectedRoute>} />
          <Route path="/dashboard/career" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]}><EmployeeCareer /></ProtectedRoute>} />
          <Route path="/dashboard/profile" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]}><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/dashboard/run-test" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR, Role.COORDINATOR]} noLayout={true} requiredModule="skills"><CandidateTestsPage /></ProtectedRoute>} />
          <Route path="/dashboard/salary" element={<ProtectedRoute allowedRoles={[Role.EMPLOYEE, Role.BRIGADIR]}><EmployeeSalaryPage /></ProtectedRoute>} />

          <Route path="/brigadir/dashboard" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]}><BrigadirDashboard /></ProtectedRoute>} />
          <Route path="/brigadir/checks" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]} requiredModule="skills"><BrigadirChecksPage /></ProtectedRoute>} />
          <Route path="/brigadir/team" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]} requiredModule="skills"><BrigadirTeamPage /></ProtectedRoute>} />
          <Route path="/brigadir/quality" element={<ProtectedRoute allowedRoles={[Role.BRIGADIR]} requiredModule="skills"><BrigadirQualityPage /></ProtectedRoute>} />

          <Route path="/" element={<EmailConfirmationHandler />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppProvider>
    </HashRouter>
  );
}
