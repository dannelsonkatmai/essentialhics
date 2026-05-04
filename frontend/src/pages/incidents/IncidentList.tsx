import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, ListFilter as Filter } from 'lucide-react';
import { format } from 'date-fns';
import { incidentsApi, Incident } from '../../api/incidents.api';
import { useAuthStore } from '../../stores/auth.store';
import CreateIncidentModal from './CreateIncidentModal';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-red-100 text-red-800',
  CONTROLLED: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

const SEVERITY_LABELS: Record<string, string> = {
  LEVEL_1: 'Level 1',
  LEVEL_2: 'Level 2',
  LEVEL_3: 'Level 3',
  EXERCISE: 'Exercise',
};

export default function IncidentList() {
  const user = useAuthStore((s) => s.user);
  const facilityId = user?.primaryFacilityId ?? user?.roles?.[0]?.facilityId ?? '';
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['incidents', facilityId, statusFilter, page],
    queryFn: () =>
      incidentsApi.list(facilityId, { status: statusFilter || undefined, page, limit: 20 }).then((r) => r.data),
    enabled: !!facilityId,
  });

  const incidents = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500 mt-1">Manage active and historical incidents</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Declare Incident
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        {['', 'ACTIVE', 'CONTROLLED', 'CLOSED'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              statusFilter === s
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No incidents found</p>
            <p className="text-gray-400 text-sm mt-1">Declare an incident to get started</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Incident', 'Type', 'Severity', 'Status', 'Declared', 'Commander', 'Periods', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {incidents.map((inc: Incident) => (
                <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{inc.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{inc.incidentNumber}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inc.incidentType.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{SEVERITY_LABELS[inc.severity] ?? inc.severity}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {inc.status}
                    </span>
                    {inc.isExercise && (
                      <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        EXERCISE
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {format(new Date(inc.declarationTime), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {inc.incidentCommander
                      ? `${inc.incidentCommander.firstName} ${inc.incidentCommander.lastName}`
                      : <span className="text-gray-400 italic">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {inc._count?.operationalPeriods ?? 0}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/incidents/${inc.id}`}
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateIncidentModal
          facilityId={facilityId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { refetch(); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
