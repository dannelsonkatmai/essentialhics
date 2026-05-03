import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Upload, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { usersApi } from '../../api/users.api';
import { facilitiesApi } from '../../api/facilities.api';
import { HICS_ROLE_LABELS } from '../../types';
import { format } from 'date-fns';
import AddUserSlideOver from './components/AddUserSlideOver';
import ImportUsersModal from './components/ImportUsersModal';

export default function UsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterFacility, setFilterFacility] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'active' | 'inactive' | 'locked'>('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, filterFacility, filterStatus],
    queryFn: () => usersApi.list({
      page, limit: 25,
      search: search || undefined,
      facilityId: filterFacility || undefined,
      status: filterStatus || undefined,
    }).then(r => r.data),
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesApi.list().then(r => r.data),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const statusBadge = (user: any) => {
    if (user.isLocked) return <span className="badge-yellow">Locked</span>;
    if (!user.isActive) return <span className="badge-red">Inactive</span>;
    return <span className="badge-green">Active</span>;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage system users and role assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-1.5">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button onClick={() => setShowAddUser(true)} className="btn-primary flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" /> Add user
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input pl-9"
          />
        </div>
        <select
          value={filterFacility}
          onChange={e => { setFilterFacility(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">All facilities</option>
          {facilities?.map(f => <option key={f.id} value={f.id}>{f.shortName}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value as any); setPage(1); }}
          className="input w-auto"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Locked</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Email', 'Role(s)', 'Facility', 'Status', 'Last login', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No users found.</td></tr>
            )}
            {data?.data.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/users/${user.id}`)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {user.firstName} {user.lastName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
                  <div className="flex flex-wrap gap-1">
                    {user.userFacilityRoles?.slice(0, 2).map(r => (
                      <span key={r.facilityId + r.hicsRole} className="badge-blue text-xs">
                        {HICS_ROLE_LABELS[r.hicsRole as keyof typeof HICS_ROLE_LABELS] ?? r.hicsRole}
                      </span>
                    ))}
                    {(user.userFacilityRoles?.length ?? 0) > 2 && (
                      <span className="badge-gray">+{user.userFacilityRoles!.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {user.userFacilityRoles?.find(r => r.isPrimaryFacility)?.facilityId ?? '—'}
                </td>
                <td className="px-4 py-3">{statusBadge(user)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'MMM d, yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      className="text-xs text-brand-600 hover:text-brand-800 px-2 py-1 rounded hover:bg-brand-50"
                    >
                      View
                    </button>
                    {user.isActive && (
                      <button
                        onClick={() => { if (confirm(`Deactivate ${user.firstName}?`)) deactivate.mutate(user.id); }}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-white">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, data.pagination.total)} of {data.pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-700 px-2">Page {page} of {data.pagination.totalPages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page === data.pagination.totalPages}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddUser && <AddUserSlideOver onClose={() => setShowAddUser(false)} facilities={facilities ?? []} />}
      {showImport && <ImportUsersModal onClose={() => setShowImport(false)} facilities={facilities ?? []} />}
    </div>
  );
}
