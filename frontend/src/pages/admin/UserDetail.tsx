import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, Monitor, Clock, Plus, Trash2 } from 'lucide-react';
import { usersApi } from '../../api/users.api';
import { facilitiesApi } from '../../api/facilities.api';
import { auditLogApi } from '../../api/auditLog.api';
import { HICS_ROLE_LABELS } from '../../types';
import { format, formatDistanceToNow } from 'date-fns';

type TabId = 'overview' | 'roles' | 'security' | 'audit';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('overview');

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesApi.list().then(r => r.data),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['auditLogs', 'user', id],
    queryFn: () => auditLogApi.list({ actorUserId: id, limit: 20 }).then(r => r.data),
    enabled: tab === 'audit' && !!id,
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => usersApi.revokeSession(id!, sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  });

  const removeRole = useMutation({
    mutationFn: (roleId: string) => usersApi.removeRole(id!, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  });

  const deactivate = useMutation({
    mutationFn: () => usersApi.deactivate(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', id] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!user) return <div className="p-6 text-sm text-gray-500">User not found.</div>;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Profile' },
    { id: 'roles', label: 'Roles & Facilities' },
    { id: 'security', label: 'Security' },
    { id: 'audit', label: 'Audit History' },
  ];

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/users')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user.isLocked && <span className="badge-yellow">Locked</span>}
          {!user.isActive && <span className="badge-red">Inactive</span>}
          {user.isActive && !user.isLocked && <span className="badge-green">Active</span>}
          {user.isActive && (
            <button
              onClick={() => { if (confirm('Deactivate this user?')) deactivate.mutate(); }}
              className="btn-danger text-sm"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile tab */}
      {tab === 'overview' && (
        <div className="card divide-y divide-gray-100">
          {[
            ['Full name', `${user.firstName} ${user.lastName}`],
            ['Display name', user.displayName ?? '—'],
            ['Email', user.email],
            ['Job title', user.jobTitle ?? '—'],
            ['Employee ID', user.employeeId ?? '—'],
            ['Mobile', user.phoneMobile ?? '—'],
            ['Work phone', user.phoneWork ?? '—'],
            ['Pager', user.pagerNumber ?? '—'],
            ['Auth provider', user.authProvider],
            ['Member since', format(new Date(user.createdAt), 'PPP')],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center px-5 py-3">
              <span className="w-40 text-sm text-gray-500 flex-shrink-0">{label}</span>
              <span className="text-sm text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Roles tab */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Facility', 'HICS Role', 'Primary', 'Assigned', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {user.userFacilityRoles?.map(r => {
                  const facility = facilities?.find(f => f.id === r.facilityId);
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{facility?.name ?? r.facilityId}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="badge-blue">{HICS_ROLE_LABELS[r.hicsRole as keyof typeof HICS_ROLE_LABELS] ?? r.hicsRole}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.isPrimaryFacility ? '✓' : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{format(new Date(r.assignedAt), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeRole.mutate(r.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove role"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-600" /> Security overview
            </h3>
            <dl className="space-y-2">
              {[
                ['MFA enabled', user.mfaEnabled ? 'Yes' : 'No'],
                ['Password last changed', user.passwordChangedAt ? format(new Date(user.passwordChangedAt), 'PPPp') : 'Never'],
                ['Must change password', user.mustChangePassword ? 'Yes' : 'No'],
                ['Last login', user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : 'Never'],
              ].map(([k, v]) => (
                <div key={k} className="flex text-sm">
                  <dt className="w-48 text-gray-500">{k}</dt>
                  <dd className="text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-brand-600" /> Active sessions
            </h3>
            {!user.sessions?.length ? (
              <p className="text-sm text-gray-500">No active sessions.</p>
            ) : (
              <ul className="space-y-2">
                {user.sessions.map(s => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{s.deviceInfo ?? 'Unknown device'}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500">{s.ipAddress ?? 'unknown IP'}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-400">
                        Last used {formatDistanceToNow(new Date(s.lastUsedAt), { addSuffix: true })}
                      </span>
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
        </div>
      )}

      {/* Audit tab */}
      {tab === 'audit' && (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Time', 'Action', 'Resource', 'IP Address'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {auditLogs?.data.map(log => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-700">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{log.resourceType}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{log.actorIpAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
