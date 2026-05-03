/**
 * Cost Ledger
 *
 * Shows cost records with filters, summaries, and charts.
 * Uses CostRollup for summary totals (never aggregates in real-time).
 * Includes Add Cost slide-over and FEMA PA export trigger.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, Plus, Download, RefreshCw, CheckCircle, Loader,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { costsApi } from '../../api/costs.api';
import { AddCostSlideOver } from '../../components/costs/AddCostSlideOver';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CostRecord {
  id: string;
  costType: string;
  femaPACategory: string;
  description: string;
  quantity: string;
  unitCost: string;
  totalCost: string;
  vendor?: string;
  invoiceNumber?: string;
  incurredAt: string;
  isApproved: boolean;
  recordedByUser: { firstName: string; lastName: string };
  operationalPeriod?: { periodNumber: number };
}

interface CostRollup {
  totalCost: string;
  laborCost: string;
  equipmentCost: string;
  supplyCost: string;
  contractCost: string;
  overheadCost: string;
  costByFemaCategory: Record<string, string>;
  costByPeriod: Array<{ periodNumber: number; totalCost: string }>;
  laborHours: string;
  equipmentHours: string;
  headcount: number;
  approvedCost: string;
  unapprovedCost: string;
  recordCount: number;
  computedAt: string;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  LABOR:     '#3B82F6',
  EQUIPMENT: '#F59E0B',
  SUPPLY:    '#10B981',
  CONTRACT:  '#8B5CF6',
  OVERHEAD:  '#6B7280',
};

const FEMA_COLORS = [
  '#1B3A6B', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF',
];

// ─── Summary Cards ────────────────────────────────────────────────────────────

function CostSummaryCards({ rollup }: { rollup: CostRollup }) {
  const fmt = (v: string) =>
    `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cards = [
    { label: 'Total Cost', value: fmt(rollup.totalCost), color: 'text-gray-900', bold: true },
    { label: 'Approved', value: fmt(rollup.approvedCost), color: 'text-green-700' },
    { label: 'Pending Approval', value: fmt(rollup.unapprovedCost), color: 'text-yellow-700' },
    { label: 'Labor', value: fmt(rollup.laborCost), color: 'text-blue-700' },
    { label: 'Equipment', value: fmt(rollup.equipmentCost), color: 'text-amber-700' },
    { label: 'Records', value: rollup.recordCount.toString(), color: 'text-gray-700' },
    { label: 'Labor Hours', value: `${parseFloat(rollup.laborHours).toFixed(1)}h`, color: 'text-gray-700' },
    { label: 'Personnel', value: rollup.headcount.toString(), color: 'text-gray-700' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
      {cards.map(({ label, value, color, bold }) => (
        <div key={label} className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-sm font-semibold ${color} ${bold ? 'text-lg' : ''}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function CostBreakdownChart({ rollup }: { rollup: CostRollup }) {
  const data = Object.entries({
    Labor:     rollup.laborCost,
    Equipment: rollup.equipmentCost,
    Supply:    rollup.supplyCost,
    Contract:  rollup.contractCost,
    Overhead:  rollup.overheadCost,
  })
    .filter(([, v]) => parseFloat(v) > 0)
    .map(([name, value]) => ({ name, value: parseFloat(parseFloat(value).toFixed(2)) }));

  const COLORS = Object.values(TYPE_COLORS);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost by Type</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CostTrendChart({ rollup }: { rollup: CostRollup }) {
  const data = rollup.costByPeriod.map((p) => ({
    period: `P${p.periodNumber}`,
    total: parseFloat(parseFloat(p.totalCost).toFixed(2)),
  }));

  if (data.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost by Operational Period</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <Bar dataKey="total" fill="#1B3A6B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FemaCategoryChart({ rollup }: { rollup: CostRollup }) {
  const data = Object.entries(rollup.costByFemaCategory)
    .filter(([, v]) => parseFloat(v) > 0)
    .map(([cat, value]) => ({
      cat: cat.replace('CAT_', 'Cat '),
      value: parseFloat(parseFloat(value).toFixed(2)),
    }));

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">FEMA PA Category Breakdown</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <YAxis dataKey="cat" type="category" tick={{ fontSize: 11 }} width={60} />
          <Tooltip formatter={(v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CostLedger() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';
  const queryClient = useQueryClient();

  const [showAddCost, setShowAddCost] = useState(false);
  const [costTypeFilter, setCostTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [approvedFilter, setApprovedFilter] = useState('');
  const [exportJobId, setExportJobId] = useState<string | null>(null);

  const { data: rollup } = useQuery({
    queryKey: ['cost-rollup', incidentId],
    queryFn: async () => {
      const res = await costsApi.getRollup(facilityId, incidentId!);
      return res.data as CostRollup;
    },
    enabled: !!incidentId && !!facilityId,
    refetchInterval: 60_000,
  });

  const params: Record<string, string> = {};
  if (costTypeFilter) params.costType = costTypeFilter;
  if (categoryFilter) params.femaPACategory = categoryFilter;
  if (approvedFilter) params.isApproved = approvedFilter;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['cost-records', incidentId, params],
    queryFn: async () => {
      const res = await costsApi.list(facilityId, incidentId!, params);
      return res.data as CostRecord[];
    },
    enabled: !!incidentId && !!facilityId,
  });

  const refreshRollupMutation = useMutation({
    mutationFn: () => costsApi.computeRollup(facilityId, incidentId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cost-rollup', incidentId] }),
  });

  const approveMutation = useMutation({
    mutationFn: (costId: string) => costsApi.approve(facilityId, incidentId!, costId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-records', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['cost-rollup', incidentId] });
    },
  });

  const exportFemaMutation = useMutation({
    mutationFn: () => costsApi.exportFemaPA(facilityId, incidentId!),
    onSuccess: (res) => setExportJobId(res.data.exportJobId),
  });

  const { data: exportJob } = useQuery({
    queryKey: ['export-job', exportJobId],
    queryFn: async () => {
      const res = await costsApi.getExportJob(facilityId, incidentId!, exportJobId!);
      return res.data as { status: string; fileUrl?: string; errorMessage?: string };
    },
    enabled: !!exportJobId,
    refetchInterval: exportJob?.status === 'COMPLETED' || exportJob?.status === 'FAILED' ? false : 3000,
  });

  const costTypes = ['LABOR', 'EQUIPMENT', 'SUPPLY', 'CONTRACT', 'OVERHEAD'];
  const femaCategories = ['CAT_A', 'CAT_B', 'CAT_C', 'CAT_D', 'CAT_E', 'CAT_F', 'CAT_G', 'CAT_Z'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Cost Ledger</h1>
          {rollup && (
            <span className="text-xs text-gray-400 ml-2">
              Last updated: {new Date(rollup.computedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshRollupMutation.mutate()}
            disabled={refreshRollupMutation.isPending}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshRollupMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh Totals
          </button>

          {/* FEMA export */}
          <button
            onClick={() => exportFemaMutation.mutate()}
            disabled={exportFemaMutation.isPending || exportJob?.status === 'PROCESSING'}
            className="flex items-center gap-1.5 text-sm text-white bg-green-700 hover:bg-green-800 rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {exportJob?.status === 'PROCESSING' ? (
              <><Loader className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Download className="h-4 w-4" /> FEMA PA Export</>
            )}
          </button>

          {exportJob?.status === 'COMPLETED' && exportJob.fileUrl && (
            <a
              href={exportJob.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-green-700 hover:underline font-medium"
            >
              <CheckCircle className="h-4 w-4" /> Download XLSX
            </a>
          )}

          <button
            onClick={() => setShowAddCost(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add Cost
          </button>
        </div>
      </div>

      {/* Summary */}
      {rollup && <CostSummaryCards rollup={rollup} />}

      {/* Charts */}
      {rollup && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <CostBreakdownChart rollup={rollup} />
          <CostTrendChart rollup={rollup} />
          <FemaCategoryChart rollup={rollup} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={costTypeFilter}
          onChange={(e) => setCostTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          {costTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All FEMA Categories</option>
          {femaCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={approvedFilter}
          onChange={(e) => setApprovedFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="true">Approved</option>
          <option value="false">Pending Approval</option>
        </select>
      </div>

      {/* Records table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Type', 'FEMA Cat.', 'Description', 'Vendor', 'Qty', 'Unit Cost', 'Total', 'Period', 'Recorded By', 'Status', ''].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                  {new Date(record.incurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: TYPE_COLORS[record.costType] }}
                  />
                  <span className="text-xs text-gray-700">{record.costType}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{record.femaPACategory}</td>
                <td className="px-3 py-2.5 text-sm text-gray-900 max-w-xs truncate">{record.description}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{record.vendor ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-700">{parseFloat(record.quantity).toFixed(1)}</td>
                <td className="px-3 py-2.5 text-xs text-gray-700">
                  ${parseFloat(record.unitCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-gray-900">
                  ${parseFloat(record.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {record.operationalPeriod ? `P${record.operationalPeriod.periodNumber}` : '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {record.recordedByUser.firstName[0]}. {record.recordedByUser.lastName}
                </td>
                <td className="px-3 py-2.5">
                  {record.isApproved ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3" /> Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {!record.isApproved && (
                    <button
                      onClick={() => approveMutation.mutate(record.id)}
                      className="text-xs text-green-700 hover:underline font-medium"
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        )}
        {!isLoading && records.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <DollarSign className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>No cost records yet</p>
            <button
              onClick={() => setShowAddCost(true)}
              className="text-sm text-brand-600 hover:underline mt-1 inline-block"
            >
              Add the first cost record
            </button>
          </div>
        )}
      </div>

      {/* Add Cost slide-over */}
      {showAddCost && (
        <AddCostSlideOver
          facilityId={facilityId}
          incidentId={incidentId!}
          onClose={() => setShowAddCost(false)}
          onAdded={() => {
            setShowAddCost(false);
            queryClient.invalidateQueries({ queryKey: ['cost-records', incidentId] });
          }}
        />
      )}
    </div>
  );
}
