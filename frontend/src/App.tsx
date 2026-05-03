import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth.store';
import { supabase } from './lib/supabase';
import type { AuthUser } from './types';

import DashboardShell from './components/layout/DashboardShell';
import ProtectedRoute from './components/common/ProtectedRoute';

// Auth pages
import LoginPage from './pages/Login';
import MfaVerifyPage from './pages/MfaVerify';
import MfaEnrollPage from './pages/MfaEnroll';
import ForgotPasswordPage from './pages/ForgotPassword';
import ResetPasswordPage from './pages/ResetPassword';

// Phase 1 — Admin pages
import UsersPage from './pages/admin/Users';
import UserDetailPage from './pages/admin/UserDetail';
import FacilitiesPage from './pages/admin/Facilities';
import FacilityDetailPage from './pages/admin/FacilityDetail';
import AuditLogPage from './pages/admin/AuditLog';
import ProfilePage from './pages/profile/Profile';

// Phase 2 — Incidents
import IncidentListPage from './pages/incidents/IncidentList';
import IncidentDetailPage from './pages/incidents/IncidentDetail';
import IapEditor from './pages/incidents/iap/IapEditor';
import OrgBoard from './pages/incidents/orgboard/OrgBoard';

// Phase 2 — Templates
import TemplateLibrary from './pages/admin/templates/TemplateLibrary';

// Phase 3 — Resources
import ResourceStatusBoard from './pages/resources/ResourceStatusBoard';
import ResourceDetail from './pages/resources/ResourceDetail';
import RequestList from './pages/resources/RequestList';
import RequestForm213RR from './pages/resources/RequestForm213RR';
import RequestDetail from './pages/resources/RequestDetail';
import ResourceCatalog from './pages/resources/ResourceCatalog';
import MutualAidDirectory from './pages/resources/MutualAidDirectory';

// Phase 3 — Costs
import CostLedger from './pages/costs/CostLedger';
import CostDetail from './pages/costs/CostDetail';

function sessionToAuthUser(supabaseUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AuthUser {
  const meta = supabaseUser.user_metadata ?? {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    firstName: (meta.first_name as string) ?? (meta.firstName as string) ?? '',
    lastName: (meta.last_name as string) ?? (meta.lastName as string) ?? '',
    displayName: (meta.display_name as string) ?? undefined,
    mustChangePassword: false,
    mfaEnabled: false,
  };
}

function App() {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    // Bootstrap: load existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(sessionToAuthUser(session.user));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(sessionToAuthUser(session.user));
      } else {
        logout();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mfa/verify" element={<MfaVerifyPage />} />
        <Route path="/mfa/enroll" element={<MfaEnrollPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected — wrapped in DashboardShell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardShell />}>
            <Route index element={<Navigate to="/incidents" replace />} />

            {/* Phase 1 Admin */}
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/users/:id" element={<UserDetailPage />} />
            <Route path="/admin/facilities" element={<FacilitiesPage />} />
            <Route path="/admin/facilities/:id" element={<FacilityDetailPage />} />
            <Route path="/admin/audit-log" element={<AuditLogPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Phase 2 Incidents */}
            <Route path="/incidents" element={<IncidentListPage />} />
            <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
            <Route path="/incidents/:incidentId/iap/:iapId" element={<IapEditor />} />
            <Route path="/incidents/:incidentId/orgboard" element={<OrgBoard />} />

            {/* Phase 2 Templates */}
            <Route path="/admin/templates" element={<TemplateLibrary />} />

            {/* Phase 3 Resources */}
            <Route path="/incidents/:incidentId/resources" element={<ResourceStatusBoard />} />
            <Route path="/incidents/:incidentId/resources/:resourceId" element={<ResourceDetail />} />

            {/* Phase 3 Requests (ICS-213RR) */}
            <Route path="/incidents/:incidentId/requests" element={<RequestList />} />
            <Route path="/incidents/:incidentId/requests/new" element={<RequestForm213RR />} />
            <Route path="/incidents/:incidentId/requests/:requestId" element={<RequestDetail />} />

            {/* Phase 3 Costs */}
            <Route path="/incidents/:incidentId/costs" element={<CostLedger />} />
            <Route path="/incidents/:incidentId/costs/:costId" element={<CostDetail />} />

            {/* Phase 3 Admin */}
            <Route path="/admin/resource-catalog" element={<ResourceCatalog />} />
            <Route path="/admin/mutual-aid" element={<MutualAidDirectory />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
