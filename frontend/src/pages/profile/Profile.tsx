import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Shield, Monitor, Eye, EyeOff, CircleCheck as CheckCircle, Download, TriangleAlert as AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../api/auth.api';
import { usersApi } from '../../api/users.api';
import { format, formatDistanceToNow } from 'date-fns';

const changePwSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string()
    .min(12, 'At least 12 characters')
    .regex(/[A-Z]/, 'Needs uppercase')
    .regex(/[a-z]/, 'Needs lowercase')
    .regex(/\d/, 'Needs a number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Needs a special character'),
  confirm: z.string(),
}).refine(d => d.newPassword === d.confirm, { message: 'Passwords must match', path: ['confirm'] });
type ChangePwData = z.infer<typeof changePwSchema>;

type TabId = 'profile' | 'security' | 'sessions';

export default function ProfilePage() {
  const { user: authUser } = useAuthStore();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<TabId>((params.get('tab') as TabId) ?? 'profile');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [mfaData, setMfaData] = useState<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const { data: user } = useQuery({
    queryKey: ['user', authUser?.id],
    queryFn: () => usersApi.get(authUser!.id).then(r => r.data),
    enabled: !!authUser?.id,
  });

  const changePw = useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePwData) =>
      authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => { setPwSuccess(true); resetPw(); },
  });

  const enrollMfa = useMutation({
    mutationFn: () => authApi.enrollMfa(),
    onSuccess: ({ data }) => setMfaData(data),
  });

  const disableMfa = useMutation({
    mutationFn: () => authApi.disableMfa(),
    onSuccess: () => {
      setMfaData(null);
      qc.invalidateQueries({ queryKey: ['user', authUser?.id] });
    },
  });

  const regenBackupCodes = useMutation({
    mutationFn: () => authApi.regenerateBackupCodes(),
    onSuccess: (result: any) => setBackupCodes(result?.data?.backupCodes ?? []),
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => usersApi.revokeSession(authUser!.id, sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', authUser?.id] }),
  });

  const { register: regPw, handleSubmit: handlePw, formState: { errors: pwErrors }, reset: resetPw } = useForm<ChangePwData>({
    resolver: zodResolver(changePwSchema),
  });

  const downloadCodes = (codes: string[]) => {
    const content = `Essential HICS — MFA Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${codes.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hics-backup-codes.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security & MFA', icon: Shield },
    { id: 'sessions', label: 'Active Sessions', icon: Monitor },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">My Account</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile */}
      {tab === 'profile' && user && (
        <div className="card divide-y divide-gray-100">
          {[
            ['Name', `${user.firstName} ${user.lastName}`],
            ['Email', user.email],
            ['Job title', user.jobTitle ?? '—'],
            ['Employee ID', user.employeeId ?? '—'],
            ['Mobile', user.phoneMobile ?? '—'],
            ['Work phone', user.phoneWork ?? '—'],
            ['Pager', user.pagerNumber ?? '—'],
            ['Member since', format(new Date(user.createdAt), 'PPP')],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center px-5 py-3">
              <span className="w-36 text-sm text-gray-500 flex-shrink-0">{label}</span>
              <span className="text-sm text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="space-y-6">
          {/* Change password */}
          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Change password</h3>
            {pwSuccess && (
              <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                <CheckCircle className="h-4 w-4" /> Password changed. All other sessions were signed out.
              </div>
            )}
            {changePw.isError && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {(changePw.error as any)?.response?.data?.message ?? 'Failed to change password.'}
              </div>
            )}
            <form onSubmit={handlePw(d => changePw.mutate(d))} className="space-y-3">
              <div>
                <label className="label">Current password</label>
                <div className="relative">
                  <input type={showOldPw ? 'text' : 'password'} {...regPw('currentPassword')}
                    className={`input pr-10 ${pwErrors.currentPassword ? 'input-error' : ''}`} />
                  <button type="button" onClick={() => setShowOldPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                    {showOldPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwErrors.currentPassword && <p className="error-text">{pwErrors.currentPassword.message}</p>}
              </div>
              <div>
                <label className="label">New password</label>
                <div className="relative">
                  <input type={showNewPw ? 'text' : 'password'} {...regPw('newPassword')}
                    className={`input pr-10 ${pwErrors.newPassword ? 'input-error' : ''}`} />
                  <button type="button" onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwErrors.newPassword && <p className="error-text">{pwErrors.newPassword.message}</p>}
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input type={showNewPw ? 'text' : 'password'} {...regPw('confirm')}
                  className={`input ${pwErrors.confirm ? 'input-error' : ''}`} />
                {pwErrors.confirm && <p className="error-text">{pwErrors.confirm.message}</p>}
              </div>
              <button type="submit" disabled={changePw.isPending} className="btn-primary">
                {changePw.isPending ? 'Saving…' : 'Change password'}
              </button>
            </form>
          </div>

          {/* MFA */}
          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Two-factor authentication</h3>
            <p className="text-sm text-gray-500 mb-4">
              {user?.mfaEnabled ? 'MFA is enabled on your account.' : 'Add an extra layer of security to your account.'}
            </p>

            {!mfaData && !backupCodes && (
              <div className="flex flex-wrap gap-2">
                {!user?.mfaEnabled ? (
                  <button onClick={() => enrollMfa.mutate()} disabled={enrollMfa.isPending} className="btn-primary text-sm">
                    {enrollMfa.isPending ? 'Setting up…' : 'Enable MFA'}
                  </button>
                ) : (
                  <>
                    <button onClick={() => regenBackupCodes.mutate()} disabled={regenBackupCodes.isPending} className="btn-secondary text-sm">
                      Regenerate backup codes
                    </button>
                    <button
                      onClick={() => { if (confirm('Disable MFA? Your account will be less secure.')) disableMfa.mutate(); }}
                      className="btn-danger text-sm"
                    >
                      Disable MFA
                    </button>
                  </>
                )}
              </div>
            )}

            {mfaData && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Scan this QR code with your authenticator app:</p>
                <img src={mfaData.qrCodeDataUrl} alt="MFA QR code" className="h-40 w-40 border rounded-lg p-1" />
                <div className="bg-gray-50 border rounded p-3">
                  <p className="text-xs text-gray-500 mb-1">Backup codes (save these now):</p>
                  <div className="grid grid-cols-2 gap-1">
                    {mfaData.backupCodes.map(c => <code key={c} className="text-xs font-mono text-gray-700">{c}</code>)}
                  </div>
                </div>
                <button onClick={() => downloadCodes(mfaData.backupCodes)} className="btn-secondary text-sm flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download backup codes
                </button>
                <button onClick={() => { setMfaData(null); qc.invalidateQueries({ queryKey: ['user'] }); }} className="btn-primary text-sm">
                  Done
                </button>
              </div>
            )}

            {backupCodes && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  New backup codes generated. Old codes are no longer valid.
                </div>
                <div className="grid grid-cols-2 gap-1 bg-gray-50 border rounded p-3">
                  {backupCodes.map(c => <code key={c} className="text-xs font-mono text-gray-700">{c}</code>)}
                </div>
                <button onClick={() => downloadCodes(backupCodes)} className="btn-secondary text-sm flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
                <button onClick={() => setBackupCodes(null)} className="btn-primary text-sm">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sessions */}
      {tab === 'sessions' && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Active sessions</h3>
          {!user?.sessions?.length ? (
            <p className="text-sm text-gray-500">No active sessions.</p>
          ) : (
            <ul className="space-y-2 divide-y divide-gray-100">
              {user.sessions.map(s => (
                <li key={s.id} className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.deviceInfo ?? 'Unknown device'}</p>
                    <p className="text-xs text-gray-400">
                      {s.ipAddress ?? 'Unknown IP'} ·
                      Last active {formatDistanceToNow(new Date(s.lastUsedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeSession.mutate(s.id)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
