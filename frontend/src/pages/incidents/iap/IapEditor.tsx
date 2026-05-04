import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, CircleCheck as CheckCircle, Circle, CircleAlert as AlertCircle, FileText, Save, Download, Send, ChevronDown, ChevronUp, BookOpen, Users } from 'lucide-react';
import { iapApi, Iap } from '../../../api/iap.api';
import { useIncidentSocket } from '../../../hooks/useSocket';
import IapApprovalPanel from './IapApprovalPanel';
import Form201 from './forms/Form201';
import Form202 from './forms/Form202';
import Form203 from './forms/Form203';
import Form204 from './forms/Form204';
import Form207 from './forms/Form207';
import Form213 from './forms/Form213';
import Form215 from './forms/Form215';
import Form215a from './forms/Form215a';
import FormHics251 from './forms/FormHics251';
import FormHics252 from './forms/FormHics252';

const FORMS = [
  { key: '201', label: 'ICS-201', title: 'Incident Briefing', weight: 5 },
  { key: '202', label: 'ICS-202', title: 'Incident Objectives', weight: 30 },
  { key: '203', label: 'ICS-203', title: 'Organization Assignment List', weight: 20 },
  { key: '204', label: 'ICS-204', title: 'Assignment List', weight: 15 },
  { key: '207', label: 'ICS-207', title: 'Org Chart', weight: 10 },
  { key: '213', label: 'ICS-213', title: 'General Message Log', weight: 0 },
  { key: '215', label: 'ICS-215', title: 'Operational Planning Worksheet', weight: 8 },
  { key: '215a', label: 'ICS-215A', title: 'IAP Safety Analysis', weight: 7 },
  { key: 'hics251', label: 'HICS-251', title: 'Facility System Status Report', weight: 3 },
  { key: 'hics252', label: 'HICS-252', title: 'Action Plan Signature', weight: 2 },
] as const;

