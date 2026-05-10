/**
 * ICS-213RR Resource Request Form
 * Create a new resource request with line items.
 */

import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft, ClipboardList, Send } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { requestsApi } from '../../api/requests.api';
import { resourcesApi } from '../../api/resources.api';

const lineItemSchema = z.object({
  resourceTypeId: z.string().uuid().optional(),
  resourceDescription: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unit: z.string().default('each'),
  estimatedUnitCost: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const schema = z.object({
  priority: z.enum(['IMMEDIATE', 'PRIORITY', 'ROUTINE']),
  missionAssignment: z.string().optional(),
  requestedForRole: z.string().optional(),
  requestedForSection: z.string().optional(),
  deliveryLocation: z.string().optional(),
  deliveryBy: z.string().optional(),
  neededDate: z.string().optional(),
  justification: z.string().optional(),
  suitableSubstitutes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
});

type FormValues = z.infer<typeof schema>;

const HICS_SECTIONS = [
  'Command', 'Operations', 'Planning', 'Logistics', 'Finance/Administration',
];

export default function RequestForm213RR() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const facilityId = user?.primaryFacilityId ?? user?.facilityIds?.[0] ?? '';
  const submitIntentRef = useRef<'draft' | 'submit'>('draft');

  const { data: resourceTypes = [] } = useQuery({
    queryKey: ['resource-types', facilityId],
    queryFn: async () => {
      const res = await resourcesApi.listTypes(facilityId);
      return res.data as Array<{ id: string; name: string; nimsKind: string; unit: string; defaultCostPerUnit?: string }>;
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'ROUTINE',
      lineItems: [{ resourceDescription: '', quantity: 1, unit: 'each' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const result = await requestsApi.create(facilityId, incidentId!, {
        ...data,
        deliveryBy: data.deliveryBy ? new Date(data.deliveryBy).toISOString() : undefined,
        neededDate: data.neededDate ? new Date(data.neededDate).toISOString() : undefined,
      });
      if (submitIntentRef.current === 'submit' && result.data?.id) {
        await requestsApi.submit(facilityId, incidentId!, result.data.id as string);
      }
      return result;
    },
    onSuccess: () => {
      navigate(`/incidents/${incidentId}/requests`);
    },
  });

  // Watch line items for cost preview
  const lineItems = watch('lineItems');
  const estimatedTotal = lineItems.reduce((sum, li) => {
    const cost = (li.estimatedUnitCost ?? 0) * (li.quantity ?? 0);
    return sum + cost;
  }, 0);

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Back link */}
      <button
        onClick={() => navigate(`/incidents/${incidentId}/requests`)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-5"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Requests
      </button>

      <div className="flex items-center gap-2 mb-6">
        <ClipboardList className="h-6 w-6 text-gray-600" />
        <h1 className="text-xl font-bold text-gray-900">New Resource Request — ICS Form 213RR</h1>
      </div>

      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-6">
        {/* Header section */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Request Header</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
              <select
                {...register('priority')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ROUTINE">Routine</option>
                <option value="PRIORITY">Priority</option>
                <option value="IMMEDIATE">Immediate</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requesting Section</label>
              <select
                {...register('requestedForSection')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">— select —</option>
                {HICS_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mission Assignment</label>
            <input
              {...register('missionAssignment')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Describe the mission or activity these resources will support"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location</label>
              <input
                {...register('deliveryLocation')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. ED Loading Dock, Command Post"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Needed By</label>
              <input
                type="datetime-local"
                {...register('neededDate')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Special Instructions</label>
            <textarea
              {...register('justification')}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Explain why these resources are needed..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suitable Substitutes and/or Suggested Sources</label>
            <textarea
              {...register('suitableSubstitutes')}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="List acceptable substitutes or vendors/sources for the requested resources..."
            />
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resource Line Items</h2>
            <button
              type="button"
              onClick={() => append({ resourceDescription: '', quantity: 1, unit: 'each' })}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>

          {errors.lineItems?.message && (
            <p className="text-xs text-red-600">{errors.lineItems.message}</p>
          )}

          <div className="space-y-4">
            {fields.map((field, idx) => (
              <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Item #{idx + 1}</span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Catalog type selector */}
                {resourceTypes.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Resource Type (catalog — optional)
                    </label>
                    <select
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm bg-white"
                      onChange={(e) => {
                        const type = resourceTypes.find((t) => t.id === e.target.value);
                        if (type) {
                          setValue(`lineItems.${idx}.resourceTypeId`, type.id);
                          setValue(`lineItems.${idx}.resourceDescription`, type.name);
                          setValue(`lineItems.${idx}.unit`, type.unit);
                          if (type.defaultCostPerUnit) {
                            setValue(`lineItems.${idx}.estimatedUnitCost`, parseFloat(type.defaultCostPerUnit));
                          }
                        }
                      }}
                    >
                      <option value="">— ad hoc resource —</option>
                      {resourceTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.nimsKind})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                  <input
                    {...register(`lineItems.${idx}.resourceDescription`)}
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                    placeholder="Describe the resource needed"
                  />
                  {errors.lineItems?.[idx]?.resourceDescription && (
                    <p className="text-xs text-red-600 mt-0.5">
                      {errors.lineItems[idx]?.resourceDescription?.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                    <input
                      type="number"
                      {...register(`lineItems.${idx}.quantity`)}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                    <input
                      {...register(`lineItems.${idx}.unit`)}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                      placeholder="each"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Est. Cost/Unit ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`lineItems.${idx}.estimatedUnitCost`)}
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input
                    {...register(`lineItems.${idx}.notes`)}
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm"
                    placeholder="Specifications, brand, size, etc."
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Estimated total */}
          {estimatedTotal > 0 && (
            <div className="text-right text-sm font-semibold text-gray-700">
              Estimated Total: ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>

        {/* Submit */}
        {createMutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {(createMutation.error as any)?.message ?? 'Failed to create request. Please try again.'}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(`/incidents/${incidentId}/requests`)}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            onClick={() => { submitIntentRef.current = 'draft'; }}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {createMutation.isPending && submitIntentRef.current === 'draft' ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            onClick={() => { submitIntentRef.current = 'submit'; }}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {createMutation.isPending && submitIntentRef.current === 'submit' ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}
