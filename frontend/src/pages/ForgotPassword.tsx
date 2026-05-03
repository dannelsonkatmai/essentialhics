import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth.api';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }: FormData) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {}
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-600 mb-4">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="text-sm text-gray-700 font-medium">Check your email</p>
              <p className="text-sm text-gray-500">
                If that email is registered, you'll receive a password reset link shortly. The link expires in 24 hours.
              </p>
              <Link to="/login" className="btn-secondary w-full inline-flex justify-center mt-2">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    className={`input ${errors.email ? 'input-error' : ''}`}
                  />
                  {errors.email && <p className="error-text">{errors.email.message}</p>}
                </div>
                <button type="submit" disabled={isLoading} className="btn-primary w-full">
                  {isLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <Link to="/login" className="mt-4 text-sm text-brand-600 hover:text-brand-700 block text-center">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
