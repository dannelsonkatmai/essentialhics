/**
 * Cost Record Detail
 * Shows a single cost record with its sub-type details (labor/equipment) and audit trail.
 */

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, DollarSign, CircleCheck as CheckCircle, Clock, User, Wrench } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { costsApi } from '../../api/costs.api';

interface LaborCostRecord {
  personnelName: string;
  role?: string;
  regularHours?: string;
  overtimeHours?: string;
  regularRate?: string;
  overtimeRate?: string;
  benefits?: string;
}

interface EquipmentCostRecord {
  equipmentDescription: string;
  equipmentId?: string;
  hoursUsed?: string;
  hourlyRate?: string;
  mileage?: string;
  mileageRate?: string;
}

interface CostRecord {
  id: string;
  costType: string;
  femaPaCategory: string;
  description: string;
  quantity: string;
  unitPeriod: string;
  unitCost: string;
  totalCost: string;
  date: string;
  vendor?: string;
  invoiceNumber?: string;
  notes?: string;
  isApproved: boolean;
  approvedAt?: string;
  approvedByUser?: { firstName: string; lastName: string };
  submittedByUser?: { firstName: string; lastName: string };
  operationalPeriod?: { periodNumber: number; name?: string };
  laborRecord?: LaborCostRecord;
  equipmentRecord?: EquipmentCostRecord;
  createdAt: string;
}

const FEMA_LABELS: Record<string, string> = {
  CAT_A: 'CAT A — Debris Removal',
  CAT_B: 'CAT B — Emergency Protective Measures',
  CAT_C: 'CAT C — Roads & Bridges',
  CAT_D: 'CAT D — Water Control',
  CAT_E: 'CAT E — Buildings & Equipment',
  CAT_F: 'CAT F — Utilities',
  CAT_G: 'CAT G — Parks & Recreation',
  CAT_Z: 'CAT Z — Management Costs (5% cap)',
};

const COST_TYPE_LABELS: Record<string, string> = {
  LABOR: 'Labor',
  EQUIPMENT: 'Equipment',
  SUPPLY: 'Supply',
  CONTRACT: 'Contract',
  OTHER: 'Other',
};

const COST_TYPE_ICONS: Record<string, React.ReactNode> = {
  LABOR: <User className="h-5 w-5" />,
  EQUIPMENT: <Wrench className="h-5 w-5" />,
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  );
}

