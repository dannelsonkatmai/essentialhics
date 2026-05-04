import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { TriangleAlert as AlertTriangle, Clock, Users, FileText, Network, Plus, ChevronRight, CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react';
import { incidentsApi } from '../../api/incidents.api';
import { writeAuditLog } from '../../api/auditLog.api';
import { useAuthStore } from '../../stores/auth.store';
import { useIncidentSocket } from '../../hooks/useSocket';

export default function IncidentDetail() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const user = useAuthStore((s) => s.user);
  const facilityId = user?.roles?.[0]?.facilityId ?? '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [openingIapForPeriod, setOpeningIapForPeriod] = useState<string | null>(null);

  // Subscribe to real-time updates for this incident
  useIncidentSocket(incidentId);

  const { data: incident, isLoading } = useQuery({
    queryKey: ['incidents', facilityId, incidentId],
    queryFn: () => incidentsApi.get(facilityId, incidentId!).then((r) => r.data),
    enabled: !!(facilityId && incidentId),
  });

  const { data: periods } = useQuery({
    queryKey: ['incidents', incidentId, 'periods'],
    queryFn: () => incidentsApi.listPeriods(facilityId, incidentId!).then((r) => r.data),
    enabled: !!(facilityId && incidentId),
  });

  const closeMutation = useMutation({
    mutationFn: () => incidentsApi.close(facilityId, incidentId!),
    onSuccess: () => {
      writeAuditLog({ action: 'INCIDENT_CLOSED', resourceType: 'Incident', resourceId: incidentId!, facilityId });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  const createPeriodMutation = useMutation({
    mutationFn: (dto: { startTime: string; endTime: string; objectives?: string }) =>
      incidentsApi.createPeriod(facilityId, incidentId!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'periods'] });
      setShowNewPeriod(false);
    },
  });

  const openIap = async (period: { id: string; iap?: { id: string } | null }) => {
    if (period.iap) {
      navigate(`/incidents/${incidentId}/iap/${period.iap.id}`);
      return;
    }
    setOpeningIapForPeriod(period.id);
    try {
      const { data } = await incidentsApi.createIap(incidentId!, period.id);
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'periods'] });
      navigate(`/incidents/${incidentId}/iap/${data.id}`);
    } finally {
      setOpeningIapForPeriod(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Incident not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/incidents" className="hover:text-gray-900">Incidents</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">{incident.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{incident.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                incident.status === 'ACTIVE' ? 'bg-red-100 text-red-800' :
                incident.status === 'DEMOBILIZING' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {incident.status}
              </span>
              {incident.isExercise && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">EXERCISE</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{incident.incidentNumber} · {incident.incidentType.replace(/_/g, ' ')}</p>
          </div>
          {incident.status !== 'CLOSED' && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to close this incident?')) {
                  closeMutation.mutate();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              <XCircle className="w-4 h-4" />
              Close Incident
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Declared</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {format(new Date(incident.declarationTime), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Severity</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{incident.severity.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Incident Commander</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {incident.incidentCommander
                ? `${incident.incidentCommander.firstName} ${incident.incidentCommander.lastName}`
                : <span className="text-gray-400 italic">Unassigned</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Location</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{incident.location ?? '—'}</p>
          </div>
        </div>

        {incident.description && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            {incident.description}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to={`/incidents/${incidentId}/orgboard`}
          className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex items-start gap-4"
        >
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Network className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Command Structure</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manage HICS org board assignments</p>
          </div>
        </Link>

        <button
          onClick={() => setShowNewPeriod(true)}
          className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex items-start gap-4 text-left"
        >
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">New Operational Period</h3>
            <p className="text-xs text-gray-500 mt-0.5">Create a new planning period with IAP</p>
          </div>
        </button>

        {(() => {
          const firstIap = (periods ?? []).find((p) => p.iap)?.iap;
          const content = (
            <>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">IAP Forms</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {firstIap ? 'Open incident action plan' : `${(periods ?? []).length} operational period(s)`}
                </p>
              </div>
            </>
          );
          const firstPeriod = (periods ?? []).find((p) => p.iap) ?? (periods ?? [])[0];
          return firstPeriod ? (
            <button
              onClick={() => openIap(firstPeriod)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex items-start gap-4 text-left w-full"
            >
              {content}
            </button>
          ) : (
            <button
              onClick={() => setShowNewPeriod(true)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex items-start gap-4 text-left w-full"
            >
              {content}
            </button>
          );
        })()}
      </div>

      {/* Operational Periods */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Operational Periods</h2>
        {!periods || periods.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No operational periods yet</p>
            <button
              onClick={() => setShowNewPeriod(true)}
              className="mt-3 text-sm text-red-600 font-medium hover:underline"
            >
              Create first operational period →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {periods.map((period) => (
              <div key={period.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-700">
                    {period.periodNumber}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Period {period.periodNumber}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(period.startTime), 'MMM d HH:mm')} – {format(new Date(period.endTime), 'MMM d HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {period.iap && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">IAP Status</p>
                      <p className={`text-sm font-medium ${
                        period.iap.status === 'PUBLISHED' ? 'text-emerald-600' :
                        period.iap.status === 'IN_REVIEW' ? 'text-amber-600' :
                        'text-gray-600'
                      }`}>
                        {period.iap.status}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => openIap(period)}
                    disabled={openingIapForPeriod === period.id}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    {openingIapForPeriod === period.id ? 'Opening…' : period.iap ? 'Open IAP' : 'Create IAP'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Period Modal */}
      {showNewPeriod && (
        <NewPeriodModal
          onClose={() => setShowNewPeriod(false)}
          onSave={(dto) => createPeriodMutation.mutate(dto)}
          isLoading={createPeriodMutation.isPending}
        />
      )}
    </div>
  );
}

function NewPeriodModal({
  onClose, onSave, isLoading
}: {
  onClose: () => void;
  onSave: (dto: { startTime: string; endTime: string; objectives?: string }) => void;
  isLoading: boolean;
}) {
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState('');
  const [objectives, setObjectives] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">New Operational Period</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objectives (optional)</label>
          <textarea value={objectives} onChange={e => setObjectives(e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            placeholder="High-level objectives for this period…" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave({
              startTime: new Date(startTime).toISOString(),
              endTime: new Date(endTime || startTime).toISOString(),
              objectives: objectives || undefined,
            })}
            disabled={isLoading || !startTime || !endTime}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating…' : 'Create Period'}
          </button>
        </div>
      </div>
    </div>
  );
}
