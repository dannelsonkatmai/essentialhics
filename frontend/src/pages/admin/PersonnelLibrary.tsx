import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserPlus, Pencil, Trash2, Users,
  ChevronLeft, ChevronRight, Plus, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { personnelLibraryApi } from '../../api/personnelLibrary.api';
import { facilitiesApi } from '../../api/facilities.api';
import { HICS_ROLE_LABELS } from '../../types';
import type { HicsRole, PersonnelRoster } from '../../types';
import AddPersonnelSlideOver from './components/AddPersonnelSlideOver';
import type { PersonnelRecord } from '../../types';

type Tab = 'personnel' | 'rosters';

export default function PersonnelLibrary() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  // Facility selector
  const [facilityId, setFacilityId] = useState(user?.primaryFacilityId ?? '');

  // Tabs
  const [tab, setTab] = useState<Tab>('personnel');

  // Personnel tab state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<HicsRole | ''>('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PersonnelRecord | null>(null);

  // Roster tab state
  const [showAddRoster, setShowAddRoster] = useState(false);
  const [newRosterName, setNewRosterName] = useState('');
  const [newRosterDesc, setNewRosterDesc] = useState('');
  const [expandedRoster, setExpandedRoster] = useState<string | null>(null);

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesApi.list().then(r => r.data),
  });

  const { data: personnelData, isLoading: loadingPersonnel } = useQuery({
    queryKey: ['personnel', facilityId, page, search, filterRole, filterStatus],
    queryFn: () =>
      personnelLibraryApi.list(facilityId, {
        page,
        limit: 25,
        search: search || undefined,
        hicsRole: filterRole || undefined,
        status: filterStatus || undefined,
      }).then(r => r.data),
    enabled: !!facilityId,
  });

  const { data: rosters, isLoading: loadingRosters } = useQuery({
    queryKey: ['rosters', facilityId],
    queryFn: () => personnelLibraryApi.listRosters(facilityId).then(r => r.data),
    enabled: !!facilityId && tab === 'rosters',
  });

  const removePersonnel = useMutation({
    mutationFn: (id: string) => personnelLibraryApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personnel', facilityId] }),
  });

  const createRoster = useMutation({
    mutationFn: () => personnelLibraryApi.createRoster(facilityId, { name: newRosterName, description: newRosterDesc || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rosters', facilityId] });
      setShowAddRoster(false);
      setNewRosterName('');
      setNewRosterDesc('');
    },
  });

  const deleteRoster = useMutation({
    mutationFn: (id: string) => personnelLibraryApi.deleteRoster(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rosters', facilityId] }),
  });

  const removeRosterMember = useMutation({
    mutationFn: (memberId: string) => personnelLibraryApi.removeRosterMember(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rosters', facilityId] }),
  });

  const roleBadge = (role?: HicsRole) => {
    if (!role) return null;
    return (
      <span className="badge-blue text-xs truncate max-w-[160px]">
        {HICS_ROLE_LABELS[role] ?? role}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Personnel Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pre-load incident personnel records and rosters that can be pulled into ICS forms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {facilities && facilities.length > 1 && (
            <select
              value={facilityId}
              onChange={e => { setFacilityId(e.target.value); setPage(1); }}
              className="input w-auto"
            >
              <option value="">Select facility…</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {tab === 'personnel' && facilityId && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Add person
            </button>
          )}
          {tab === 'rosters' && facilityId && (
            <button onClick={() => setShowAddRoster(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> New roster
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-5">
        <nav className="-mb-px flex gap-6">
          {(['personnel', 'rosters'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'personnel' ? 'Personnel Records' : 'Rosters'}
            </button>
          ))}
        </nav>
      </div>

      {!facilityId && (
        <div className="text-center py-16 text-gray-400 text-sm">Select a facility to manage its personnel library.</div>
      )}

      {/* ── Personnel Tab ─────────────────────────────────────────────── */}
      {facilityId && tab === 'personnel' && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search by name, email, or agency…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input pl-9"
              />
            </div>
            <select
              value={filterRole}
              onChange={e => { setFilterRole(e.target.value as HicsRole | ''); setPage(1); }}
              className="input w-auto"
            >
              <option value="">All roles</option>
              {Object.entries(HICS_ROLE_LABELS)
                .filter(([k]) => !['SYSTEM_ADMIN', 'SYSTEM_VIEWER', 'RESPONDER', 'READ_ONLY_OBSERVER'].includes(k))
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value as any); setPage(1); }}
              className="input w-auto"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['', 'Name', 'Title / Agency', 'Default HICS role', 'Contact', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingPersonnel && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
                )}
                {!loadingPersonnel && (personnelData?.data.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No personnel records yet. Add your first record to get started.</p>
                    </td>
                  </tr>
                )}
                {personnelData?.data.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 w-10">
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt={`${p.firstName} ${p.lastName}`}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center">
                          <svg viewBox="0 0 80 80" className="w-5 h-5 text-slate-400" fill="currentColor">
                            <circle cx="40" cy="28" r="16" />
                            <ellipse cx="40" cy="68" rx="26" ry="18" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div>{p.title ?? '—'}</div>
                      {p.agency && <div className="text-xs text-gray-400">{p.agency}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {roleBadge(p.defaultHicsRole)}
                      {!p.defaultHicsRole && <span className="text-gray-400 text-xs">None</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p.phoneMobile ?? p.phoneWork ?? p.email ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive
                        ? <span className="badge-green">Active</span>
                        : <span className="badge-red">Inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(p)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${p.firstName} ${p.lastName} from the library?`)) {
                              removePersonnel.mutate(p.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {personnelData && personnelData.pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-white">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, personnelData.pagination.total)} of {personnelData.pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-700 px-2">Page {page} of {personnelData.pagination.totalPages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === personnelData.pagination.totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Rosters Tab ───────────────────────────────────────────────── */}
      {facilityId && tab === 'rosters' && (
        <div className="space-y-3">
          {loadingRosters && <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>}
          {!loadingRosters && (rosters?.length ?? 0) === 0 && (
            <div className="text-center py-16">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No rosters yet. Create a roster to group personnel for quick assignment.</p>
            </div>
          )}

          {rosters?.map(roster => (
            <RosterCard
              key={roster.id}
              roster={roster}
              expanded={expandedRoster === roster.id}
              onToggle={() => setExpandedRoster(prev => prev === roster.id ? null : roster.id)}
              onDelete={() => {
                if (confirm(`Delete roster "${roster.name}"?`)) deleteRoster.mutate(roster.id);
              }}
              onRemoveMember={id => removeRosterMember.mutate(id)}
            />
          ))}

          {/* Add Roster Inline Form */}
          {showAddRoster && (
            <div className="card p-4 space-y-3 border-2 border-brand-200">
              <h3 className="text-sm font-medium text-gray-900">New roster</h3>
              <div>
                <label className="label">Roster name</label>
                <input
                  value={newRosterName}
                  onChange={e => setNewRosterName(e.target.value)}
                  className="input"
                  placeholder="e.g. Day Shift Command Staff"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input
                  value={newRosterDesc}
                  onChange={e => setNewRosterDesc(e.target.value)}
                  className="input"
                  placeholder="Brief description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowAddRoster(false); setNewRosterName(''); }} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => createRoster.mutate()}
                  disabled={!newRosterName.trim() || createRoster.isPending}
                  className="btn-primary"
                >
                  {createRoster.isPending ? 'Creating…' : 'Create roster'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-overs */}
      {showAdd && facilityId && (
        <AddPersonnelSlideOver facilityId={facilityId} onClose={() => setShowAdd(false)} />
      )}
      {editing && facilityId && (
        <AddPersonnelSlideOver facilityId={facilityId} existing={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

interface RosterCardProps {
  roster: PersonnelRoster;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRemoveMember: (memberId: string) => void;
}

function RosterCard({ roster, expanded, onToggle, onDelete, onRemoveMember }: RosterCardProps) {
  const memberCount = roster.members?.length ?? 0;
  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{roster.name}</p>
            {roster.description && <p className="text-xs text-gray-500 mt-0.5">{roster.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-blue">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {memberCount === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400 text-center">No members in this roster yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Designated role', 'Contact', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {roster.members?.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {m.personnel?.firstName} {m.personnel?.lastName}
                      {m.personnel?.title && <span className="ml-1.5 text-xs text-gray-400">{m.personnel.title}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {m.designatedHicsRole
                        ? <span className="badge-blue text-xs">{HICS_ROLE_LABELS[m.designatedHicsRole] ?? m.designatedHicsRole}</span>
                        : m.personnel?.defaultHicsRole
                          ? <span className="badge-gray text-xs">{HICS_ROLE_LABELS[m.personnel.defaultHicsRole]}</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {m.personnel?.phoneMobile ?? m.personnel?.phoneWork ?? m.personnel?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRemoveMember(m.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
