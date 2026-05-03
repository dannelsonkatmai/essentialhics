/**
 * Resource Request Detail (ICS-213RR)
 * Shows request header, line items with fill progress, and workflow actions.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ClipboardList, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { requestsApi } from '../../api/requests.api';

type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'DENIED';

interface LineItem {
  id: string;
  resourceDescription: string;
  quantity: string;
  unit: string;
  filledQuantity: string;
  estimatedUnitCost?: string;
  estimatedTotalCost?: string;
  notes?: string;
  fulfillments?: Array<{
    id: string;
    quantityFulfilled: string;
    fulfilledAt: string;
    notes?: string;
    fulfilledByUser: { firstName: string; lastName: string };
  }>;
}

interface ResourceRequest {
  id: string;
  requestNumber: string;
  status: RequestStatus;
  priority: string;
  missionAssignment?: string;
  requestedForSection?: string;
  requestedForRole?: string;
  deliveryLocation?: string;
  deliveryBy?: string;
  neededDate?: string;
  justification?: string;
  estimatedCost?: string;
  createdAt: string;
  requestedByUser: { firstName: string; lastName: string };
  approvedByUser?: { firstName: string; lastName: string };
  lineItems: LineItem[];
}

const STATUS_BADGE: Record<RequestStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PARTIALLY_FILLED: 'bg-orange-100 text-orange-800',
  FILLED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
  DENIED: 'bg-red-100 text-red-800',
};

const PRIORITY_BADGE: Record<string, string> = {
  IMMEDIATE: 'bg-red-100 text-red-800 font-bold',
  PRIORITY: 'bg-yellow-100 text-yellow-800',
  ROUTINE: 'bg-gray-100 text-gray-700',
};

interface FulfillFormValues {
  quantityFulfilled: number;
  notes?: string;
}

function LineItemRow({ li, requestId, facilityId, incidentId, canFulfill }: {
  li: LineItem;
  requestId: string;
  facilityId: string;
  incidentId: string;
  canFulfill: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showFulfill, setShowFulfill] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FulfillFormValues>({
    defaultValues: { quantityFulfilled: 1 },
  });

  const fulfillMutation = useMutation({
    mutationFn: (data: FulfillFormValues) =>
      requestsApi.fulfillLineItem(facilityId, incidentId, requestId, li.id, data),
    onSuccess: () => {
      setShowFulfill(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests', incidentId] });
    },
  });

  const needed = parseFloat(li.quantity);
  const filled = parseFloat(li.filledQuantity);
  const pct = needed > 0 ? Math.min(100, Math.round((filled / needed) * 100)) : 0;
  const remaining = Math.max(0, needed - filled);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 bg-white cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{li.resourceDescription}</p>
          {li.notes && <p className="text-xs text-gray-500 truncate mt-0.5">{li.notes}</p>}
        </div>
        <div className="text-sm text-gray-500 flex-shrink-0">
          {li.quantity} {li.unit}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Fill progress bar */}
          <div className="w-20 bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-orange-400' : 'bg-gray-300'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${pct >= 100 ? 'text-green-700' : pct > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {pct}%
          </span>
        </div>
        {li.estimatedTotalCost && (
          <div className="text-xs text-gray-400 flex-shrink-0">
            ${parseFloat(li.estimatedTotalCost).toFixed(2)}
          </div>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </div>

      {expanded && (
        <div className="bg-gray-50 border-t border-gray-200 p-4">
          {/* Fill summary */}
          <p className="text-xs text-gray-500 mb-3">
            {filled > 0 ? `${filled} of ${needed} ${li.unit} filled` : `Not yet filled (${needed} ${li.unit} needed)`}
            {remaining > 0 && filled > 0 && ` · ${remaining} remaining`}
          </p>

          {/* Fulfillments list */}
          {li.fulfillments && li.fulfillments.length > 0 && (
            <div className="space-y-2 mb-3">
              {li.fulfillments.map((f) => (
                <div key={f.id} className="flex items-center gap-3 text-xs text-gray-600 bg-white rounded p-2 border border-gray-100">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <span className="font-medium">{f.quantityFulfilled} {li.unit}</span>
                  <span>{f.fulfilledByUser.firstName} {f.fulfilledByUser.lastName}</span>
                  <span className="text-gray-400">{new Date(f.fulfilledAt).toLocaleString()}</span>
                  {f.notes && <span className="text-gray-400">· {f.notes}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Fulfill action */}
          {canFulfill && remaining > 0 && (
            !showFulfill ? (
              <button
                onClick={(e) => { e.stopPropagation(); setShowFulfill(true); }}
                className="text-xs text-brand-600 hover:underline font-medium"
              >
                Record fulfillment…
              </button>
            ) : (
              <form
                onSubmit={(e) => { e.stopPropagation(); handleSubmit((d) => fulfillMutation.mutate(d))(e); }}
                className="flex items-end gap-3 mt-1"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity Filled</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={remaining}
                    {...register('quantityFulfilled', { required: true, min: 0.01, max: remaining })}
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input {...register('notes')} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Optional" />
                </div>
                <button type="submit" disabled={fulfillMutation.isPending} className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded hover:bg-brand-700 disabled:opacity-50">
                  {fulfillMutation.isPending ? '…' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowFulfill(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  Cancel
                </button>
              </form>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function RequestDetail() {
  const { incidentId, requestId } = useParams<{ incidentId: string; requestId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';
  const queryClient = useQueryClient();

  const { data: request, isLoading, isError } = useQuery({
    queryKey: ['request', requestId],
    queryFn: async () => {
      const res = await requestsApi.get(facilityId, incidentId!, requestId!);
      return res.data as ResourceRequest;
    },
    enabled: !!facilityId && !!incidentId && !!requestId,
  });

  const submitMutation = useMutation({
    mutationFn: () => requestsApi.submit(facilityId, incidentId!, requestId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['request', requestId] }),
  });

  const approveMutation = useMutation({
    mutationFn: () => requestsApi.approve(facilityId, incidentId!, requestId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['request', requestId] }),
  });

  const denyMutation = useMutation({
    mutationFn: () => requestsApi.deny(facilityId, incidentId!, requestId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['request', requestId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => requestsApi.cancel(facilityId, incidentId!, requestId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['request', requestId] }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Request not found.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-brand-600 hover:underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  const canFulfill = ['APPROVED', 'PARTIALLY_FILLED'].includes(request.status);
  const estimatedCost = request.estimatedCost
    ? `$${parseFloat(request.estimatedCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/incidents/${incidentId}/requests`)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-5"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Requests
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{request.requestNumber}</h1>
            <p className="text-sm text-gray-500">
              Submitted by {request.requestedByUser.firstName} {request.requestedByUser.lastName} ·{' '}
              {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[request.status]}`}>
            {request.status.replace('_', ' ')}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[request.priority] ?? 'bg-gray-100 text-gray-700'}`}>
            {request.priority}
          </span>
          {estimatedCost && (
            <span className="text-sm font-semibold text-gray-700">{estimatedCost}</span>
          )}
        </div>
      </div>

      {/* Request header info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Request Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {request.requestedForSection && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Section</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{request.requestedForSection}</dd>
            </div>
          )}
          {request.requestedForRole && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{request.requestedForRole}</dd>
            </div>
          )}
          {request.deliveryLocation && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Location</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{request.deliveryLocation}</dd>
            </div>
          )}
          {request.neededDate && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Needed By</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{new Date(request.neededDate).toLocaleString()}</dd>
            </div>
          )}
          {request.approvedByUser && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Approved By</dt>
              <dd className="mt-0.5 text-sm text-gray-900">
                {request.approvedByUser.firstName} {request.approvedByUser.lastName}
              </dd>
            </div>
          )}
        </dl>
        {request.missionAssignment && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Mission Assignment</dt>
            <dd className="text-sm text-gray-700">{request.missionAssignment}</dd>
          </div>
        )}
        {request.justification && (
          <div className="mt-3">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Justification</dt>
            <dd className="text-sm text-gray-700 whitespace-pre-wrap">{request.justification}</dd>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Resource Line Items ({request.lineItems.length})
        </h2>
        <div className="space-y-3">
          {request.lineItems.map((li) => (
            <LineItemRow
              key={li.id}
              li={li}
              requestId={request.id}
              facilityId={facilityId}
              incidentId={incidentId!}
              canFulfill={canFulfill}
            />
          ))}
        </div>
      </div>

      {/* Workflow actions */}
      {!['FILLED', 'CANCELLED', 'DENIED'].includes(request.status) && (
        <div className="flex flex-wrap gap-3">
          {request.status === 'DRAFT' && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          )}
          {request.status === 'SUBMITTED' && (
            <>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4 inline mr-1.5" />
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </button>
              <button
                onClick={() => {
                  if (confirm('Deny this request?')) denyMutation.mutate();
                }}
                disabled={denyMutation.isPending}
                className="px-5 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 inline mr-1.5" />
                {denyMutation.isPending ? 'Denying…' : 'Deny'}
              </button>
            </>
          )}
          {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(request.status) && (
            <button
              onClick={() => {
                if (confirm('Cancel this request? This cannot be undone.')) cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Request'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
