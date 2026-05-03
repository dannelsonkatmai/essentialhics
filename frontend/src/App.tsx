import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth.store';
import { authApi } from './api/auth.api';
import { setAccessToken } from './api/client';

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

function App() {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    // Bootstrap: try silent token refresh on page load
    authApi.refresh()
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setLoading(false);
        setUser({ id: '', email: '', firstName: '', lastName: '', mustChangePassword: false, mfaEnabled: false }, data.accessToken);
      })
      .catch(() => setLoading(false));

    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
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
