import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { personnelLibraryApi } from '../../../api/personnelLibrary.api';
import { HICS_ROLE_LABELS } from '../../../types';
import type { PersonnelRecord } from '../../../types';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  title: z.string().optional(),
  defaultHicsRole: z.string().optional(),
  phoneMobile: z.string().optional(),
  phoneWork: z.string().optional(),
  pagerNumber: z.string().optional(),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  agency: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  facilityId: string;
  existing?: PersonnelRecord;
  onClose: () => void;
}

export default function AddPersonnelSlideOver({ facilityId, existing, onClose }: Props) {
  const qc = useQueryClient();
  const isEdit = !!existing;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          firstName: existing.firstName,
          lastName: existing.lastName,
          title: existing.title ?? '',
          defaultHicsRole: existing.defaultHicsRole ?? '',
          phoneMobile: existing.phoneMobile ?? '',
          phoneWork: existing.phoneWork ?? '',
          pagerNumber: existing.pagerNumber ?? '',
          email: existing.email ?? '',
          agency: existing.agency ?? '',
          notes: existing.notes ?? '',
        }
      : {},
  });

  const save = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        title: data.title || undefined,
        defaultHicsRole: (data.defaultHicsRole || undefined) as any,
        phoneMobile: data.phoneMobile || undefined,
        phoneWork: data.phoneWork || undefined,
        pagerNumber: data.pagerNumber || undefined,
        email: data.email || undefined,
        agency: data.agency || undefined,
        notes: data.notes || undefined,
        isActive: true,
      };
      return isEdit
        ? personnelLibraryApi.update(existing!.id, payload)
        : personnelLibraryApi.create(facilityId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel', facilityId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit personnel record' : 'Add personnel record'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="add-personnel-form"
          onSubmit={handleSubmit(d => save.mutate(d))}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input {...register('firstName')} className={`input ${errors.firstName ? 'input-error' : ''}`} />
              {errors.firstName && <p className="error-text">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last name</label>
              <input {...register('lastName')} className={`input ${errors.lastName ? 'input-error' : ''}`} />
              {errors.lastName && <p className="error-text">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Job title</label>
            <input {...register('title')} className="input" placeholder="e.g. Emergency Manager" />
          </div>

          <div>
            <label className="label">Default HICS role</label>
            <select {...register('defaultHicsRole')} className="input">
              <option value="">No default role</option>
              {Object.entries(HICS_ROLE_LABELS)
                .filter(([k]) => !['SYSTEM_ADMIN', 'SYSTEM_VIEWER', 'RESPONDER', 'READ_ONLY_OBSERVER'].includes(k))
                .map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Used to suggest this person when filling that role in ICS forms.</p>
          </div>

          <div>
            <label className="label">Agency / Department</label>
            <input {...register('agency')} className="input" placeholder="e.g. ED, Surgery, Security" />
          </div>

          <div>
            <label className="label">Email</label>
            <input type="email" {...register('email')} className={`input ${errors.email ? 'input-error' : ''}`} />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mobile phone</label>
              <input type="tel" {...register('phoneMobile')} className="input" />
            </div>
            <div>
              <label className="label">Work phone</label>
              <input type="tel" {...register('phoneWork')} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Pager / radio</label>
            <input {...register('pagerNumber')} className="input" placeholder="Pager number or radio channel" />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea {...register('notes')} rows={2} className="input" placeholder="Optional notes" />
          </div>

          {save.isError && (
            <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              Failed to save. Please try again.
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="submit"
            form="add-personnel-form"
            disabled={save.isPending}
            className="btn-primary"
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add record'}
          </button>
        </div>
      </div>
    </div>
  );
}
