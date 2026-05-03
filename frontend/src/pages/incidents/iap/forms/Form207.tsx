import { useState } from 'react';
import { Field, FormSection, Input } from './FormField';

interface OrgNode {
  role: string;
  name: string;
  parentRole?: string;
}

interface Props {
  data: Record<string, any>;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

const DEFAULT_NODES: OrgNode[] = [
  { role: 'Incident Commander', name: '' },
  { role: 'Deputy IC', name: '', parentRole: 'Incident Commander' },
  { role: 'Safety Officer', name: '', parentRole: 'Incident Commander' },
  { role: 'Liaison Officer', name: '', parentRole: 'Incident Commander' },
  { role: 'Operations Section Chief', name: '', parentRole: 'Incident Commander' },
  { role: 'Planning Section Chief', name: '', parentRole: 'Incident Commander' },
  { role: 'Logistics Section Chief', name: '', parentRole: 'Incident Commander' },
  { role: 'Finance/Admin Section Chief', name: '', parentRole: 'Incident Commander' },
];

export default function Form207({ data, canEdit, onAutoSave }: Props) {
  const [nodes, setNodes] = useState<OrgNode[]>(
    (data.nodes as OrgNode[]) ?? DEFAULT_NODES,
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
        <p className="text-xs text-gray-500 mb-3">Enter the name assigned to each HICS position. The org board auto-populates from position assignments.</p>
        <div className="grid grid-cols-2 gap-3">
          {nodes.map((node, idx) => (
            <Field key={node.role} label={node.role}>
              <Input value={node.name} readOnly={!canEdit} onChange={e => updateNode(idx, e.target.value)}
                placeholder="Assigned person name" />
            </Field>
          ))}
        </div>
      </FormSection>
    </div>
  );
}
