import { CheckCircle, Lock } from 'lucide-react';
import { Field, FormSection, Input } from './FormField';

interface Props {
  data: {
    iapSignatureCaptured?: boolean;
    iapSignedAt?: string;
    iapSignedById?: string;
    formData?: Record<string, any>;
  };
  canEdit: boolean;
}

export default function FormHics252({ data, canEdit }: Props) {
  const signed = data?.iapSignatureCaptured ?? false;
  const fd = data?.formData ?? {};

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <strong>Note:</strong> The HICS-252 signature is captured during the <strong>Publish</strong> workflow step.
        Use the "Workflow" button in the sidebar to sign and publish the IAP.
      </div>

      <FormSection title="1. Operational Period">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Incident Name">
            <Input value={fd.incidentName ?? ''} readOnly />
          </Field>
          <Field label="Incident Commander">
            <Input value={fd.incidentCommanderName ?? ''} readOnly />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Op Period Start">
            <Input value={fd.opPeriodStart ?? ''} readOnly />
          </Field>
          <Field label="Op Period End">
            <Input value={fd.opPeriodEnd ?? ''} readOnly />
          </Field>
        </div>
      </FormSection>

      <FormSection title="2. Incident Commander Signature">
        {signed ? (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">IAP Signed and Published</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Signed {data.iapSignedAt ? new Date(data.iapSignedAt).toLocaleString() : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
            <Lock className="w-6 h-6 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-600">Awaiting IC Signature</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Signature will be captured when the IAP is approved and published
              </p>
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="3. Checklist — Attach Before Publishing">
        {[
          'ICS-202 Incident Objectives',
          'ICS-203 Organization Assignment List',
          'ICS-204 Assignment List (all branches)',
          'ICS-207 Org Chart',
          'ICS-215 Operational Planning Worksheet',
          'ICS-215A IAP Safety Analysis',
          'HICS-251 Facility System Status Report',
          'Medical Plan (if applicable)',
          'Traffic Plan (if applicable)',
        ].map((item) => (
          <label key={item} className="flex items-center gap-3 py-1.5 cursor-pointer">
            <input type="checkbox" readOnly={!canEdit}
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" />
            <span className="text-sm text-gray-700">{item}</span>
          </label>
        ))}
      </FormSection>
    </div>
  );
}
