/**
 * Add Cost Slide-Over
 * Handles all 5 cost types: LABOR, EQUIPMENT, SUPPLY, CONTRACT, OVERHEAD
 * Renders different sub-form sections depending on selected cost type.
 * All monetary inputs are validated as non-negative numbers.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, DollarSign } from 'lucide-react';
import { costsApi } from '../../api/costs.api';
import { resourcesApi } from '../../api/resources.api';

const laborSchema = z.object({
  employeeId: z.string().optional(),
  position: z.string().optional(),
  regularHours: z.coerce.number().nonnegative().default(0),
  overtimeHours: z.coerce.number().nonnegative().default(0),
  regularRate: z.coerce.number().nonnegative().default(0),
  overtimeRate: z.coerce.number().nonnegative().optional(),
  benefits: z.coerce.number().nonnegative().default(0),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

const equipmentSchema = z.object({
  equipmentType: z.string().min(1).optional(),
  equipmentIdentifier: z.string().optional(),
  hours: z.coerce.number().nonnegative().default(0),
  dailyRate: z.coerce.number().nonnegative().default(0),
  mileage: z.coerce.number().nonnegative().default(0),
  mileageRate: z.coerce.number().nonnegative().default(0),
  operator: z.string().optional(),
  incidentResourceId: z.string().uuid().optional(),
});

const schema = z.object({
  costType: z.enum(['LABOR', 'EQUIPMENT', 'SUPPLY', 'CONTRACT', 'OVERHEAD']),
  femaPACategory: z.enum(['CAT_A', 'CAT_B', 'CAT_C', 'CAT_D', 'CAT_E', 'CAT_F', 'CAT_G', 'CAT_Z']),
  description: z.string().min(1, 'Description required'),
  quantity: z.coerce.number().positive().default(1),
  unitCost: z.coerce.number().nonnegative(),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  incurredAt: z.string().min(1, 'Date required'),
  notes: z.string().optional(),
  labor: laborSchema.optional(),
  equipment: equipmentSchema.optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  facilityId: string;
  incidentId: string;
  onClose: () => void;
  onAdded: () => void;
}

const FEMA_CATEGORIES = [
  { value: 'CAT_B', label: 'B — Emergency Protective Measures' },
  { value: 'CAT_A', label: 'A — Debris Removal' },
  { value: 'CAT_E', label: 'E — Buildings & Equipment' },
  { value: 'CAT_F', label: 'F — Utilities' },
  { value: 'CAT_G', label: 'G — Parks & Other' },
  { value: 'CAT_C', label: 'C — Roads & Bridges' },
  { value: 'CAT_D', label: 'D — Water Control' },
  { value: 'CAT_Z', label: 'Z — Management Costs (≤5%)' },
];

export function AddCostSlideOver({ facilityId, incidentId, onClose, onAdded }: Props) {
  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      costType: 'LABOR',
      femaPACategory: 'CAT_B',
      quantity: 1,
      unitCost: 0,
    },
  });

  const costType = watch('costType');
  const regularHours = watch('labor.regularHours') ?? 0;
  const overtimeHours = watch('labor.overtimeHours') ?? 0;
  const regularRate = watch('labor.regularRate') ?? 0;
  const overtimeRate = watch('labor.overtimeRate');
  const benefits = watch('labor.benefits') ?? 0;

  // Auto-compute labor unitCost / total
  useEffect(() => {
    if (costType === 'LABOR') {
      const otRate = overtimeRate ?? regularRate * 1.5;
      const labor = regularHours * regularRate + overtimeHours * otRate + benefits;
      setValue('unitCost', parseFloat(labor.toFixed(4)));
      setValue('quantity', 1);
    }
  }, [costType, regularHours, overtimeHours, regularRate, overtimeRate, benefits, setValue]);

  const { data: incidentResources = [] } = useQuery({
    queryKey: ['incident-resources-for-cost', incidentId],
    queryFn: async () => {
      const res = await resourcesApi.list(facilityId, incidentId, { status: 'ASSIGNED' });
      return res.data as Array<{ id: string; name: string; nimsKind: string }>;
    },
    enabled: costType === 'EQUIPMENT',
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        ...data,
        incurredAt: new Date(data.incurredAt).toISOString(),
        labor: costType === 'LABOR' ? data.labor : undefined,
        equipment: costType === 'EQUIPMENT' ? data.equipment : undefined,
      };
      return costsApi.create(facilityId, incidentId, payload);
    },
    onSuccess: onAdded,
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Add Cost Record</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((d) => createMutation.mutate(d))}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {/* Cost type + FEMA category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Type *</label>
              <select {...register('costType')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {['LABOR', 'EQUIPMENT', 'SUPPLY', 'CONTRACT', 'OVERHEAD'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">FEMA PA Category *</label>
              <select {...register('femaPACategory')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                {FEMA_CATEGORIES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input
              {...register('description')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder={
                costType === 'LABOR' ? 'Employee name or role description' :
                costType === 'EQUIPMENT' ? 'Equipment description' :
                'Cost item description'
              }
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
          </div>

          {/* Date incurred */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Incurred *</label>
            <input
              type="datetime-local"
              {...register('incurredAt')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            {errors.incurredAt && <p className="text-xs text-red-600 mt-1">{errors.incurredAt.message}</p>}
          </div>

          {/* ── LABOR sub-form ── */}
          {costType === 'LABOR' && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase">Labor Detail</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
                  <input {...register('labor.employeeId')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Position / Role</label>
                  <input {...register('labor.position')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Regular Hours</label>
                  <input type="number" step="0.25" {...register('labor.regularHours')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">OT Hours</label>
                  <input type="number" step="0.25" {...register('labor.overtimeHours')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Regular Rate ($/hr)</label>
                  <input type="number" step="0.01" {...register('labor.regularRate')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">OT Rate ($/hr)</label>
                  <input type="number" step="0.01" {...register('labor.overtimeRate')} placeholder="auto 1.5×" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Benefits ($)</label>
                  <input type="number" step="0.01" {...register('labor.benefits')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <p className="text-xs text-blue-600 font-medium">
                Computed total: ${(watch('unitCost') ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {/* ── EQUIPMENT sub-form ── */}
          {costType === 'EQUIPMENT' && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
              <p className="text-xs font-semibold text-amber-700 uppercase">Equipment Detail</p>
              {incidentResources.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Link to Incident Resource</label>
                  <select {...register('equipment.incidentResourceId')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm">
                    <option value="">— ad hoc equipment —</option>
                    {incidentResources.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Equipment Type *</label>
                  <input {...register('equipment.equipmentType')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" placeholder="e.g. Generator, Ambulance" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Identifier</label>
                  <input {...register('equipment.equipmentIdentifier')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hours Used</label>
                  <input type="number" step="0.25" {...register('equipment.hours')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Daily Rate ($)</label>
                  <input type="number" step="0.01" {...register('equipment.dailyRate')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mileage</label>
                  <input type="number" step="0.1" {...register('equipment.mileage')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mileage Rate ($/mi)</label>
                  <input type="number" step="0.001" {...register('equipment.mileageRate')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* ── Generic cost fields (all types) ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {costType === 'LABOR' ? 'Total Labor Cost (auto)' : 'Unit Cost ($)'}
              </label>
              <input
                type="number"
                step="0.01"
                {...register('unitCost')}
                readOnly={costType === 'LABOR'}
                className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm ${costType === 'LABOR' ? 'bg-gray-50 text-gray-600' : ''}`}
              />
            </div>
            {costType !== 'LABOR' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" step="0.001" {...register('quantity')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
            )}
          </div>

          {/* Vendor + invoice */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <input {...register('vendor')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
              <input {...register('invoiceNumber')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...register('notes')} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>

          {createMutation.isError && (
            <p className="text-sm text-red-600">
              {(createMutation.error as any)?.response?.data?.message ?? 'Failed to save cost record'}
            </p>
          )}
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit((d) => createMutation.mutate(d))}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving…' : 'Save Cost Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
