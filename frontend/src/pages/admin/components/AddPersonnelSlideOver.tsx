import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Camera, Trash2 } from 'lucide-react';
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

// Silhouette SVG as a data URI for the placeholder
const SILHOUETTE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="%23cbd5e1"><circle cx="40" cy="28" r="16"/><ellipse cx="40" cy="68" rx="26" ry="18"/></svg>`;

export default function AddPersonnelSlideOver({ facilityId, existing, onClose }: Props) {
  const qc = useQueryClient();
  const isEdit = !!existing;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(existing?.photoUrl ?? null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

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
    mutationFn: async (data: FormData) => {
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
      const result = isEdit
        ? await personnelLibraryApi.update(existing!.id, payload)
        : await personnelLibraryApi.create(facilityId, payload);

      if (pendingPhotoFile) {
        setPhotoUploadError(null);
        await personnelLibraryApi.uploadPhoto(facilityId, result.data.id, pendingPhotoFile);
      }

      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personnel', facilityId] });
      onClose();
    },
  });

  const removePhoto = useMutation({
    mutationFn: async () => {
      if (!existing?.id || !existing.photoUrl) return;
      await personnelLibraryApi.removePhoto(facilityId, existing.id, existing.photoUrl);
    },
    onSuccess: () => {
      setPhotoPreview(null);
      setPendingPhotoFile(null);
      qc.invalidateQueries({ queryKey: ['personnel', facilityId] });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError('Photo must be under 5 MB.');
      return;
    }
    setPhotoUploadError(null);
    setPendingPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleClearPendingPhoto() {
    setPendingPhotoFile(null);
    setPhotoPreview(existing?.photoUrl ?? null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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
          {/* Photo upload */}
          <div>
            <label className="label">Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 border border-gray-200 flex-shrink-0">
                <img
                  src={photoPreview ?? SILHOUETTE_SVG}
                  alt="Personnel photo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Camera className="h-4 w-4" />
                  {photoPreview ? 'Change photo' : 'Upload photo'}
                </button>
                {(photoPreview || pendingPhotoFile) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingPhotoFile) {
                        handleClearPendingPhoto();
                      } else if (existing?.photoUrl) {
                        if (confirm('Remove this person\'s photo?')) removePhoto.mutate();
                      }
                    }}
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove photo
                  </button>
                )}
                <p className="text-xs text-gray-400">JPEG, PNG or WebP, max 5 MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {photoUploadError && <p className="error-text mt-1">{photoUploadError}</p>}
          </div>

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
