import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';
import { X, CircleCheck as CheckCircle, RotateCcw, Send, Lock, Archive } from 'lucide-react';
import { iapApi, Iap, IapStatus } from '../../../api/iap.api';
import { writeAuditLog } from '../../../api/auditLog.api';
import { usePermission } from '../../../hooks/usePermission';

const STEPS: { status: IapStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'IN_REVIEW', label: 'In Review' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'PUBLISHED', label: 'Published' },
  { status: 'ARCHIVED', label: 'Archived' },
];

const STATUS_ORDER = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];

interface Props {
  iap: Iap;
  onClose: () => void;
  onTransition: () => void;
}

export default function IapApprovalPanel({ iap, onClose, onTransition }: Props) {
  const [returnNotes, setReturnNotes] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const canApprove = usePermission('iap:approve');

  const currentStepIdx = STATUS_ORDER.indexOf(iap.status);

  const submitMutation = useMutation({
    mutationFn: () => iapApi.submit(iap.id),
    onSuccess: () => { writeAuditLog({ action: 'IAP_SUBMITTED', resourceType: 'IAP', resourceId: iap.id }); onTransition(); },
  });

  const approveMutation = useMutation({
    mutationFn: () => iapApi.approve(iap.id),
    onSuccess: () => { writeAuditLog({ action: 'IAP_APPROVED', resourceType: 'IAP', resourceId: iap.id }); onTransition(); },
  });

  const returnMutation = useMutation({
    mutationFn: () => iapApi.returnToDraft(iap.id, returnNotes),
    onSuccess: () => { writeAuditLog({ action: 'IAP_RETURNED', resourceType: 'IAP', resourceId: iap.id }); onTransition(); },
  });

  const publishMutation = useMutation({
    mutationFn: (sigData: string) => iapApi.publish(iap.id, sigData),
    onSuccess: () => { writeAuditLog({ action: 'IAP_PUBLISHED', resourceType: 'IAP', resourceId: iap.id }); onTransition(); },
  });

  const archiveMutation = useMutation({
    mutationFn: () => iapApi.archive(iap.id),
    onSuccess: () => { writeAuditLog({ action: 'IAP_ARCHIVED', resourceType: 'IAP', resourceId: iap.id }); onTransition(); },
  });

  const handlePublish = () => {
    const sig = sigCanvasRef.current;
    if (!sig || sig.isEmpty()) {
      alert('Please sign the IAP before publishing.');
      return;
    }
    const signatureData = sig.toDataURL('image/png');
    publishMutation.mutate(signatureData);
  };

  const isLoading = submitMutation.isPending || approveMutation.isPending ||
    returnMutation.isPending || publishMutation.isPending || archiveMutation.isPending;

  const errorMsg = [submitMutation, approveMutation, returnMutation, publishMutation, archiveMutation]
    .find(m => m.isError)?.error as any;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <aside className="w-96 bg-white shadow-2xl flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">IAP Workflow</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress stepper */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center">
            {STEPS.map((step, idx) => {
              const isDone = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const isLast = idx === STEPS.length - 1;
              return (
                <div key={step.status} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                      isCurrent ? 'bg-red-600 border-red-600 text-white' :
                      'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {isDone ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-xs mt-1 font-medium ${isCurrent ? 'text-red-600' : isDone ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 ${idx < currentStepIdx ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Completeness */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Overall Completeness</span>
            <span className={`font-bold ${iap.completenessScore >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {iap.completenessScore}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${iap.completenessScore >= 60 ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${iap.completenessScore}%` }}
            />
          </div>
          {iap.completenessScore < 60 && (
            <p className="text-xs text-amber-600 mt-1">60% required to submit</p>
          )}
          {(iap.formCompleteness?.['202'] ?? 0) < 100 && (
            <p className="text-xs text-red-600 mt-1">ICS-202 must be 100% complete</p>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {errorMsg?.response?.data?.message ?? 'Action failed. Please try again.'}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-5 space-y-3 flex-1">

          {/* DRAFT → submit for review */}
          {iap.status === 'DRAFT' && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={isLoading || iap.completenessScore < 60 || (iap.formCompleteness?.['202'] ?? 0) < 100}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              Submit for Review
            </button>
          )}

          {/* IN_REVIEW → approve or return */}
          {iap.status === 'IN_REVIEW' && canApprove && (
            <>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40"
              >
                <CheckCircle className="w-4 h-4" />
                Approve IAP
              </button>
              <button
                onClick={() => setShowReturnForm(true)}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                Return to Draft
              </button>
            </>
          )}

          {/* Return-to-draft form */}
          {showReturnForm && (
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Return Notes (required)</label>
              <textarea
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                rows={4}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                placeholder="Explain what needs to be corrected before resubmission…"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowReturnForm(false); setReturnNotes(''); }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => returnMutation.mutate()}
                  disabled={returnNotes.length < 10 || isLoading}
                  className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40"
                >
                  Confirm Return
                </button>
              </div>
            </div>
          )}

          {/* APPROVED → publish with signature */}
          {iap.status === 'APPROVED' && canApprove && !showSignaturePad && (
            <button
              onClick={() => setShowSignaturePad(true)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-40"
            >
              <Lock className="w-4 h-4" />
              Sign &amp; Publish IAP
            </button>
          )}

          {/* Signature pad */}
          {iap.status === 'APPROVED' && showSignaturePad && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Sign below as Incident Commander to publish this IAP.
                Your signature will be captured on HICS-252.
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="#1e3a5f"
                  canvasProps={{ width: 320, height: 120, className: 'w-full' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => sigCanvasRef.current?.clear()}
                  className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40"
                >
                  {publishMutation.isPending ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          )}

          {/* PUBLISHED → archive */}
          {iap.status === 'PUBLISHED' && canApprove && (
            <button
              onClick={() => {
                if (confirm('Archive this IAP? It will become read-only.')) {
                  archiveMutation.mutate();
                }
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              <Archive className="w-4 h-4" />
              Archive IAP
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
