/**
 * Quick Add Resource Panel — slide-over form for adding a resource directly
 * to an incident (ORDERED status) without going through 213RR workflow.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { resourcesApi } from '../../api/resources.api';

const schema = z.object({
  name: z.string().min(1, 'Resource name is required'),
  nimsKind: z.enum(['PERSONNEL', 'EQUIPMENT', 'TEAM', 'SUPPLY', 'FACILITIES', 'OTHER']),
  resourceTypeId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().default('each'),
  source: z.enum(['INTERNAL', 'MUTUAL_AID', 'CONTRACTED', 'DONATED']).default('INTERNAL'),
  resourceIdentifier: z.string().optional(),
  homeBaseOrgName: z.string().optional(),
  eta: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  facilityId: string;
  incidentId: string;
  onClose: () => void;
  onAdded: () => void;
}

const NIMS_KINDS = ['PERSONNEL', 'EQUIPMENT', 'TEAM', 'SUPPLY', 'FACILITIES', 'OTHER'];
const SOURCES = ['INTERNAL', 'MUTUAL_AID', 'CONTRACTED', 'DONATED'];

export function QuickAddPanel({ facilityId, incidentId, onClose, onAdded }: Props) {
  const { data: types = [] } = useQuery({
    queryKey: ['resource-types', facilityId],
    queryFn: async () => {
      const res = await resourcesApi.listTypes(facilityId);
      return res.data as Array<{ id: string; name: string; nimsKind: string; unit: string }>;
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nimsKind: 'PERSONNEL', source: 'INTERNAL', quantity: 1, unit: 'each' },
  });

  const selectedKind = watch('nimsKind');
  const filteredTypes = types.filter((t) => t.nimsKind === selectedKind);

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      resourcesApi.create(facilityId, incidentId, {
        ...data,
        eta: data.eta ? new Date(data.eta).toISOString() : undefined,
      }),
    onSuccess: onAdded,
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Resource</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* NIMS Kind */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NIMS Kind *</label>
            <select
              {...register('nimsKind')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {NIMS_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Resource Type (catalog) */}
          {filteredTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type (catalog)</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                onChange={(e) => {
                  const type = filteredTypes.find((t) => t.id === e.target.value);
                  if (type) {
                    setValue('resourceTypeId', type.id);
                    setValue('name', type.name);
                    setValue('unit', type.unit);
                  } else {
                    setValue('resourceTypeId', undefined);
                  }
                }}
              >
                <option value="">— ad hoc (no catalog type) —</option>
                {filteredTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resource Name *</label>
            <input
              {...register('name')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Ambulance Unit 14"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          {/* Qty + Unit row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                {...register('quantity')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                {...register('unit')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="each"
              />
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              {...register('source')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Identifier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identifier (asset tag / plate)</label>
            <input
              {...register('resourceIdentifier')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>

          {/* Home base */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Home Base Organization</label>
            <input
              {...register('homeBaseOrgName')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>

          {/* ETA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Arrival (ETA)</label>
            <input
              type="datetime-local"
              {...register('eta')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Optional notes..."
            />
          </div>

          {createMutation.isError && (
            <p className="text-sm text-red-600">Failed to add resource. Please try again.</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit((d) => createMutation.mutate(d))}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Adding…' : 'Add Resource'}
          </button>
        </div>
      </div>
    </div>
  );
}
