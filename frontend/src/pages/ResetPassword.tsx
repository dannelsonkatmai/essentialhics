import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth.api';

const schema = z.object({
  password: z.string()
    .min(12, 'At least 12 characters')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/\d/, 'Needs a number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Needs a special character'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ password }: FormData) => {
    setServerError('');
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setServerError(err.response?.data?.message ?? 'Failed to reset password.');
    } finally { setIsLoading(false); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card p-6 w-full max-w-sm text-center">
          <p className="text-sm text-gray-600 mb-4">Invalid or missing reset token.</p>
          <Link to="/forgot-password" className="btn-primary inline-flex">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
        </div>
        <div className="card p-6">
          {done ? (
            <div className="text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-medium text-gray-900">Password set successfully</p>
              <p className="text-sm text-gray-500">All other sessions have been signed out.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full mt-2">
                Sign in
              </button>
            </div>
          ) : (
            <>
              {serverError && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      {...register('password')}
                      className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="label">Confirm password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    {...register('confirm')}
                    className={`input ${errors.confirm ? 'input-error' : ''}`}
                  />
                  {errors.confirm && <p className="error-text">{errors.confirm.message}</p>}
                </div>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li>• At least 12 characters</li>
                  <li>• Uppercase, lowercase, number, and special character</li>
                </ul>
                <button type="submit" disabled={isLoading} className="btn-primary w-full">
                  {isLoading ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
