/**
 * Resource Status Board
 *
 * Three view modes:
 *   1. Kanban — columns per status (ORDERED / IN_TRANSIT / AVAILABLE / ASSIGNED / OUT_OF_SERVICE / DEMOBILIZED)
 *   2. List   — TanStack Table with filtering + sorting
 *   3. Branch/Group — grouped by NIMS kind
 *
 * Real-time updates via Socket.io (resource:status_changed)
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  LayoutGrid, List, Layers, Plus, CheckSquare, Package,
  AlertTriangle, Clock, ArrowRight, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { resourcesApi } from '../../api/resources.api';
import { useIncidentSocket } from '../../hooks/useSocket';
import { QuickAddPanel } from '../../components/resources/QuickAddPanel';
import { StatusTransitionModal } from '../../components/resources/StatusTransitionModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceStatus = 'ORDERED' | 'IN_TRANSIT' | 'AVAILABLE' | 'ASSIGNED' | 'OUT_OF_SERVICE' | 'DEMOBILIZED';

interface IncidentResource {
  id: string;
  name: string;
  nimsKind: string;
  status: ResourceStatus;
  source: string;
  quantity: string;
  unit: string;
  resourceIdentifier?: string;
  homeBaseOrgName?: string;
  eta?: string;
  assignedToRole?: string;
  assignedToLocation?: string;
  resourceType?: { name: string };
  statusHistory?: Array<{ changedAt: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLUMNS: Array<{
  status: ResourceStatus;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  { status: 'ORDERED',         label: 'Ordered',          color: 'text-gray-700',  bgColor: 'bg-gray-50',   borderColor: 'border-gray-300' },
  { status: 'IN_TRANSIT',      label: 'In Transit',       color: 'text-blue-700',  bgColor: 'bg-blue-50',   borderColor: 'border-blue-300' },
  { status: 'AVAILABLE',       label: 'Available',        color: 'text-green-700', bgColor: 'bg-green-50',  borderColor: 'border-green-300' },
  { status: 'ASSIGNED',        label: 'Assigned',         color: 'text-brand-700', bgColor: 'bg-brand-50',  borderColor: 'border-brand-300' },
  { status: 'OUT_OF_SERVICE',  label: 'Out of Service',   color: 'text-red-700',   bgColor: 'bg-red-50',    borderColor: 'border-red-300' },
  { status: 'DEMOBILIZED',     label: 'Demobilized',      color: 'text-slate-600', bgColor: 'bg-slate-50',  borderColor: 'border-slate-300' },
];

const STATUS_BADGE: Record<ResourceStatus, string> = {
  ORDERED:        'bg-gray-100 text-gray-800',
  IN_TRANSIT:     'bg-blue-100 text-blue-800',
  AVAILABLE:      'bg-green-100 text-green-800',
  ASSIGNED:       'bg-brand-100 text-brand-800',
  OUT_OF_SERVICE: 'bg-red-100 text-red-800',
  DEMOBILIZED:    'bg-slate-100 text-slate-700',
};

const NIMS_ICONS: Record<string, React.ElementType> = {
  PERSONNEL: CheckSquare,
  EQUIPMENT: Package,
  SUPPLY:    Package,
  TEAM:      CheckSquare,
  FACILITIES: Layers,
  OTHER:     Package,
};

// ─── Resource Card ────────────────────────────────────────────────────────────

function ResourceCard({ resource, onTransition }: {
  resource: IncidentResource;
  onTransition: (r: IncidentResource) => void;
}) {
  const Icon = NIMS_ICONS[resource.nimsKind] ?? Package;
  const hasEta = !!resource.eta && ['ORDERED', 'IN_TRANSIT'].includes(resource.status);
  const isOverdue = hasEta && new Date(resource.eta!) < new Date();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 truncate">{resource.name}</span>
        </div>
        <button
          onClick={() => onTransition(resource)}
          className="flex-shrink-0 text-gray-400 hover:text-brand-600 rounded p-0.5"
          title="Change status"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 space-y-1">
        {resource.resourceType && (
          <p className="text-xs text-gray-500">{resource.resourceType.name}</p>
        )}
        <p className="text-xs text-gray-500">
          {resource.quantity} {resource.unit} · {resource.source.replace('_', ' ')}
        </p>
        {resource.homeBaseOrgName && (
          <p className="text-xs text-gray-400 truncate">📍 {resource.homeBaseOrgName}</p>
        )}
        {resource.assignedToRole && (
          <p className="text-xs text-brand-600 truncate">→ {resource.assignedToRole.replace(/_/g, ' ')}</p>
        )}
        {hasEta && (
          <p className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-orange-600'}`}>
            <Clock className="h-3 w-3" />
            ETA: {new Date(resource.eta!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            {isOverdue && ' (overdue)'}
          </p>
        )}
        {resource.resourceIdentifier && (
          <p className="text-xs text-gray-400"># {resource.resourceIdentifier}</p>
        )}
      </div>
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({ resources, onTransition }: {
  resources: IncidentResource[];
  onTransition: (r: IncidentResource) => void;
}) {
  const byStatus = Object.fromEntries(
    STATUS_COLUMNS.map((col) => [col.status, resources.filter((r) => r.status === col.status)]),
  ) as Record<ResourceStatus, IncidentResource[]>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-0 flex-1">
      {STATUS_COLUMNS.map(({ status, label, color, bgColor, borderColor }) => (
        <div key={status} className={`flex-shrink-0 w-64 ${bgColor} rounded-lg border ${borderColor} flex flex-col`}>
          <div className={`px-3 py-2 border-b ${borderColor} flex items-center justify-between`}>
            <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</span>
            <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${color} bg-white border ${borderColor}`}>
              {byStatus[status]?.length ?? 0}
            </span>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {(byStatus[status] ?? []).map((r) => (
              <ResourceCard key={r.id} resource={r} onTransition={onTransition} />
            ))}
            {(byStatus[status] ?? []).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No resources</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<IncidentResource>();

const listColumns = [
  columnHelper.accessor('name', {
    header: 'Resource',
    cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
  }),
  columnHelper.accessor('nimsKind', {
    header: 'Kind',
    cell: (info) => <span className="text-xs text-gray-600">{info.getValue()}</span>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[info.getValue()]}`}>
        {info.getValue().replace('_', ' ')}
      </span>
    ),
  }),
  columnHelper.accessor('source', {
    header: 'Source',
    cell: (info) => <span className="text-xs text-gray-600">{info.getValue().replace('_', ' ')}</span>,
  }),
  columnHelper.accessor((row) => `${row.quantity} ${row.unit}`, {
    id: 'qty',
    header: 'Quantity',
    cell: (info) => <span className="text-sm text-gray-700">{info.getValue()}</span>,
  }),
  columnHelper.accessor('homeBaseOrgName', {
    header: 'Home Org',
    cell: (info) => <span className="text-xs text-gray-500">{info.getValue() ?? '—'}</span>,
  }),
  columnHelper.accessor('eta', {
    header: 'ETA',
    cell: (info) => info.getValue()
      ? new Date(info.getValue()!).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—',
  }),
];

function ListView({ resources, onTransition }: {
  resources: IncidentResource[];
  onTransition: (r: IncidentResource) => void;
}) {
  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({
    data: resources,
    columns: listColumns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="flex items-center gap-3">
        <input
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search resources..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </div>
      <div className="overflow-auto flex-1 rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <button
                    onClick={() => onTransition(row.original)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="text-center py-12 text-gray-500">No resources found</div>
        )}
      </div>
    </div>
  );
}

// ─── Branch/Group View ────────────────────────────────────────────────────────

function BranchGroupView({ resources, onTransition }: {
  resources: IncidentResource[];
  onTransition: (r: IncidentResource) => void;
}) {
  const byKind = resources.reduce((acc, r) => {
    if (!acc[r.nimsKind]) acc[r.nimsKind] = [];
    acc[r.nimsKind].push(r);
    return acc;
  }, {} as Record<string, IncidentResource[]>);

  return (
    <div className="space-y-6 overflow-y-auto flex-1">
      {Object.entries(byKind).map(([kind, items]) => {
        const Icon = NIMS_ICONS[kind] ?? Package;
        return (
          <div key={kind}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{kind}</h3>
              <span className="text-xs text-gray-500">({items.length})</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((r) => (
                <ResourceCard key={r.id} resource={r} onTransition={onTransition} />
              ))}
            </div>
          </div>
        );
      })}
      {Object.keys(byKind).length === 0 && (
        <div className="text-center py-12 text-gray-500">No resources to display</div>
      )}
    </div>
  );
}

// ─── Summary Badges ───────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: Record<ResourceStatus, number> }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {STATUS_COLUMNS.map(({ status, label, color, bgColor, borderColor }) => {
        const count = summary[status] ?? 0;
        if (count === 0) return null;
        return (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${color} ${bgColor} ${borderColor}`}
          >
            {label}: {count}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'list' | 'group';

export default function ResourceStatusBoard() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<IncidentResource | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Real-time socket subscription
  useIncidentSocket(incidentId ?? '');

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['incident-resources', incidentId, statusFilter],
    queryFn: async () => {
      const params = statusFilter ? { status: statusFilter } : {};
      const res = await resourcesApi.list(facilityId, incidentId!, params);
      return res.data as IncidentResource[];
    },
    enabled: !!incidentId && !!facilityId,
    refetchInterval: 30_000, // also refetch every 30s as fallback
  });

  const { data: summary = {} } = useQuery({
    queryKey: ['resource-summary', incidentId],
    queryFn: async () => {
      const res = await resourcesApi.summary(facilityId, incidentId!);
      return res.data as Record<ResourceStatus, number>;
    },
    enabled: !!incidentId && !!facilityId,
    refetchInterval: 30_000,
  });

  // Listen to socket events to refetch
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['incident-resources', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['resource-summary', incidentId] });
    };
    window.addEventListener('resource:status_changed', handler);
    return () => window.removeEventListener('resource:status_changed', handler);
  }, [incidentId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  const filteredResources = statusFilter
    ? resources.filter((r) => r.status === statusFilter)
    : resources;

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resource Status Board</h1>
          <p className="text-sm text-gray-500">
            {resources.length} total resources · {resources.filter(r => r.status !== 'DEMOBILIZED').length} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggles */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {([['kanban', LayoutGrid], ['list', List], ['group', Layers]] as [ViewMode, React.ElementType][]).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Status filter (for list/group views) */}
          {viewMode !== 'kanban' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All statuses</option>
              {STATUS_COLUMNS.map((s) => (
                <option key={s.status} value={s.status}>{s.label}</option>
              ))}
            </select>
          )}

          {/* Quick add link */}
          <Link
            to={`/incidents/${incidentId}/requests/new`}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <Plus className="h-4 w-4" /> New 213RR
          </Link>

          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Resource
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <SummaryBar summary={summary as Record<ResourceStatus, number>} />

      {/* Board content */}
      {viewMode === 'kanban' && <KanbanView resources={filteredResources} onTransition={setTransitionTarget} />}
      {viewMode === 'list' && <ListView resources={filteredResources} onTransition={setTransitionTarget} />}
      {viewMode === 'group' && <BranchGroupView resources={filteredResources} onTransition={setTransitionTarget} />}

      {/* Quick Add slide-over */}
      {showQuickAdd && (
        <QuickAddPanel
          facilityId={facilityId}
          incidentId={incidentId!}
          onClose={() => setShowQuickAdd(false)}
          onAdded={() => {
            setShowQuickAdd(false);
            queryClient.invalidateQueries({ queryKey: ['incident-resources', incidentId] });
            queryClient.invalidateQueries({ queryKey: ['resource-summary', incidentId] });
          }}
        />
      )}

      {/* Status transition modal */}
      {transitionTarget && (
        <StatusTransitionModal
          facilityId={facilityId}
          incidentId={incidentId!}
          resource={transitionTarget}
          onClose={() => setTransitionTarget(null)}
          onTransitioned={() => {
            setTransitionTarget(null);
            queryClient.invalidateQueries({ queryKey: ['incident-resources', incidentId] });
            queryClient.invalidateQueries({ queryKey: ['resource-summary', incidentId] });
          }}
        />
      )}
    </div>
  );
}
