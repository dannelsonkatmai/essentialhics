import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field, FormSection, Input, Select } from './FormField';

interface SystemRow {
  name: string;
  status: 'NORMAL' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
  notes: string;
}

const DEFAULT_SYSTEMS: SystemRow[] = [
  { name: 'Emergency Power', status: 'UNKNOWN', notes: '' },
  { name: 'HVAC', status: 'UNKNOWN', notes: '' },
  { name: 'Medical Gases', status: 'UNKNOWN', notes: '' },
  { name: 'IT / Network', status: 'UNKNOWN', notes: '' },
  { name: 'Nurse Call System', status: 'UNKNOWN', notes: '' },
  { name: 'Fire Suppression', status: 'UNKNOWN', notes: '' },
  { name: 'Water / Sanitation', status: 'UNKNOWN', notes: '' },
  { name: 'Communications', status: 'UNKNOWN', notes: '' },
];

const STATUS_COLORS: Record<string, string> = {
  NORMAL: 'text-emerald-600',
  DEGRADED: 'text-amber-600',
  OFFLINE: 'text-red-600',
  UNKNOWN: 'text-gray-400',
};

interface Props {
  data: Record<string, any>;
  canEdit: boolean;
  onAutoSave: (formNumber: string, data: Record<string, unknown>) => void;
}

export default function FormHics251({ data, canEdit, onAutoSave }: Props) {
  const [systems, setSystems] = useState<SystemRow[]>(
    (data.systems as SystemRow[]) ?? DEFAULT_SYSTEMS,
  );
  const [opPeriodStatus, setOpPeriodStatus] = useState(data.operationalPeriodStatus ?? '');
  const [reportedBy, setReportedBy] = useState(data.reportedBy ?? '');
  const [reportedAt, setReportedAt] = useState(data.reportedAt ?? '');
  const [overallStatus, setOverallStatus] = useState(data.overallFacilityStatus ?? 'NORMAL');

  const saveAll = (nextSystems = systems, extra = {}) => {
    onAutoSave('hics251', {
      systems: nextSystems,
      operationalPeriodStatus: opPeriodStatus,
      reportedBy,
      reportedAt,
      overallFacilityStatus: overallStatus,
      ...extra,
    });
  };

  const updateSystem = (idx: number, key: keyof SystemRow, value: string) => {
    const next = systems.map((s, i) => i === idx ? { ...s, [key]: value } : s);
    setSystems(next);
    saveAll(next);
  };

  const addSystem = () => {
    const next = [...systems, { name: '', status: 'UNKNOWN' as const, notes: '' }];
    setSystems(next);
    saveAll(next);
  };

  const removeSystem = (idx: number) => {
    const next = systems.filter((_, i) => i !== idx);
    setSystems(next);
    saveAll(next);
  };

  return (
    <div className="space-y-6">
      <FormSection title="1. Overall Facility Status">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Overall Facility Status" required>
            <Select value={overallStatus} readOnly={!canEdit}
              onChange={e => { setOverallStatus(e.target.value); saveAll(systems, { overallFacilityStatus: e.target.value }); }}>
              <option value="NORMAL">Normal Operations</option>
              <option value="MODIFIED">Modified Operations</option>
              <option value="LIMITED">Limited Operations</option>
              <option value="SHUTDOWN">Partial Shutdown</option>
              <option value="EMERGENCY_ONLY">Emergency Operations Only</option>
            </Select>
          </Field>
          <Field label="Operational Period Status" required>
            <Input value={opPeriodStatus} readOnly={!canEdit}
              onChange={e => { setOpPeriodStatus(e.target.value); saveAll(systems, { operationalPeriodStatus: e.target.value }); }}
              placeholder="e.g. Normal / Alert / Code Yellow" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="2. Facility System Status">
        <div className="space-y-2">
          {systems.map((sys, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <Input value={sys.name} readOnly={!canEdit}
                  onChange={e => updateSystem(idx, 'name', e.target.value)}
                  placeholder="System name" />
              </div>
              <div className="col-span-3">
                <Select value={sys.status} readOnly={!canEdit}
                  onChange={e => updateSystem(idx, 'status', e.target.value)}>
                  <option value="NORMAL">Normal</option>
                  <option value="DEGRADED">Degraded</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="UNKNOWN">Unknown</option>
                </Select>
              </div>
              <div className="col-span-4">
                <Input value={sys.notes} readOnly={!canEdit}
                  onChange={e => updateSystem(idx, 'notes', e.target.value)}
                  placeholder="Notes…" />
              </div>
              {canEdit && (
                <div className="col-span-1 flex justify-center">
                  <button onClick={() => removeSystem(idx)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {canEdit && (
            <button onClick={addSystem}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 mt-1">
              <Plus className="w-3 h-3" /> Add System
            </button>
          )}
        </div>
      </FormSection>

      <FormSection title="3. Reported By">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={reportedBy} readOnly={!canEdit}
              onChange={e => { setReportedBy(e.target.value); saveAll(systems, { reportedBy: e.target.value }); }} />
          </Field>
          <Field label="Date/Time">
            <Input type="datetime-local" value={reportedAt} readOnly={!canEdit}
              onChange={e => { setReportedAt(e.target.value); saveAll(systems, { reportedAt: e.target.value }); }} />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}
