import { useState } from 'react';
import { Field, FormSection, Input, Textarea, Select } from './FormField';

interface Props {
  data: Record<string, any>;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

export default function Form215({ data, canEdit, onAutoSave }: Props) {
  const [values, setValues] = useState({
    incidentName: data.incidentName ?? '',
    opPeriodStart: data.opPeriodStart ?? '',
    opPeriodEnd: data.opPeriodEnd ?? '',
    hazardRisk: data.hazardRisk ?? '',
    countermeasures: data.countermeasures ?? '',
    siteSafetyPlanRequired: data.siteSafetyPlanRequired ?? 'NO',
    resourceRequirements: data.resourceRequirements ?? '',
    specialEquipment: data.specialEquipment ?? '',
    preparedBy: data.preparedBy ?? '',
    preparedAt: data.preparedAt ?? '',
  });

  const update = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onAutoSave('215', next);
  };

  return (
    <div className="space-y-6">
      <FormSection title="1. Incident Information">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Incident Name" required>
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

      <FormSection title="2. Hazards / Risks">
        <Field label="Hazard / Risk Description" required>
          <Textarea value={values.hazardRisk} readOnly={!canEdit} rows={4}
            onChange={e => update('hazardRisk', e.target.value)}
            placeholder="Describe known hazards and risk factors…" />
        </Field>
      </FormSection>

      <FormSection title="3. Countermeasures">
        <Field label="Countermeasures / Mitigations">
          <Textarea value={values.countermeasures} readOnly={!canEdit} rows={4}
            onChange={e => update('countermeasures', e.target.value)}
            placeholder="List specific countermeasures for each hazard…" />
        </Field>
      </FormSection>

      <FormSection title="4. Site Safety Plan">
        <Field label="Site Safety Plan Required?" required>
          <Select value={values.siteSafetyPlanRequired} readOnly={!canEdit}
            onChange={e => update('siteSafetyPlanRequired', e.target.value)}>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
            <option value="PENDING">Pending Determination</option>
          </Select>
        </Field>
      </FormSection>

      <FormSection title="5. Resource Requirements">
        <Field label="Special Resources / Equipment Needed">
          <Textarea value={values.resourceRequirements} readOnly={!canEdit} rows={3}
            onChange={e => update('resourceRequirements', e.target.value)} />
        </Field>
        <Field label="Special Equipment / PPE">
          <Textarea value={values.specialEquipment} readOnly={!canEdit} rows={3}
            onChange={e => update('specialEquipment', e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Prepared By">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={values.preparedBy} readOnly={!canEdit} onChange={e => update('preparedBy', e.target.value)} />
          </Field>
          <Field label="Date/Time">
            <Input type="datetime-local" value={values.preparedAt} readOnly={!canEdit} onChange={e => update('preparedAt', e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}
