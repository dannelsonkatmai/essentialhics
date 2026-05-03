import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { auditLogApi, AuditLogFilters } from '../../api/auditLog.api';
import { facilitiesApi } from '../../api/facilities.api';
import { format } from 'date-fns';

const AUDIT_ACTIONS = [
  'USER_LOGIN', 'USER_LOGIN_FAILED', 'USER_LOGOUT', 'USER_LOCKED',
  'USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED', 'USER_ROLE_ASSIGNED',
  'USER_ROLE_REMOVED', 'USER_PASSWORD_RESET', 'USER_MFA_ENROLLED', 'USER_MFA_DISABLED',
  'USER_SESSION_REVOKED', 'FACILITY_CREATED', 'FACILITY_UPDATED', 'SETTINGS_UPDATED',
];

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', page, filters],
    queryFn: () => auditLogApi.list({ ...filters, page, limit: 50 }).then(r => r.data),
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesApi.list().then(r => r.data),
  });

  const handleExport = async () => {
    const { data: blob } = await auditLogApi.export(filters);
    const url = URL.createObjectURL(blob as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateFilter = (key: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const actionBadgeClass = (action: string) => {
    if (action.includes('FAILED') || action.includes('LOCKED') || action.includes('DEACTIVATED')) return 'badge-red';
    if (action.includes('LOGIN')) return 'badge-green';
    if (action.includes('MFA')) return 'badge-blue';
    return 'badge-gray';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">HIPAA-compliant, immutable record of all system actions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(v => !v)} className="btn-secondary flex items-center gap-1.5">
            <Filter className="h-4 w-4" /> Filters
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Action type</label>
            <select
              value={filters.action ?? ''}
              onChange={e => updateFilter('action', e.target.value)}
              className="input"
            >
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Facility</label>
            <select
              value={filters.facilityId ?? ''}
              onChange={e => updateFilter('facilityId', e.target.value)}
              className="input"
            >
              <option value="">All facilities</option>
              {facilities?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Start date</label>
            <input
              type="datetime-local"
              value={filters.startDate ?? ''}
              onChange={e => updateFilter('startDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="input"
            />
          </div>
          <div>
            <label className="label">End date</label>
            <input
              type="datetime-local"
              value={filters.endDate ?? ''}
              onChange={e => updateFilter('endDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="input"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Timestamp', 'Actor', 'Action', 'Resource', 'Facility', 'IP Address'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No audit events found.</td></tr>
              )}
              {data?.data.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {log.actorUser
                      ? `${log.actorUser.firstName} ${log.actorUser.lastName}`
                      : <span className="text-gray-400">(system)</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={actionBadgeClass(log.action)}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.resourceType}
                    <span className="text-gray-300 mx-1">·</span>
                    <span className="font-mono text-gray-400">{log.resourceId.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{log.facility?.shortName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.actorIpAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between bg-white">
            <p className="text-xs text-gray-500">
              {data.pagination.total.toLocaleString()} total events
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-700 px-2">Page {page} of {data.pagination.totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page === data.pagination.totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
