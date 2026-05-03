import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';

const schema = z.object({ code: z.string().min(4, 'Enter your 6-digit code') });
type FormData = z.infer<typeof schema>;

export default function MfaVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  const userId = (location.state as { userId?: string })?.userId;

  const [useBackup, setUseBackup] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!userId) {
    navigate('/login');
    return null;
  }

  const onSubmit = async ({ code }: FormData) => {
    setServerError('');
    setIsLoading(true);
    try {
      const { data } = await authApi.mfaVerify(userId, code, useBackup);
      setUser(data.user, data.accessToken);
      navigate('/admin/users');
    } catch (err: any) {
      setServerError(err.response?.data?.message ?? 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 mb-4">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify your identity</h1>
          <p className="text-sm text-gray-500 mt-1">
            {useBackup ? 'Enter one of your backup codes' : 'Enter the code from your authenticator app'}
          </p>
        </div>

        <div className="card p-6">
          {serverError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">{useBackup ? 'Backup code' : 'Authentication code'}</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                {...register('code')}
                className={`input text-center text-lg tracking-widest ${errors.code ? 'input-error' : ''}`}
                placeholder={useBackup ? 'XXXXX-XXXXX' : '000000'}
                maxLength={useBackup ? 11 : 6}
              />
              {errors.code && <p className="error-text">{errors.code.message}</p>}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setUseBackup((v) => !v)}
            className="mt-4 text-sm text-brand-600 hover:text-brand-700 w-full text-center"
          >
            {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
          </button>
        </div>
      </div>
    </div>
  );
}
