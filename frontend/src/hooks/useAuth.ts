import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { authApi } from '../api/auth.api';

export function useBootstrapAuth(): void {
  const { setUser, setLoading, logout } = useAuthStore();

  useEffect(() => {
    // Try to silently refresh on page load
    authApi.refresh()
      .then(({ data }) => {
        // Fetch user info with the new access token
        // The /auth/refresh response only returns the new token;
        // we call a lightweight endpoint to get the user profile.
        import('../api/client').then(({ apiClient }) => {
          apiClient.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
          import('../api/users.api').then(({ usersApi }) => {
            // We don't have the user id here, so we re-use the token context
            // A dedicated /auth/me endpoint would be cleaner — simulate with users
            setUser(null, data.accessToken);
            // Fetch own profile
            apiClient.get('/api/me').then((res) => {
              setUser(res.data, data.accessToken);
            }).catch(() => setLoading(false));
          });
        });
      })
      .catch(() => {
        setLoading(false);
      });

    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);
}

export { useAuthStore };
