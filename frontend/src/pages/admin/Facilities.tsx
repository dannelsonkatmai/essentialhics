import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, ChevronRight, PlusCircle } from 'lucide-react';
import { facilitiesApi } from '../../api/facilities.api';

export default function FacilitiesPage() {
  const navigate = useNavigate();

  const { data: facilities, isLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesApi.list().then(r => r.data),
  });

  const typeLabel: Record<string, string> = {
    HOSPITAL: 'Hospital',
    CLINIC: 'Clinic',
    ALTERNATE_CARE_SITE: 'Alternate Care Site',
    OTHER: 'Other',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Facilities</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage hospitals, clinics, and alternate care sites</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5">
          <PlusCircle className="h-4 w-4" /> Add facility
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {facilities?.map(facility => (
          <div
            key={facility.id}
            className="card p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/admin/facilities/${facility.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-brand-50 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{facility.name}</p>
                  <p className="text-xs text-gray-500">{facility.shortName}</p>
                </div>
              </div>
              {facility.isActive
                ? <span className="badge-green">Active</span>
                : <span className="badge-red">Inactive</span>}
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-400 w-16 flex-shrink-0">Type</dt>
                <dd className="text-gray-700">{typeLabel[facility.facilityType]}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-400 w-16 flex-shrink-0">Location</dt>
                <dd className="text-gray-700 truncate">
                  {(facility.address as any)?.city}, {(facility.address as any)?.state}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-400 w-16 flex-shrink-0">Phone</dt>
                <dd className="text-gray-700">{facility.phone ?? '—'}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Users className="h-3.5 w-3.5" />
                <span>{(facility as any)._count?.userFacilityRoles ?? 0} users</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
