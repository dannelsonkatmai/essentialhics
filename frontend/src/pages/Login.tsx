import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TriangleAlert as AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { writeAuditLog } from '../api/auditLog.api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    setIsLoading(true);
    try {
      const { data: resp } = await authApi.login(data.email, data.password);

      if (resp.mfaRequired) {
        navigate('/mfa/verify', { state: { userId: resp.user?.id } });
        return;
      }

      if (resp.accessToken && resp.user) {
        setUser(resp.user);
        writeAuditLog({ action: 'USER_LOGIN', resourceType: 'User', resourceId: resp.user.id });
        if (resp.user.mustChangePassword) {
          navigate('/profile?tab=security&action=change-password');
        } else {
          navigate('/incidents');
        }
      }
    } catch (err: any) {
      setServerError(err.response?.data?.message ?? 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 mb-4">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Essential HICS</h1>
          <p className="text-sm text-gray-500 mt-1">Hospital Incident Command System</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {serverError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@hospital.org"
              />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          {/* SSO placeholder — shown when facility has SSO configured */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400 mb-3">Or continue with</p>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => window.location.href = '/auth/sso/azure'}
            >
              Sign in with Health System SSO
            </button>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400 mt-6">
          Essential HICS — HIPAA-compliant incident management
        </p>
      </div>
    </div>
  );
}
