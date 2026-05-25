import { useState } from 'react';
import { Field, FormSection, Input } from './FormField';
import PersonnelPicker from './PersonnelPicker';
import type { HicsRole } from '../../../../types';

interface OrgNode {
  role: string;
  name: string;
  parentRole?: string;
  hicsRole?: HicsRole;
}

interface Props {
  data: Record<string, any>;
  canEdit: boolean;
  facilityId?: string;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

const DEFAULT_NODES: OrgNode[] = [
  { role: 'Incident Commander', name: '', hicsRole: 'INCIDENT_COMMANDER' },
  { role: 'Deputy IC', name: '', parentRole: 'Incident Commander', hicsRole: 'DEPUTY_INCIDENT_COMMANDER' },
  { role: 'Safety Officer', name: '', parentRole: 'Incident Commander', hicsRole: 'SAFETY_OFFICER' },
  { role: 'Liaison Officer', name: '', parentRole: 'Incident Commander', hicsRole: 'LIAISON_OFFICER' },
  { role: 'Operations Section Chief', name: '', parentRole: 'Incident Commander', hicsRole: 'OPERATIONS_SECTION_CHIEF' },
  { role: 'Planning Section Chief', name: '', parentRole: 'Incident Commander', hicsRole: 'PLANNING_SECTION_CHIEF' },
  { role: 'Logistics Section Chief', name: '', parentRole: 'Incident Commander', hicsRole: 'LOGISTICS_SECTION_CHIEF' },
  { role: 'Finance/Admin Section Chief', name: '', parentRole: 'Incident Commander', hicsRole: 'FINANCE_ADMIN_SECTION_CHIEF' },
];

export default function Form207({ data, canEdit, facilityId, onAutoSave }: Props) {
  const [nodes, setNodes] = useState<OrgNode[]>(
    (data.nodes as OrgNode[])?.map((n, i) => ({ ...DEFAULT_NODES[i], ...n })) ?? DEFAULT_NODES,
  );
  const [incidentName, setIncidentName] = useState(data.incidentName ?? '');
  const [opPeriodStart, setOpPeriodStart] = useState(data.opPeriodStart ?? '');
  const [opPeriodEnd, setOpPeriodEnd] = useState(data.opPeriodEnd ?? '');

  const updateNode = (idx: number, name: string) => {
    const next = nodes.map((n, i) => i === idx ? { ...n, name } : n);
    setNodes(next);
    onAutoSave('207', { incidentName, opPeriodStart, opPeriodEnd, nodes: next });
  };

  const updateHeader = (key: string, value: string) => {
    const next = { incidentName, opPeriodStart, opPeriodEnd, [key]: value, nodes };
    if (key === 'incidentName') setIncidentName(value);
    if (key === 'opPeriodStart') setOpPeriodStart(value);
    if (key === 'opPeriodEnd') setOpPeriodEnd(value);
    onAutoSave('207', next);
  };

  return (
    <div className="space-y-6">
      <FormSection title="1. Incident Information">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Incident Name">
            <Input value={incidentName} readOnly={!canEdit} onChange={e => updateHeader('incidentName', e.target.value)} />
          </Field>
          <Field label="Op Period Start">
            <Input type="datetime-local" value={opPeriodStart} readOnly={!canEdit} onChange={e => updateHeader('opPeriodStart', e.target.value)} />
          </Field>
          <Field label="Op Period End">
            <Input type="datetime-local" value={opPeriodEnd} readOnly={!canEdit} onChange={e => updateHeader('opPeriodEnd', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="2. Org Chart — Assigned Personnel">
        <p className="text-xs text-gray-500 mb-3">
          Enter the name assigned to each HICS position. Use the{' '}
          <span className="inline-flex items-center gap-0.5 text-brand-600 font-medium">library icon</span>
          {' '}to pull from your facility's personnel library.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {nodes.map((node, idx) => (
            <Field key={node.role} label={node.role}>
              <div className="flex items-center gap-1">
                <Input
                  value={node.name}
                  readOnly={!canEdit}
                  onChange={e => updateNode(idx, e.target.value)}
                  placeholder="Assigned person name"
                  className="flex-1"
                />
                {canEdit && facilityId && node.hicsRole && (
                  <PersonnelPicker
                    facilityId={facilityId}
                    hicsRole={node.hicsRole}
                    onSelect={name => updateNode(idx, name)}
                  />
                )}
              </div>
            </Field>
          ))}
        </div>
      </FormSection>
    </div>
  );
}
