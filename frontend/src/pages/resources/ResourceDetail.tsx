/**
 * Incident Resource Detail
 * Shows resource metadata, current status, status history timeline,
 * active assignment, and linked cost records.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, Clock, MapPin, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { resourcesApi } from '../../api/resources.api';
import StatusTransitionModal from '../../components/resources/StatusTransitionModal';

interface StatusHistory {
  id: string;
  fromStatus?: string;
  toStatus: string;
  reason?: string;
  location?: string;
  changedAt: string;
  changedByUser: { firstName: string; lastName: string };
}

interface ResourceAssignment {
  id: string;
  operationalPeriod: { periodNumber: number; name?: string };
  assignedToSection?: string;
  assignedToRole?: string;
  assignedToLocation?: string;
  assignedAt: string;
  releasedAt?: string;
}

interface IncidentResource {
  id: string;
  status: string;
  source: string;
  name: string;
  quantity: number;
  unit: string;
  vendor?: string;
  eta?: string;
  orderedAt?: string;
  arrivedAt?: string;
  assignedAt?: string;
  demobilizedAt?: string;
  assignedToSection?: string;
  assignedToRole?: string;
  assignedToLocation?: string;
  notes?: string;
  resourceType?: { name: string; nimsKind: string; nimsType?: string };
  mutualAidAgreement?: { partnerOrganizationName: string; agreementType: string };
  requestLineItem?: { resourceRequest: { requestNumber: string; id: string } };
  statusHistory: StatusHistory[];
  assignments: ResourceAssignment[];
}

const STATUS_COLORS: Record<string, string> = {
  ORDERED: 'bg-gray-100 text-gray-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  ASSIGNED: 'bg-purple-100 text-purple-700',
  AVAILABLE: 'bg-green-100 text-green-700',
  OUT_OF_SERVICE: 'bg-red-100 text-red-700',
  DEMOBILIZED: 'bg-gray-100 text-gray-400',
};

const STATUS_DOTS: Record<string, string> = {
  ORDERED: 'bg-gray-400',
  IN_TRANSIT: 'bg-blue-500',
  ASSIGNED: 'bg-purple-500',
  AVAILABLE: 'bg-green-500',
  OUT_OF_SERVICE: 'bg-red-500',
  DEMOBILIZED: 'bg-gray-300',
};

export default function ResourceDetail() {
  const { incidentId, resourceId } = useParams<{ incidentId: string; resourceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';
  const queryClient = useQueryClient();
  const [showTransition, setShowTransition] = useState(false);

  const { data: resource, isLoading, isError } = useQuery({
    queryKey: ['incident-resource', resourceId],
    queryFn: async () => {
      const res = await resourcesApi.get(facilityId, incidentId!, resourceId!);
      return res.data as IncidentResource;
    },
    enabled: !!facilityId && !!incidentId && !!resourceId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['resource-history', resourceId],
    queryFn: async () => {
      const res = await resourcesApi.history(facilityId, incidentId!, resourceId!);
      return res.data as StatusHistory[];
    },
    enabled: !!facilityId && !!incidentId && !!resourceId,
  });

  const onTransitionSuccess = () => {
    setShowTransition(false);
    queryClient.invalidateQueries({ queryKey: ['incident-resource', resourceId] });
    queryClient.invalidateQueries({ queryKey: ['resource-history', resourceId] });
    queryClient.invalidateQueries({ queryKey: ['incident-resources', incidentId] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (isError || !resource) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Resource not found.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-brand-600 hover:underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  const isDemobilized = resource.status === 'DEMOBILIZED';
  const isOverdue = resource.eta && new Date(resource.eta) < new Date() && resource.status === 'IN_TRANSIT';

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/incidents/${incidentId}/resources`)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-5"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Resource Board
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{resource.name}</h1>
            <p className="text-sm text-gray-500">
              {resource.resourceType
                ? `${resource.resourceType.name} · ${resource.resourceType.nimsKind}`
                : resource.source}
              {resource.resourceType?.nimsType && ` (${resource.resourceType.nimsType})`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[resource.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {resource.status.replace(/_/g, ' ')}
          </span>
          {!isDemobilized && (
            <button
              onClick={() => setShowTransition(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
            >
              Update Status
            </button>
          )}
        </div>
      </div>

      {/* ETA alert */}
      {isOverdue && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠ ETA overdue — expected {new Date(resource.eta!).toLocaleString()} and still in transit
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Resource Details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</dt>
            <dd className="mt-0.5 text-sm text-gray-900">{resource.quantity} {resource.unit}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Source</dt>
            <dd className="mt-0.5 text-sm text-gray-900">{resource.source.replace(/_/g, ' ')}</dd>
          </div>
          {resource.vendor && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{resource.vendor}</dd>
            </div>
          )}
          {resource.eta && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">ETA</dt>
              <dd className={`mt-0.5 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                {new Date(resource.eta).toLocaleString()}
              </dd>
            </div>
          )}
          {resource.orderedAt && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{new Date(resource.orderedAt).toLocaleString()}</dd>
            </div>
          )}
          {resource.arrivedAt && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Arrived</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{new Date(resource.arrivedAt).toLocaleString()}</dd>
            </div>
          )}
          {resource.demobilizedAt && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Demobilized</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{new Date(resource.demobilizedAt).toLocaleString()}</dd>
            </div>
          )}
          {resource.mutualAidAgreement && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Mutual Aid</dt>
              <dd className="mt-0.5 text-sm text-gray-900">
                {resource.mutualAidAgreement.partnerOrganizationName} ({resource.mutualAidAgreement.agreementType})
              </dd>
            </div>
          )}
          {resource.requestLineItem && (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">From Request</dt>
              <dd className="mt-0.5 text-sm text-brand-600">
                {resource.requestLineItem.resourceRequest.requestNumber}
              </dd>
            </div>
          )}
        </dl>
        {resource.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</dt>
            <dd className="text-sm text-gray-700 whitespace-pre-wrap">{resource.notes}</dd>
          </div>
        )}
      </div>

      {/* Current assignment */}
      {resource.status === 'ASSIGNED' && (resource.assignedToSection || resource.assignedToRole || resource.assignedToLocation) && (
        <div className="bg-purple-50 rounded-xl border border-purple-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-purple-800 uppercase tracking-wide mb-3">Current Assignment</h2>
          <div className="flex flex-wrap gap-6 text-sm">
            {resource.assignedToSection && (
              <div>
                <p className="text-xs text-purple-600 font-medium">Section</p>
                <p className="text-gray-900">{resource.assignedToSection}</p>
              </div>
            )}
            {resource.assignedToRole && (
              <div>
                <p className="text-xs text-purple-600 font-medium">Role</p>
                <p className="text-gray-900">{resource.assignedToRole}</p>
              </div>
            )}
            {resource.assignedToLocation && (
              <div>
                <p className="text-xs text-purple-600 font-medium">Location</p>
                <p className="text-gray-900">{resource.assignedToLocation}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status history timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Status History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No history available.</p>
        ) : (
          <ol className="relative ml-2">
            {history.map((entry, idx) => (
              <li key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                {/* Timeline line */}
                {idx < history.length - 1 && (
                  <div className="absolute left-[5px] top-3 bottom-0 w-0.5 bg-gray-200" />
                )}
                {/* Dot */}
                <div className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${STATUS_DOTS[entry.toStatus] ?? 'bg-gray-300'}`} />

                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {entry.fromStatus && (
                        <>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${STATUS_COLORS[entry.fromStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                            {entry.fromStatus.replace(/_/g, ' ')}
                          </span>
                          <ChevronRight className="h-3 w-3 text-gray-400" />
                        </>
                      )}
                      <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${STATUS_COLORS[entry.toStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {entry.toStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {entry.reason && <p className="text-xs text-gray-600 mt-0.5">{entry.reason}</p>}
                    {entry.location && (
                      <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <MapPin className="h-3 w-3" /> {entry.location}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-400 flex-shrink-0">
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.changedAt).toLocaleString()}
                    </p>
                    <p>{entry.changedByUser.firstName} {entry.changedByUser.lastName}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Assignment history */}
      {resource.assignments && resource.assignments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Assignment History</h2>
          <div className="space-y-3">
            {resource.assignments.map((asgn) => (
              <div key={asgn.id} className="flex items-center gap-4 text-sm">
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">
                    Period {asgn.operationalPeriod.periodNumber}
                    {asgn.operationalPeriod.name && ` — ${asgn.operationalPeriod.name}`}
                  </p>
                  {(asgn.assignedToSection || asgn.assignedToRole) && (
                    <p className="text-xs text-gray-500">
                      {[asgn.assignedToSection, asgn.assignedToRole, asgn.assignedToLocation].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-400 text-right">
                  <p>{new Date(asgn.assignedAt).toLocaleDateString()}</p>
                  {asgn.releasedAt && <p>Released {new Date(asgn.releasedAt).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transition modal */}
      {showTransition && resource && (
        <StatusTransitionModal
          resource={{ id: resource.id, status: resource.status as any, name: resource.name }}
          facilityId={facilityId}
          incidentId={incidentId!}
          onClose={() => setShowTransition(false)}
          onSuccess={onTransitionSuccess}
        />
      )}
    </div>
  );
}
