import { useState } from 'react';
import { Field, FormSection, Input } from './FormField';
import PersonnelPicker from './PersonnelPicker';
import type { HicsRole } from '../../../../types';

interface Props {
  data: Record<string, any>;
  canEdit: boolean;
  facilityId?: string;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

const COMMAND_STAFF: { key: string; label: string; hicsRole: HicsRole }[] = [
  { key: 'incidentCommanderName', label: 'Incident Commander', hicsRole: 'INCIDENT_COMMANDER' },
  { key: 'deputyICName', label: 'Deputy IC', hicsRole: 'DEPUTY_INCIDENT_COMMANDER' },
  { key: 'safetyOfficerName', label: 'Safety Officer', hicsRole: 'SAFETY_OFFICER' },
  { key: 'liaisonOfficerName', label: 'Liaison Officer', hicsRole: 'LIAISON_OFFICER' },
  { key: 'publicInfoOfficerName', label: 'Public Information Officer', hicsRole: 'PUBLIC_INFORMATION_OFFICER' },
];

const SECTIONS: {
  key: string;
  label: string;
  roles: { key: string; label: string; hicsRole?: HicsRole }[];
}[] = [
  {
    key: 'operationsSection',
    label: 'Operations Section',
    roles: [
      { key: 'chief', label: 'Chief', hicsRole: 'OPERATIONS_SECTION_CHIEF' },
      { key: 'deputy', label: 'Deputy' },
      { key: 'branchIDirector', label: 'Branch I Director', hicsRole: 'MEDICAL_CARE_BRANCH_DIRECTOR' },
      { key: 'branchIIDirector', label: 'Branch II Director', hicsRole: 'INFRASTRUCTURE_BRANCH_DIRECTOR' },
      { key: 'airOpsDirector', label: 'Air Ops Branch Director' },
    ],
  },
  {
    key: 'planningSection',
    label: 'Planning Section',
    roles: [
      { key: 'chief', label: 'Chief', hicsRole: 'PLANNING_SECTION_CHIEF' },
      { key: 'deputy', label: 'Deputy' },
      { key: 'resourcesUnitLeader', label: 'Resources Unit Leader', hicsRole: 'RESOURCES_UNIT_LEADER' },
      { key: 'situationUnitLeader', label: 'Situation Unit Leader', hicsRole: 'SITUATION_UNIT_LEADER' },
      { key: 'docUnitLeader', label: 'Documentation Unit Leader', hicsRole: 'DOCUMENTATION_UNIT_LEADER' },
    ],
  },
  {
    key: 'logisticsSection',
    label: 'Logistics Section',
    roles: [
      { key: 'chief', label: 'Chief', hicsRole: 'LOGISTICS_SECTION_CHIEF' },
      { key: 'deputy', label: 'Deputy' },
      { key: 'supplyUnitLeader', label: 'Supply Unit Leader', hicsRole: 'SUPPLY_UNIT_LEADER' },
      { key: 'facilitiesUnitLeader', label: 'Facilities Unit Leader', hicsRole: 'FACILITIES_UNIT_LEADER' },
      { key: 'groundSupportUnitLeader', label: 'Ground Support Unit Leader' },
    ],
  },
  {
    key: 'financeSection',
    label: 'Finance / Administration Section',
    roles: [
      { key: 'chief', label: 'Chief', hicsRole: 'FINANCE_ADMIN_SECTION_CHIEF' },
      { key: 'deputy', label: 'Deputy' },
      { key: 'timeUnitLeader', label: 'Time Unit Leader', hicsRole: 'TIME_UNIT_LEADER' },
      { key: 'costUnitLeader', label: 'Cost Unit Leader', hicsRole: 'COST_UNIT_LEADER' },
      { key: 'procurementUnitLeader', label: 'Procurement Unit Leader', hicsRole: 'PROCUREMENT_UNIT_LEADER' },
    ],
  },
];

export default function Form203({ data, canEdit, facilityId, onAutoSave }: Props) {
  const [values, setValues] = useState<Record<string, any>>({
    incidentName: data.incidentName ?? '',
    opPeriodStart: data.opPeriodStart ?? '',
    opPeriodEnd: data.opPeriodEnd ?? '',
    dateTimePrepared: data.dateTimePrepared ?? '',
    ...COMMAND_STAFF.reduce((a, k) => ({ ...a, [k.key]: data[k.key] ?? '' }), {}),
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
          {COMMAND_STAFF.map(({ key, label, hicsRole }) => (
            <Field key={key} label={label}>
              <div className="flex items-center gap-1">
                <Input
                  value={values[key]}
                  readOnly={!canEdit}
                  onChange={e => update(key, e.target.value)}
                  placeholder="Name / Agency"
                  className="flex-1"
                />
                {canEdit && facilityId && (
                  <PersonnelPicker
                    facilityId={facilityId}
                    hicsRole={hicsRole}
                    onSelect={name => update(key, name)}
                  />
                )}
              </div>
            </Field>
          ))}
        </div>
      </FormSection>

      {SECTIONS.map(section => (
        <FormSection key={section.key} title={`3. ${section.label}`}>
          <div className="grid grid-cols-2 gap-3">
            {section.roles.map(role => (
              <Field key={role.key} label={role.label}>
                <div className="flex items-center gap-1">
                  <Input
                    value={(values[section.key] ?? {})[role.key] ?? ''}
                    readOnly={!canEdit}
                    onChange={e => updateSection(section.key, role.key, e.target.value)}
                    placeholder="Name / Agency"
                    className="flex-1"
                  />
                  {canEdit && facilityId && role.hicsRole && (
                    <PersonnelPicker
                      facilityId={facilityId}
                      hicsRole={role.hicsRole}
                      onSelect={name => updateSection(section.key, role.key, name)}
                    />
                  )}
                </div>
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
