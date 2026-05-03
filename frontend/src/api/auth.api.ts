import { supabase } from '../lib/supabase';
import type { AuthUser } from '../types';

function sessionToAuthUser(session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }): AuthUser {
  const meta = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    firstName: (meta.first_name as string) ?? (meta.firstName as string) ?? '',
    lastName: (meta.last_name as string) ?? (meta.lastName as string) ?? '',
    displayName: (meta.display_name as string) ?? undefined,
    mustChangePassword: false,
    mfaEnabled: false,
  };
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw { response: { data: { message: error.message } } };
    if (!data.session) throw { response: { data: { message: 'Login failed' } } };
    return {
      data: {
        accessToken: data.session.access_token,
        user: sessionToAuthUser(data.session),
        mfaRequired: false,
      },
    };
  },

  logout: async () => {
    await supabase.auth.signOut();
    return { data: {} };
  },

  refresh: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('No session');
    return { data: { accessToken: data.session.access_token } };
  },

  getUser: async (): Promise<AuthUser | null> => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return sessionToAuthUser(data.session);
  },

  forgotPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw { response: { data: { message: error.message } } };
    return { data: {} };
  },

  resetPassword: async (_token: string, password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw { response: { data: { message: error.message } } };
    return { data: {} };
  },

  changePassword: async (_currentPassword: string, newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw { response: { data: { message: error.message } } };
    return { data: {} };
  },

  // MFA stubs — not supported in this migration layer
  mfaVerify: async (_userId: string, _code: string, _isBackupCode = false) => {
    throw { response: { data: { message: 'MFA not configured' } } };
  },

  enrollMfa: async () => {
    throw { response: { data: { message: 'MFA enrollment not configured' } } };
  },

  disableMfa: async () => {
    throw { response: { data: { message: 'MFA not configured' } } };
  },

  regenerateBackupCodes: async () => {
    throw { response: { data: { message: 'MFA not configured' } } };
  },
};
