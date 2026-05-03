import { useState } from 'react';
import { Field, FormSection, Input, Textarea, Select } from './FormField';

interface Props {
  data: Record<string, any>;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

export default function Form215a({ data, canEdit, onAutoSave }: Props) {
  const [values, setValues] = useState({
    incidentName: data.incidentName ?? '',
    opPeriodStart: data.opPeriodStart ?? '',
    opPeriodEnd: data.opPeriodEnd ?? '',
    hazardousConditions: data.hazardousConditions ?? '',
    mitigations: data.mitigations ?? '',
    monitoringPlan: data.monitoringPlan ?? '',
    completionStatus: data.completionStatus ?? 'IN_PROGRESS',
    safetyOfficer: data.safetyOfficer ?? '',
    dateTime: data.dateTime ?? '',
  });

  const update = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onAutoSave('215a', next);
  };

  return (
    <div className="space-y-6">
      <FormSection title="1. Incident Information">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Incident Name">
            <Input value={values.incidentName} readOnly={!canEdit} onChange={e => update('incidentName', e.target.value)} />
          </Field>
          <Field label="Op Period Start">
            <Input type="datetime-local" value={values.opPeriodStart} readOnly={!canEdit} onChange={e => update('opPeriodStart', e.target.value)} />
          </Field>
          <Field label="Op Period End">
            <Input type="datetime-local" value={values.opPeriodEnd} readOnly={!canEdit} onChange={e => update('opPeriodEnd', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="2. Hazardous Conditions">
        <Textarea value={values.hazardousConditions} readOnly={!canEdit} rows={4}
          onChange={e => update('hazardousConditions', e.target.value)}
          placeholder="List all known hazardous conditions for this operational period…" />
      </FormSection>

      <FormSection title="3. Mitigations">
        <Textarea value={values.mitigations} readOnly={!canEdit} rows={4}
          onChange={e => update('mitigations', e.target.value)}
          placeholder="Specific mitigations for each hazardous condition listed above…" />
      </FormSection>

      <FormSection title="4. Monitoring Plan">
        <Textarea value={values.monitoringPlan} readOnly={!canEdit} rows={3}
          onChange={e => update('monitoringPlan', e.target.value)}
          placeholder="How will conditions be monitored during the operational period…" />
      </FormSection>

      <FormSection title="5. Status">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Completion Status">
            <Select value={values.completionStatus} readOnly={!canEdit}
              onChange={e => update('completionStatus', e.target.value)}>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETE">Complete</option>
              <option value="NOT_REQUIRED">Not Required</option>
            </Select>
          </Field>
          <Field label="Safety Officer">
            <Input value={values.safetyOfficer} readOnly={!canEdit} onChange={e => update('safetyOfficer', e.target.value)} />
          </Field>
          <Field label="Date/Time">
            <Input type="datetime-local" value={values.dateTime} readOnly={!canEdit} onChange={e => update('dateTime', e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}