type FormKey = typeof FORMS[number]['key'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  IN_REVIEW: { label: 'In Review', color: 'text-amber-700', bg: 'bg-amber-100' },
  APPROVED: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-100' },
  PUBLISHED: { label: 'Published', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  ARCHIVED: { label: 'Archived', color: 'text-gray-500', bg: 'bg-gray-100' },
};

export default function IapEditor() {
  const { incidentId, iapId } = useParams<{ incidentId: string; iapId: string }>();
  const queryClient = useQueryClient();
  const [activeForm, setActiveForm] = useState<FormKey>('202');
  const [showApproval, setShowApproval] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time updates
  useIncidentSocket(incidentId);

  const { data: iap, isLoading } = useQuery({
    queryKey: ['iap', iapId],
    queryFn: () => iapApi.get(iapId!).then(r => r.data),
    enabled: !!iapId,
    refetchInterval: false,
  });

  // Listen for form saves from other users via socket
  useEffect(() => {
    const handler = (data: any) => {
      if (data.iapId === iapId) {
        queryClient.invalidateQueries({ queryKey: ['iap', iapId] });
      }
    };
    // Would attach via useSocket().on() — skipping in this simplified version
  }, [iapId, queryClient]);

  const saveMutation = useMutation({
    mutationFn: ({ formNumber, formData }: { formNumber: string; formData: Record<string, unknown> }) =>
      iapApi.saveForm(iapId!, formNumber, formData),
    onSuccess: () => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ['iap', iapId] });
    },
  });

  const handleAutoSave = useCallback((formNumber: string, formData: Record<string, unknown>) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveMutation.mutate({ formNumber, formData });
    }, 1500); // 1.5s debounce
  }, [saveMutation]);

  const exportMutation = useMutation({
    mutationFn: () => iapApi.requestExport(iapId!),
    onSuccess: (data) => {
      alert(`PDF export queued. Job ID: ${data.data.exportJobId}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!iap) return null;

  const period = iap.operationalPeriod;
  const incident = period.incident;
  const statusCfg = STATUS_CONFIG[iap.status] ?? STATUS_CONFIG.DRAFT;
  const completeness = iap.completenessScore;
  const formCompleteness = iap.formCompleteness ?? {};
  const canEdit = ['DRAFT', 'IN_REVIEW'].includes(iap.status);
  const canWorkflow = iap.status !== 'ARCHIVED';

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      {/* ── Left sidebar: form checklist ─────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* IAP header */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <Link to={`/incidents/${incidentId}`} className="hover:text-gray-900">
              {incident.incidentNumber}
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span>OP {period.periodNumber}</span>
          </div>
          <h2 className="font-bold text-gray-900 text-sm leading-tight">{incident.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Overall completeness bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Completeness</span>
              <span className={completeness >= 60 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                {completeness}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${completeness >= 60 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
            {completeness < 60 && (
              <p className="text-xs text-amber-600 mt-1">Minimum 60% required to submit</p>
            )}
          </div>
        </div>

        {/* Form list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {FORMS.map((form) => {
            const score = formCompleteness[form.key] ?? 0;
            const isActive = activeForm === form.key;
            const isComplete = score === 100;
            const isPartial = score > 0 && score < 100;

            return (
              <button
                key={form.key}
                onClick={() => setActiveForm(form.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-red-50 border-r-2 border-red-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : isPartial ? (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${isActive ? 'text-red-700' : 'text-gray-900'}`}>
                    {form.label}
                    {form.key === '202' && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{form.title}</p>
                </div>
                {form.weight > 0 && (
                  <span className="ml-auto text-xs text-gray-300 flex-shrink-0">{score}%</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-4 py-3 border-t border-gray-200 space-y-2">
          {lastSaved && (
            <p className="text-xs text-gray-400 text-center">
              Saved {lastSaved.toLocaleTimeString()}
            </p>
          )}
          {saveMutation.isPending && (
            <p className="text-xs text-amber-600 text-center flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse inline-block" />
              Saving…
            </p>
          )}
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            Export PDF
          </button>
          {canWorkflow && (
            <button
              onClick={() => setShowApproval(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              <Send className="w-3 h-3" />
              Workflow
            </button>
          )}
        </div>
      </aside>

      {/* ── Main form area ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Form header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {FORMS.find(f => f.key === activeForm)?.label} — {FORMS.find(f => f.key === activeForm)?.title}
              </h1>
              {!canEdit && (
                <p className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                  Read-only — IAP is {iap.status}
                </p>
              )}
            </div>
          </div>

          {/* Active form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <FormRenderer
              formKey={activeForm}
              iap={iap}
              canEdit={canEdit}
              onAutoSave={handleAutoSave}
              facilityId={incident.facilityId}
              incidentId={incident.id}
            />
          </div>
        </div>
      </main>

      {/* Approval panel slide-over */}
      {showApproval && (
        <IapApprovalPanel
          iap={iap}
          onClose={() => setShowApproval(false)}
          onTransition={() => {
            queryClient.invalidateQueries({ queryKey: ['iap', iapId] });
            setShowApproval(false);
          }}
        />
      )}
    </div>
  );
}

function FormRenderer({
  formKey, iap, canEdit, onAutoSave, facilityId, incidentId,
}: {
  formKey: FormKey;
  iap: Iap;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
  facilityId: string;
  incidentId: string;
}) {
  const period = iap.operationalPeriod;
  const props = { canEdit, onAutoSave };

  switch (formKey) {
    case '201':
      return <Form201 data={(period.iapForms201[0]?.formData ?? {}) as any} {...props} />;
    case '202':
      return <Form202 data={(period.iapForms202[0]?.formData ?? {}) as any} {...props} />;
    case '203':
      return <Form203 data={(period.iapForms203[0]?.formData ?? {}) as any} {...props} />;
    case '204':
      return <Form204 forms={period.iapForms204 ?? []} iapId={iap.id} canEdit={canEdit} />;
    case '207':
      return <Form207 data={(period.iapForms207[0]?.formData ?? {}) as any} {...props} />;
    case '213':
      return <Form213 facilityId={facilityId} incidentId={incidentId} />;
    case '215':
      return <Form215 data={(period.iapForms215[0]?.formData ?? {}) as any} {...props} />;
    case '215a':
      return <Form215a data={(period.iapForms215a[0]?.formData ?? {}) as any} {...props} />;
    case 'hics251':
      return <FormHics251 data={(period.iapFormsHics251[0]?.formData ?? {}) as any} {...props} />;
    case 'hics252':
      return <FormHics252 data={(period.iapFormsHics252[0] ?? {}) as any} canEdit={canEdit} />;
    default:
      return null;
  }
}
