import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { incidentsApi, CreateIncidentDto } from '../../api/incidents.api';

const schema = z.object({
  name: z.string().min(3, 'Name required'),
  incidentType: z.string().min(1, 'Type required'),
  severity: z.string().min(1, 'Severity required'),
  declarationTime: z.string().min(1, 'Declaration time required'),
  location: z.string().optional(),
  description: z.string().optional(),
  isExercise: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

const INCIDENT_TYPES: { value: string; label: string }[] = [
  { value: 'MASS_CASUALTY', label: 'Mass Casualty' },
  { value: 'NATURAL_DISASTER', label: 'Natural Disaster' },
  { value: 'HAZMAT', label: 'Hazmat' },
  { value: 'CYBER_ATTACK', label: 'Cyber Attack' },
  { value: 'UTILITY_FAILURE', label: 'Utility Failure' },
  { value: 'INFECTIOUS_DISEASE', label: 'Infectious Disease' },
  { value: 'ACTIVE_THREAT', label: 'Active Threat' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
  { value: 'PLANNED_EVENT', label: 'Planned Event' },
  { value: 'OTHER', label: 'Other' },
];

interface Props {
  facilityId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateIncidentModal({ facilityId, onClose, onCreated }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      declarationTime: new Date().toISOString().slice(0, 16),
      isExercise: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateIncidentDto) => incidentsApi.create(facilityId, data),
    onSuccess: onCreated,
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      ...values,
      declarationTime: new Date(values.declarationTime).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-red-50">
          <div>
            <h2 className="text-lg font-bold text-red-900">Declare Incident</h2>
            <p className="text-xs text-red-700 mt-0.5">Create a new incident and activate the HICS command structure</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Incident Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Incident Name *</label>
            <input
              {...register('name')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="e.g. Mass Casualty Event – ED Overflow"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type *</label>
              <select {...register('incidentType')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500">
                <option value="">Select type…</option>
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {errors.incidentType && <p className="text-xs text-red-600 mt-1">{errors.incidentType.message}</p>}
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
              <select {...register('severity')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500">
                <option value="">Select level…</option>
                <option value="LEVEL_1">Level 1 — Major</option>
                <option value="LEVEL_2">Level 2 — Moderate</option>
                <option value="LEVEL_3">Level 3 — Minor</option>
                <option value="EXERCISE">Exercise / Drill</option>
              </select>
              {errors.severity && <p className="text-xs text-red-600 mt-1">{errors.severity.message}</p>}
            </div>
          </div>

          {/* Declaration Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Declaration Date/Time *</label>
            <input
              type="datetime-local"
              {...register('declarationTime')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            />
            {errors.declarationTime && <p className="text-xs text-red-600 mt-1">{errors.declarationTime.message}</p>}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              {...register('location')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
              placeholder="e.g. Emergency Department, Building B"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Situation Summary</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
              placeholder="Brief description of the incident…"
            />
          </div>

          {/* Exercise toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('isExercise')}
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">This is a drill / exercise (not a real incident)</span>
          </label>

          {/* Error */}
          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              Failed to declare incident: {(mutation.error as Error)?.message ?? 'Unknown error'}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Declaring…' : 'Declare Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
