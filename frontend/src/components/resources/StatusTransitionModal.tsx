/**
 * Status Transition Modal
 * Shows allowed transitions from current status and lets user pick next status + notes.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, X } from 'lucide-react';
import { resourcesApi } from '../../api/resources.api';

type ResourceStatus = 'ORDERED' | 'IN_TRANSIT' | 'ASSIGNED' | 'AVAILABLE' | 'OUT_OF_SERVICE' | 'DEMOBILIZED';

const VALID_TRANSITIONS: Record<ResourceStatus, ResourceStatus[]> = {
  ORDERED:         ['IN_TRANSIT', 'AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  IN_TRANSIT:      ['AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  AVAILABLE:       ['ASSIGNED', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  ASSIGNED:        ['AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED'],
  OUT_OF_SERVICE:  ['AVAILABLE', 'DEMOBILIZED'],
  DEMOBILIZED:     [],
};

const STATUS_LABELS: Record<ResourceStatus, string> = {
  ORDERED:         'Ordered',
  IN_TRANSIT:      'In Transit',
  AVAILABLE:       'Available',
  ASSIGNED:        'Assigned',
  OUT_OF_SERVICE:  'Out of Service',
  DEMOBILIZED:     'Demobilized',
};

const STATUS_COLORS: Record<ResourceStatus, string> = {
  ORDERED:         'bg-gray-100 text-gray-800 border-gray-300',
  IN_TRANSIT:      'bg-blue-100 text-blue-800 border-blue-300',
  AVAILABLE:       'bg-green-100 text-green-800 border-green-300',
  ASSIGNED:        'bg-brand-100 text-brand-800 border-brand-300',
  OUT_OF_SERVICE:  'bg-red-100 text-red-800 border-red-300',
  DEMOBILIZED:     'bg-slate-100 text-slate-700 border-slate-300',
};

interface Resource {
  id: string;
  name: string;
  status: ResourceStatus;
  nimsKind: string;
}

interface Props {
  facilityId: string;
  incidentId: string;
  resource: Resource;
  onClose: () => void;
  onTransitioned: () => void;
}

export function StatusTransitionModal({ facilityId, incidentId, resource, onClose, onTransitioned }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<ResourceStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [assignedToLocation, setAssignedToLocation] = useState('');

  const allowed = VALID_TRANSITIONS[resource.status];

  const transitionMutation = useMutation({
    mutationFn: () =>
      resourcesApi.transition(facilityId, incidentId, resource.id, {
        toStatus: selectedStatus!,
        notes: notes || undefined,
        location: location || undefined,
        assignedToLocation: assignedToLocation || undefined,
      }),
    onSuccess: () => {
      onTransitioned();
    },
  });

  const isDemob = selectedStatus === 'DEMOBILIZED';
  const isAssign = selectedStatus === 'ASSIGNED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Update Resource Status</h2>
            <p className="text-sm text-gray-500 mt-0.5">{resource.name} · {resource.nimsKind}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current status */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="text-xs text-gray-500">Current</div>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[resource.status]}`}>
            {STATUS_LABELS[resource.status]}
          </span>
          <ArrowRight className="h-4 w-4 text-gray-400 ml-auto" />
        </div>

        {/* Status options */}
        {allowed.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            This resource is in a terminal state and cannot be transitioned.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {allowed.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  selectedStatus === status
                    ? `${STATUS_COLORS[status]} border-2 shadow-sm`
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        )}

        {/* Extra fields for assign transition */}
        {isAssign && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Location</label>
            <input
              value={assignedToLocation}
              onChange={(e) => setAssignedToLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. ED Bay 3, Staging Area B"
            />
          </div>
        )}

        {/* Location field for transit/available transitions */}
        {selectedStatus && !isAssign && !isDemob && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
        )}

        {/* Notes */}
        {selectedStatus && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder={isDemob ? 'Reason for demobilization…' : 'Optional notes…'}
            />
          </div>
        )}

        {/* Warning for demob */}
        {isDemob && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            ⚠ Demobilization is final. This resource will be removed from active tracking.
          </div>
        )}

        {transitionMutation.isError && (
          <p className="text-sm text-red-600 mb-3">
            {(transitionMutation.error as any)?.response?.data?.message ?? 'Transition failed'}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => transitionMutation.mutate()}
            disabled={!selectedStatus || transitionMutation.isPending}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              isDemob
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {transitionMutation.isPending ? 'Updating…' : `Mark ${selectedStatus ? STATUS_LABELS[selectedStatus] : '…'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
