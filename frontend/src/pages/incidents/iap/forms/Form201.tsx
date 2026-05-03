import { useState } from 'react';
import { Field, FormSection, Input, Textarea } from './FormField';

interface Props {
  data: Record<string, string>;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

export default function Form201({ data, canEdit, onAutoSave }: Props) {
  const [values, setValues] = useState({
    incidentName: data.incidentName ?? '',
    dateTimePrepared: data.dateTimePrepared ?? '',
    preparedBy: data.preparedBy ?? '',
    preparedByTitle: data.preparedByTitle ?? '',
    currentSituation: data.currentSituation ?? '',
    initialObjectives: data.initialObjectives ?? '',
    currentOrganization: data.currentOrganization ?? '',
    resourcesSummary: data.resourcesSummary ?? '',
    actionsTaken: data.actionsTaken ?? '',
  });

  const update = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onAutoSave('201', next);
  };

  return (
    <div className="space-y-6">
      <FormSection title="1. Incident Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Incident Name" required>
            <Input value={values.incidentName} readOnly={!canEdit}
              onChange={e => update('incidentName', e.target.value)} />
          </Field>
          <Field label="Date/Time Prepared">
            <Input type="datetime-local" value={values.dateTimePrepared} readOnly={!canEdit}
              onChange={e => update('dateTimePrepared', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="2. Current Situation">
        <Textarea value={values.currentSituation} readOnly={!canEdit} rows={5}
          placeholder="Describe the current situation…"
          onChange={e => update('currentSituation', e.target.value)} />
      </FormSection>

      <FormSection title="3. Initial Response Objectives">
        <Textarea value={values.initialObjectives} readOnly={!canEdit} rows={4}
          placeholder="List initial response objectives…"
          onChange={e => update('initialObjectives', e.target.value)} />
      </FormSection>

      <FormSection title="4. Current Organization">
        <Textarea value={values.currentOrganization} readOnly={!canEdit} rows={4}
          placeholder="Describe the current incident organization…"
          onChange={e => update('currentOrganization', e.target.value)} />
      </FormSection>

      <FormSection title="5. Resources Summary">
        <Textarea value={values.resourcesSummary} readOnly={!canEdit} rows={4}
          placeholder="Summarize resources on scene and ordered…"
          onChange={e => update('resourcesSummary', e.target.value)} />
      </FormSection>

      <FormSection title="6. Actions Taken">
        <Textarea value={values.actionsTaken} readOnly={!canEdit} rows={4}
          placeholder="Document key actions taken to date…"
          onChange={e => update('actionsTaken', e.target.value)} />
      </FormSection>

      <FormSection title="7. Prepared By">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={values.preparedBy} readOnly={!canEdit}
              onChange={e => update('preparedBy', e.target.value)} />
          </Field>
          <Field label="Position/Title">
            <Input value={values.preparedByTitle} readOnly={!canEdit}
              onChange={e => update('preparedByTitle', e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}
