/**
 * Resource Request List (ICS-213RR)
 * Shows all requests for an incident with status badges + workflow actions.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { requestsApi } from '../../api/requests.api';

type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'DENIED';

interface ResourceRequest {
  id: string;
  requestNumber: string;
  status: RequestStatus;
  priority: string;
  missionAssignment?: string;
  requestedForSection?: string;
  deliveryLocation?: string;
  neededDate?: string;
  estimatedCost?: string;
  createdAt: string;
  requestedByUser: { firstName: string; lastName: string };
  lineItems: Array<{
    id: string;
    resourceDescription: string;
    quantity: string;
    unit: string;
    filledQuantity: string;
    estimatedTotalCost?: string;
  }>;
}

const STATUS_BADGE: Record<RequestStatus, string> = {
  DRAFT:            'bg-gray-100 text-gray-800',
  SUBMITTED:        'bg-yellow-100 text-yellow-800',
  APPROVED:         'bg-blue-100 text-blue-800',
  PARTIALLY_FILLED: 'bg-orange-100 text-orange-800',
  FILLED:           'bg-green-100 text-green-800',
  CANCELLED:        'bg-gray-100 text-gray-500 line-through',
  DENIED:           'bg-red-100 text-red-800',
};

const PRIORITY_BADGE: Record<string, string> = {
  IMMEDIATE: 'bg-red-100 text-red-800 font-bold',
  PRIORITY:  'bg-yellow-100 text-yellow-800',
  ROUTINE:   'bg-gray-100 text-gray-700',
};

function RequestRow({ req, facilityId, incidentId }: {
  req: ResourceRequest;
  facilityId: string;
  incidentId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: () => requestsApi.submit(facilityId, incidentId, req.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests', incidentId] }),
  });

  const approveMutation = useMutation({
    mutationFn: () => requestsApi.approve(facilityId, incidentId, req.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests', incidentId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => requestsApi.cancel(facilityId, incidentId, req.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests', incidentId] }),
  });

  const estimatedCost = req.estimatedCost
    ? `$${parseFloat(req.estimatedCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : null;

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-4 py-3">
          <Link
            to={`/incidents/${incidentId}/requests/${req.id}`}
            className="text-sm font-medium text-brand-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {req.requestNumber}
          </Link>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[req.status]}`}>
            {req.status.replace('_', ' ')}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[req.priority]}`}>
            {req.priority}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
          {req.missionAssignment ?? req.requestedForSection ?? '��'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {req.requestedByUser.firstName} {req.requestedByUser.lastName}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {estimatedCost ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {req.neededDate
            ? new Date(req.neededDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {req.status === 'DRAFT' && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="text-xs text-brand-600 hover:underline font-medium"
              >
                Submit
              </button>
            )}
            {req.status === 'SUBMITTED' && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="text-xs text-green-700 hover:underline font-medium"
              >
                Approve
              </button>
            )}
            {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(req.status) && (
              <button
                onClick={() => {
                  if (confirm('Cancel this request?')) cancelMutation.mutate();
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Cancel
              </button>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </td>
      </tr>

      {/* Expanded line items */}
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="ml-4 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</p>
              {req.lineItems.map((li) => {
                const needed = parseFloat(li.quantity);
                const filled = parseFloat(li.filledQuantity);
                const pct = needed > 0 ? Math.round((filled / needed) * 100) : 0;
                return (
                  <div key={li.id} className="flex items-center gap-4 text-sm py-1">
                    <span className="text-gray-800 flex-1">{li.resourceDescription}</span>
                    <span className="text-gray-500 text-xs">
                      {li.quantity} {li.unit}
                    </span>
                    {filled > 0 && (
                      <span className={`text-xs font-medium ${pct >= 100 ? 'text-green-700' : 'text-orange-600'}`}>
                        {filled}/{needed} filled ({pct}%)
                      </span>
                    )}
                    {li.estimatedTotalCost && (
                      <span className="text-xs text-gray-400">
                        ${parseFloat(li.estimatedTotalCost).toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function RequestList() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';

  const [statusFilter, setStatusFilter] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['requests', incidentId, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = statusFilter ? { status: statusFilter } : {};
      const res = await requestsApi.list(facilityId, incidentId!, params);
      return res.data as unknown as ResourceRequest[];
    },
    enabled: !!incidentId && !!facilityId,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Resource Requests (ICS-213RR)</h1>
          <span className="text-sm text-gray-500">({requests.length})</span>
        </div>
        <Link
          to={`/incidents/${incidentId}/requests/new`}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New Request
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        {(['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_FILLED', 'FILLED', 'DENIED', 'CANCELLED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Request #', 'Status', 'Priority', 'Mission / Section', 'Requested By', 'Est. Cost', 'Needed By', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <RequestRow
                  key={req.id}
                  req={req}
                  facilityId={facilityId}
                  incidentId={incidentId!}
                />
              ))}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>No resource requests yet</p>
              <Link to={`/incidents/${incidentId}/requests/new`} className="text-sm text-brand-600 hover:underline mt-1 inline-block">
                Create a request
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
