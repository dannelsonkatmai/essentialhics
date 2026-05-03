/**
 * Mutual Aid Directory
 * Lists mutual aid agreements + allows creating new ones.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Users, Plus, X, Phone, Mail } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { mutualAidApi } from '../../api/costs.api';

interface Agreement {
  id: string;
  partnerOrganizationName: string;
  partnerContactName?: string;
  partnerContactPhone?: string;
  partnerContactEmail?: string;
  agreementType: string;
  agreementNumber?: string;
  effectiveDate?: string;
  expirationDate?: string;
  resourceCategories: string[];
  isActive: boolean;
}

interface CreateAgreementFormValues {
  partnerOrganizationName: string;
  agreementType: string;
  agreementNumber?: string;
  partnerContactName?: string;
  partnerContactPhone?: string;
  partnerContactEmail?: string;
  effectiveDate?: string;
  expirationDate?: string;
  resourceCategories?: string;
  terms?: string;
}

const AGREEMENT_TYPES = ['EMAC', 'NIMS MOU', 'Bilateral MOU', 'State Compact', 'Other'];
const NIMS_KINDS = ['PERSONNEL', 'EQUIPMENT', 'TEAM', 'SUPPLY', 'FACILITIES', 'OTHER'];

export default function MutualAidDirectory() {
  const { incidentId } = useParams<{ incidentId?: string }>();
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['mutual-aid', facilityId],
    queryFn: async () => {
      const res = await mutualAidApi.list(facilityId);
      return res.data as Agreement[];
    },
    enabled: !!facilityId,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateAgreementFormValues>();

  const createMutation = useMutation({
    mutationFn: (data: CreateAgreementFormValues) =>
      mutualAidApi.create(facilityId, {
        ...data,
        resourceCategories: data.resourceCategories
          ? data.resourceCategories.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        effectiveDate: data.effectiveDate || undefined,
        expirationDate: data.expirationDate || undefined,
      }),
    onSuccess: () => {
      setShowCreate(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['mutual-aid', facilityId] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => {
      const ag = agreements.find((a) => a.id === id);
      return mutualAidApi.update(facilityId, id, { isActive: !ag?.isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mutual-aid', facilityId] }),
  });

  const now = new Date();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Mutual Aid Directory</h1>
          <span className="text-sm text-gray-500">({agreements.filter(a => a.isActive).length} active)</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Agreement
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agreements.map((ag) => {
            const isExpired = ag.expirationDate && new Date(ag.expirationDate) < now;
            return (
              <div
                key={ag.id}
                className={`bg-white rounded-xl border p-4 ${
                  !ag.isActive || isExpired ? 'border-gray-200 opacity-75' : 'border-gray-200 hover:border-brand-300'
                } transition-colors`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{ag.partnerOrganizationName}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {ag.agreementType}
                      </span>
                      {ag.agreementNumber && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          #{ag.agreementNumber}
                        </span>
                      )}
                      {isExpired ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Expired</span>
                      ) : ag.isActive ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Inactive</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActiveMutation.mutate(ag.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                    title={ag.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {ag.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                  {ag.partnerContactName && (
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span>{ag.partnerContactName}</span>
                    </div>
                  )}
                  {ag.partnerContactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <a href={`tel:${ag.partnerContactPhone}`} className="text-brand-600 hover:underline">
                        {ag.partnerContactPhone}
                      </a>
                    </div>
                  )}
                  {ag.partnerContactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <a href={`mailto:${ag.partnerContactEmail}`} className="text-brand-600 hover:underline truncate">
                        {ag.partnerContactEmail}
                      </a>
                    </div>
                  )}
                  {(ag.effectiveDate || ag.expirationDate) && (
                    <p className="text-xs text-gray-400">
                      {ag.effectiveDate && `Eff: ${new Date(ag.effectiveDate).toLocaleDateString()}`}
                      {ag.effectiveDate && ag.expirationDate && ' · '}
                      {ag.expirationDate && `Exp: ${new Date(ag.expirationDate).toLocaleDateString()}`}
                    </p>
                  )}
                  {ag.resourceCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ag.resourceCategories.map((c) => (
                        <span key={c} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {agreements.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-500">
              <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>No mutual aid agreements configured</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-sm text-brand-600 hover:underline mt-1 inline-block"
              >
                Add the first agreement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Mutual Aid Agreement</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partner Organization *</label>
                <input {...register('partnerOrganizationName', { required: 'Required' })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                {errors.partnerOrganizationName && <p className="text-xs text-red-600 mt-1">{errors.partnerOrganizationName.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agreement Type *</label>
                  <select {...register('agreementType', { required: true })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    {AGREEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agreement #</label>
                  <input {...register('agreementNumber')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input {...register('partnerContactName')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input {...register('partnerContactPhone')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input type="email" {...register('partnerContactEmail')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                  <input type="date" {...register('effectiveDate')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                  <input type="date" {...register('expirationDate')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resource Categories (comma-separated)</label>
                <input {...register('resourceCategories')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. PERSONNEL, EQUIPMENT, SUPPLY" />
                <p className="text-xs text-gray-400 mt-1">Options: {NIMS_KINDS.join(', ')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Terms / Notes</label>
                <textarea {...register('terms')} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {createMutation.isPending ? 'Saving…' : 'Save Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
