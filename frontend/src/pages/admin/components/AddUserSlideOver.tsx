import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi } from '../../../api/facilities.api';
import { HICS_ROLE_LABELS } from '../../../types';
import type { Facility, HicsRole } from '../../../types';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Valid email required'),
  jobTitle: z.string().optional(),
  employeeId: z.string().optional(),
  phoneMobile: z.string().optional(),
  facilityId: z.string().uuid('Select a facility'),
  hicsRole: z.string().min(1, 'Select a role'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  facilities: Facility[];
}

export default function AddUserSlideOver({ onClose, facilities }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const create = useMutation({
    mutationFn: (data: FormData) =>
      facilitiesApi.createUser(data.facilityId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add user</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(d => create.mutate(d))} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
            <label className="label">Email</label>
            <input type="email" {...register('email')} className={`input ${errors.email ? 'input-error' : ''}`} />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Job title</label>
            <input {...register('jobTitle')} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Employee ID</label>
              <input {...register('employeeId')} className="input" />
            </div>
            <div>
              <label className="label">Mobile phone</label>
              <input type="tel" {...register('phoneMobile')} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Facility</label>
            <select {...register('facilityId')} className={`input ${errors.facilityId ? 'input-error' : ''}`}>
              <option value="">Select facility…</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {errors.facilityId && <p className="error-text">{errors.facilityId.message}</p>}
          </div>
          <div>
            <label className="label">HICS Role</label>
            <select {...register('hicsRole')} className={`input ${errors.hicsRole ? 'input-error' : ''}`}>
              <option value="">Select role…</option>
              {Object.entries(HICS_ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {errors.hicsRole && <p className="error-text">{errors.hicsRole.message}</p>}
          </div>

          {create.isError && (
            <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {(create.error as any)?.response?.data?.message ?? 'Failed to create user.'}
            </div>
          )}
        </form>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="submit"
            form="add-user-form"
            disabled={create.isPending}
            className="btn-primary"
            onClick={() => document.querySelector<HTMLFormElement>('form')?.requestSubmit()}
          >
            {create.isPending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </div>
    </div>
  );
}
