import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Users, TreePine } from 'lucide-react';
import { facilitiesApi } from '../../api/facilities.api';

type TabId = 'info' | 'departments' | 'users' | 'sso';

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('info');

  const { data: facility, isLoading } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => facilitiesApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['facility-users', id],
    queryFn: () => facilitiesApi.getUsers(id!).then(r => r.data),
    enabled: tab === 'users' && !!id,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!facility) return <div className="p-6 text-sm text-gray-500">Facility not found.</div>;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Basic Info' },
    { id: 'departments', label: 'Departments' },
    { id: 'users', label: 'Users' },
    { id: 'sso', label: 'SSO & Policies' },
  ];

  const addr = facility.address as any;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/facilities')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{facility.name}</h1>
            <p className="text-sm text-gray-500">{facility.shortName} · {facility.timezone}</p>
          </div>
        </div>
        <div className="ml-auto">
          {facility.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'info' && (
        <div className="card divide-y divide-gray-100">
          {[
            ['Name', facility.name],
            ['Short name', facility.shortName],
            ['Type', facility.facilityType],
            ['Address', addr ? `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}` : '—'],
            ['Phone', facility.phone ?? '—'],
            ['Fax', facility.fax ?? '—'],
            ['License #', facility.licenseNumber ?? '—'],
            ['Timezone', facility.timezone],
            ['Emergency contact', facility.emergencyContactName ?? '—'],
            ['Emergency phone', facility.emergencyContactPhone ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center px-5 py-3">
              <span className="w-44 text-sm text-gray-500 flex-shrink-0">{label}</span>
              <span className="text-sm text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'departments' && (
        <div>
          {facility.departments?.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">No departments added yet.</div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {facility.departments?.map(dept => (
                <div key={dept.id} className="flex items-center px-5 py-3">
                  <TreePine className="h-4 w-4 text-gray-300 mr-3" />
                  <span className="text-sm font-medium text-gray-900 flex-1">{dept.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{dept.code}</span>
                  <span className={`ml-4 badge ${dept.isActive ? 'badge-green' : 'badge-gray'}`}>
                    {dept.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Email', 'Role', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users?.data.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/admin/users/${entry.user.id}`)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {entry.user.firstName} {entry.user.lastName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{entry.user.email}</td>
                  <td className="px-4 py-3 text-sm"><span className="badge-blue">{entry.hicsRole}</span></td>
                  <td className="px-4 py-3">
                    {entry.user.isActive ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sso' && (
        <div className="card p-6 space-y-4">
          <p className="text-sm text-gray-500">
            SSO configuration (Azure AD / Okta) and MFA policies are managed at the
            health system settings level and can be overridden per facility.
          </p>
          <div className="flex gap-3">
            <button className="btn-secondary text-sm">Configure Azure AD SSO</button>
            <button className="btn-secondary text-sm">Configure Okta SSO</button>
          </div>
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-800 mb-2">MFA Policy</h4>
            <select className="input w-auto">
              <option>Inherit from health system</option>
              <option>Required for all users</option>
              <option>Required for admin roles only</option>
              <option>Optional</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
