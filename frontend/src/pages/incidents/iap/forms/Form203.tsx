import { useState } from 'react';
import { Field, FormSection, Input } from './FormField';

interface Props {
  data: Record<string, any>;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

const COMMAND_STAFF = ['incidentCommanderName', 'deputyICName', 'safetyOfficerName', 'liaisonOfficerName', 'publicInfoOfficerName'];
const COMMAND_STAFF_LABELS: Record<string, string> = {
  incidentCommanderName: 'Incident Commander',
  deputyICName: 'Deputy IC',
  safetyOfficerName: 'Safety Officer',
  liaisonOfficerName: 'Liaison Officer',
  publicInfoOfficerName: 'Public Information Officer',
};

const SECTIONS = [
  {
    key: 'operationsSection',
    label: 'Operations Section',
    roles: ['chief', 'deputy', 'branchIDirector', 'branchIIDirector', 'airOpsDirector'],
    roleLabels: { chief: 'Chief', deputy: 'Deputy', branchIDirector: 'Branch I Director', branchIIDirector: 'Branch II Director', airOpsDirector: 'Air Ops Branch Director' },
  },
  {
    key: 'planningSection',
    label: 'Planning Section',
    roles: ['chief', 'deputy', 'resourcesUnitLeader', 'situationUnitLeader', 'docUnitLeader'],
    roleLabels: { chief: 'Chief', deputy: 'Deputy', resourcesUnitLeader: 'Resources Unit Leader', situationUnitLeader: 'Situation Unit Leader', docUnitLeader: 'Documentation Unit Leader' },
  },
  {
    key: 'logisticsSection',
    label: 'Logistics Section',
    roles: ['chief', 'deputy', 'supplyUnitLeader', 'facilitiesUnitLeader', 'groundSupportUnitLeader'],
    roleLabels: { chief: 'Chief', deputy: 'Deputy', supplyUnitLeader: 'Supply Unit Leader', facilitiesUnitLeader: 'Facilities Unit Leader', groundSupportUnitLeader: 'Ground Support Unit Leader' },
  },
  {
    key: 'financeSection',
    label: 'Finance / Administration Section',
    roles: ['chief', 'deputy', 'timeUnitLeader', 'costUnitLeader', 'procurementUnitLeader'],
    roleLabels: { chief: 'Chief', deputy: 'Deputy', timeUnitLeader: 'Time Unit Leader', costUnitLeader: 'Cost Unit Leader', procurementUnitLeader: 'Procurement Unit Leader' },
  },
];

export default function Form203({ data, canEdit, onAutoSave }: Props) {
  const [values, setValues] = useState<Record<string, any>>({
    incidentName: data.incidentName ?? '',
    opPeriodStart: data.opPeriodStart ?? '',
    opPeriodEnd: data.opPeriodEnd ?? '',
    dateTimePrepared: data.dateTimePrepared ?? '',
    ...COMMAND_STAFF.reduce((a, k) => ({ ...a, [k]: data[k] ?? '' }), {}),
    ...SECTIONS.reduce((a, s) => ({ ...a, [s.key]: data[s.key] ?? {} }), {}),
  });

  const update = (key: string, value: any) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onAutoSave('203', next);
  };

  const updateSection = (sectionKey: string, roleKey: string, value: string) => {
    const next = { ...values, [sectionKey]: { ...(values[sectionKey] ?? {}), [roleKey]: value } };
    setValues(next);
    onAutoSave('203', next);
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

      <FormSection title="2. Command Staff">
        <div className="grid grid-cols-2 gap-3">
          {COMMAND_STAFF.map(k => (
            <Field key={k} label={COMMAND_STAFF_LABELS[k]}>
              <Input value={values[k]} readOnly={!canEdit} onChange={e => update(k, e.target.value)}
                placeholder="Name / Agency" />
            </Field>
          ))}
        </div>
      </FormSection>

      {SECTIONS.map(section => (
        <FormSection key={section.key} title={`3. ${section.label}`}>
          <div className="grid grid-cols-2 gap-3">
            {section.roles.map(role => (
              <Field key={role} label={(section.roleLabels as any)[role]}>
                <Input
                  value={(values[section.key] ?? {})[role] ?? ''}
                  readOnly={!canEdit}
                  onChange={e => updateSection(section.key, role, e.target.value)}
                  placeholder="Name / Agency"
                />
              </Field>
            ))}
          </div>
        </FormSection>
      ))}

      <FormSection title="Prepared By">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date/Time Prepared">
            <Input type="datetime-local" value={values.dateTimePrepared} readOnly={!canEdit}
              onChange={e => update('dateTimePrepared', e.target.value)} />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}
