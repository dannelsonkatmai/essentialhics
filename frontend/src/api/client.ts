import axios from 'axios';
import { supabase } from '../lib/supabase';

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`,
  headers: {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
});

// Attach Supabase session token to every request
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Re-export for legacy compat
export function setAccessToken(_token: string | null): void {
  // No-op — token management is handled by Supabase
}

export function getAccessToken(): string | null {
  return null;
}

export default apiClient;