export default function CostDetail() {
  const { incidentId, costId } = useParams<{ incidentId: string; costId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';
  const queryClient = useQueryClient();

  const { data: cost, isLoading, isError } = useQuery({
    queryKey: ['cost', costId],
    queryFn: async () => {
      const res = await costsApi.get(facilityId, incidentId!, costId!);
      return res.data as unknown as CostRecord;
    },
    enabled: !!facilityId && !!incidentId && !!costId,
  });

  const approveMutation = useMutation({
    mutationFn: () => costsApi.approve(facilityId, incidentId!, costId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost', costId] });
      queryClient.invalidateQueries({ queryKey: ['costs', incidentId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (isError || !cost) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Cost record not found.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-brand-600 hover:underline mt-2">
          Go back
        </button>
      </div>
    );
  }

  const totalFormatted = `$${parseFloat(cost.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const unitCostFormatted = `$${parseFloat(cost.unitCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/incidents/${incidentId}/costs`)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-5"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Cost Ledger
      </button>

      {/* Title bar */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${cost.costType === 'LABOR' ? 'bg-blue-50 text-blue-600' : cost.costType === 'EQUIPMENT' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
            {COST_TYPE_ICONS[cost.costType] ?? <DollarSign className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{cost.description}</h1>
            <p className="text-sm text-gray-500">
              {COST_TYPE_LABELS[cost.costType] ?? cost.costType} ·{' '}
              {FEMA_LABELS[cost.femaPaCategory] ?? cost.femaPaCategory}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{totalFormatted}</p>
          {cost.isApproved ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full mt-1">
              <CheckCircle className="h-3 w-3" /> Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full mt-1">
              <Clock className="h-3 w-3" /> Pending Approval
            </span>
          )}
        </div>
      </div>

      {/* Core details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Record Details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Date" value={new Date(cost.date).toLocaleDateString()} />
          <Field label="Unit Cost" value={unitCostFormatted} />
          <Field label="Quantity" value={`${cost.quantity} ${cost.unitPeriod}`} />
          <Field
            label="Operational Period"
            value={cost.operationalPeriod
              ? `Period ${cost.operationalPeriod.periodNumber}${cost.operationalPeriod.name ? ` — ${cost.operationalPeriod.name}` : ''}`
              : 'N/A'}
          />
          <Field label="Vendor" value={cost.vendor} />
          <Field label="Invoice #" value={cost.invoiceNumber} />
        </dl>
        {cost.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</dt>
            <dd className="text-sm text-gray-700 whitespace-pre-wrap">{cost.notes}</dd>
          </div>
        )}
      </div>

      {/* Labor sub-record */}
      {cost.laborRecord && (
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-4">Labor Details</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-xs font-medium text-blue-600 uppercase tracking-wider">Personnel</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{cost.laborRecord.personnelName}</dd>
            </div>
            {cost.laborRecord.role && (
              <div>
                <dt className="text-xs font-medium text-blue-600 uppercase tracking-wider">Role</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{cost.laborRecord.role}</dd>
              </div>
            )}
            {cost.laborRecord.regularHours != null && (
              <div>
                <dt className="text-xs font-medium text-blue-600 uppercase tracking-wider">Regular Hours</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{cost.laborRecord.regularHours}</dd>
              </div>
            )}
            {cost.laborRecord.overtimeHours != null && parseFloat(cost.laborRecord.overtimeHours) > 0 && (
              <div>
                <dt className="text-xs font-medium text-blue-600 uppercase tracking-wider">Overtime Hours</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{cost.laborRecord.overtimeHours}</dd>
              </div>
            )}
            {cost.laborRecord.regularRate != null && (
              <div>
                <dt className="text-xs font-medium text-blue-600 uppercase tracking-wider">Regular Rate</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  ${parseFloat(cost.laborRecord.regularRate).toFixed(2)}/hr
                </dd>
              </div>
            )}
            {cost.laborRecord.overtimeRate != null && parseFloat(cost.laborRecord.overtimeRate) > 0 && (
              <div>
                <dt className="text-xs font-medium text-blue-600 uppercase tracking-wider">OT Rate</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  ${parseFloat(cost.laborRecord.overtimeRate).toFixed(2)}/hr
                </dd>
              </div>
            )}
            {cost.laborRecord.benefits != null && parseFloat(cost.laborRecord.benefits) > 0 && (
              <div>
                <dt className="text-xs font-medium text-blue-600 uppercase tracking-wider">Benefits</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  ${parseFloat(cost.laborRecord.benefits).toFixed(2)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Equipment sub-record */}
      {cost.equipmentRecord && (
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wide mb-4">Equipment Details</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-xs font-medium text-amber-700 uppercase tracking-wider">Equipment</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{cost.equipmentRecord.equipmentDescription}</dd>
            </div>
            {cost.equipmentRecord.equipmentId && (
              <div>
                <dt className="text-xs font-medium text-amber-700 uppercase tracking-wider">Equipment ID</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{cost.equipmentRecord.equipmentId}</dd>
              </div>
            )}
            {cost.equipmentRecord.hoursUsed != null && (
              <div>
                <dt className="text-xs font-medium text-amber-700 uppercase tracking-wider">Hours Used</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{cost.equipmentRecord.hoursUsed}</dd>
              </div>
            )}
            {cost.equipmentRecord.hourlyRate != null && (
              <div>
                <dt className="text-xs font-medium text-amber-700 uppercase tracking-wider">Hourly Rate</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  ${parseFloat(cost.equipmentRecord.hourlyRate).toFixed(2)}/hr
                </dd>
              </div>
            )}
            {cost.equipmentRecord.mileage != null && parseFloat(cost.equipmentRecord.mileage) > 0 && (
              <div>
                <dt className="text-xs font-medium text-amber-700 uppercase tracking-wider">Mileage</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{cost.equipmentRecord.mileage} mi</dd>
              </div>
            )}
            {cost.equipmentRecord.mileageRate != null && parseFloat(cost.equipmentRecord.mileageRate ?? '0') > 0 && (
              <div>
                <dt className="text-xs font-medium text-amber-700 uppercase tracking-wider">Mileage Rate</dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  ${parseFloat(cost.equipmentRecord.mileageRate!).toFixed(3)}/mi
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Approval / audit */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Audit Trail</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field
            label="Submitted By"
            value={cost.submittedByUser
              ? `${cost.submittedByUser.firstName} ${cost.submittedByUser.lastName}`
              : undefined}
          />
          <Field
            label="Submitted At"
            value={new Date(cost.createdAt).toLocaleString()}
          />
          {cost.isApproved && cost.approvedByUser && (
            <>
              <Field
                label="Approved By"
                value={`${cost.approvedByUser.firstName} ${cost.approvedByUser.lastName}`}
              />
              <Field
                label="Approved At"
                value={cost.approvedAt ? new Date(cost.approvedAt).toLocaleString() : undefined}
              />
            </>
          )}
        </dl>

        {!cost.isApproved && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                if (confirm('Approve this cost record?')) approveMutation.mutate();
              }}
              disabled={approveMutation.isPending}
              className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving…' : 'Approve Record'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
