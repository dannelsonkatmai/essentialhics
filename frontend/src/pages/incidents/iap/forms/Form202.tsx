import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Field, FormSection, Input } from './FormField';

interface Props {
  data: Record<string, string>;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

function RichTextEditor({
  content, editable, onChange, placeholder,
}: {
  content: string; editable: boolean; onChange: (v: string) => void; placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? 'Enter text…' }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <div className={`min-h-[120px] border rounded-lg p-3 text-sm ${
      editable ? 'border-gray-300 focus-within:ring-2 focus-within:ring-red-500' : 'border-gray-200 bg-gray-50'
    }`}>
      <EditorContent editor={editor} />
    </div>
  );
}

export default function Form202({ data, canEdit, onAutoSave }: Props) {
  const [values, setValues] = useState({
    incidentName: data.incidentName ?? '',
    opPeriodStart: data.opPeriodStart ?? '',
    opPeriodEnd: data.opPeriodEnd ?? '',
    incidentObjectives: data.incidentObjectives ?? '',
    weatherForecast: data.weatherForecast ?? '',
    generalSafety: data.generalSafety ?? '',
    siteAccessEgress: data.siteAccessEgress ?? '',
    attachments: data.attachments ?? '',
    approvedBy: data.approvedBy ?? '',
    approvedAt: data.approvedAt ?? '',
  });

  const update = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onAutoSave('202', next);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800">
        <strong>Required:</strong> ICS-202 must be 100% complete before the IAP can be submitted for review.
      </div>

      <FormSection title="1. Incident Information">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <Field label="Incident Name" required>
              <Input value={values.incidentName} readOnly={!canEdit}
                onChange={e => update('incidentName', e.target.value)} />
            </Field>
          </div>
          <Field label="Op Period Start" required>
            <Input type="datetime-local" value={values.opPeriodStart} readOnly={!canEdit}
              onChange={e => update('opPeriodStart', e.target.value)} />
          </Field>
          <Field label="Op Period End" required>
            <Input type="datetime-local" value={values.opPeriodEnd} readOnly={!canEdit}
              onChange={e => update('opPeriodEnd', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="2. Incident Objectives">
        <Field label="Objectives" required hint="Clearly state the measurable objectives for this operational period">
          <RichTextEditor
            content={values.incidentObjectives}
            editable={canEdit}
            onChange={v => update('incidentObjectives', v)}
            placeholder="1. Contain fire to west wing…&#10;2. Establish unified command…"
          />
        </Field>
      </FormSection>

      <FormSection title="3. Weather / Environmental">
        <Field label="Weather Forecast" required>
          <RichTextEditor
            content={values.weatherForecast}
            editable={canEdit}
            onChange={v => update('weatherForecast', v)}
            placeholder="Current and forecast weather conditions…"
          />
        </Field>
      </FormSection>

      <FormSection title="4. Safety Message">
        <Field label="General Safety Message" required>
          <RichTextEditor
            content={values.generalSafety}
            editable={canEdit}
            onChange={v => update('generalSafety', v)}
            placeholder="Key safety hazards and precautions…"
          />
        </Field>
      </FormSection>

      <FormSection title="5. Site Access / Egress">
        <Field label="Site Access and Egress" required>
          <RichTextEditor
            content={values.siteAccessEgress}
            editable={canEdit}
            onChange={v => update('siteAccessEgress', v)}
            placeholder="Describe routes to/from incident site…"
          />
        </Field>
      </FormSection>

      <FormSection title="6. Attachments">
        <Field label="Attachments / Notes">
          <RichTextEditor
            content={values.attachments}
            editable={canEdit}
            onChange={v => update('attachments', v)}
            placeholder="List any attached forms or documents…"
          />
        </Field>
      </FormSection>

      <FormSection title="7. Prepared / Approved By">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Approved By (IC/UC Name)">
            <Input value={values.approvedBy} readOnly={!canEdit}
              onChange={e => update('approvedBy', e.target.value)} />
          </Field>
          <Field label="Date/Time">
            <Input type="datetime-local" value={values.approvedAt} readOnly={!canEdit}
              onChange={e => update('approvedAt', e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}
