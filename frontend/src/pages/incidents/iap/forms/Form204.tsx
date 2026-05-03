import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { iapApi } from '../../../../api/iap.api';
import { Field, Input, Textarea } from './FormField';

interface Form204Record {
  id?: string;
  branchName: string;
  divisionGroupName: string;
  formData: Record<string, any>;
}

interface Props {
  forms: any[];
  iapId: string;
  canEdit: boolean;
}

function AssignmentRow({
  form, iapId, canEdit, onSaved,
}: {
  form: Form204Record;
  iapId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(!form.id);
  const [values, setValues] = useState({
    branchName: form.branchName ?? '',
    divisionGroupName: form.divisionGroupName ?? '',
    supervisorName: form.formData?.supervisorName ?? '',
    supervisorContact: form.formData?.supervisorContact ?? '',
    resources: form.formData?.resources ?? '',
    workAssignments: form.formData?.workAssignments ?? '',
    specialInstructions: form.formData?.specialInstructions ?? '',
    communications: form.formData?.communications ?? '',
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const dto = {
        branchName: values.branchName,
        divisionGroupName: values.divisionGroupName,
        formData: { ...values },
      };
      return form.id
        ? iapApi.updateForm204(iapId, form.id, dto)
        : iapApi.saveForm204(iapId, dto);
    },
    onSuccess: onSaved,
  });

  const update = (key: string, value: string) => setValues(v => ({ ...v, [key]: value }));

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-gray-900">
            {values.branchName || 'New Branch'} / {values.divisionGroupName || 'New Division'}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch" required>
              <Input value={values.branchName} readOnly={!canEdit}
                onChange={e => update('branchName', e.target.value)} placeholder="e.g. Operations Branch" />
            </Field>
            <Field label="Division / Group" required>
              <Input value={values.divisionGroupName} readOnly={!canEdit}
                onChange={e => update('divisionGroupName', e.target.value)} placeholder="e.g. Division A" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Supervisor Name">
              <Input value={values.supervisorName} readOnly={!canEdit}
                onChange={e => update('supervisorName', e.target.value)} />
            </Field>
            <Field label="Contact / Radio">
              <Input value={values.supervisorContact} readOnly={!canEdit}
                onChange={e => update('supervisorContact', e.target.value)} />
            </Field>
          </div>

          <Field label="Resources Assigned">
            <Textarea value={values.resources} readOnly={!canEdit} rows={3}
              onChange={e => update('resources', e.target.value)}
              placeholder="List personnel and equipment assigned…" />
          </Field>

          <Field label="Work Assignments">
            <Textarea value={values.workAssignments} readOnly={!canEdit} rows={3}
              onChange={e => update('workAssignments', e.target.value)}
              placeholder="Describe specific tasks and assignments…" />
          </Field>

          <Field label="Special Instructions">
            <Textarea value={values.specialInstructions} readOnly={!canEdit} rows={2}
              onChange={e => update('specialInstructions', e.target.value)} />
          </Field>

          <Field label="Communications (Radio / Freq.)">
            <Input value={values.communications} readOnly={!canEdit}
              onChange={e => update('communications', e.target.value)} />
          </Field>

          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving…' : form.id ? 'Update' : 'Save Assignment'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Form204({ forms, iapId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Form204Record[]>([]);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['iap', iapId] });
    setDrafts([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {forms.length} assignment{forms.length !== 1 ? 's' : ''} in this period
        </p>
        {canEdit && (
          <button
            onClick={() => setDrafts(d => [...d, { branchName: '', divisionGroupName: '', formData: {} }])}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="w-3 h-3" />
            Add Assignment
          </button>
        )}
      </div>

      {forms.length === 0 && drafts.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          No assignments yet. Click "Add Assignment" to begin.
        </div>
      )}

      {forms.map((form) => (
        <AssignmentRow key={form.id} form={form} iapId={iapId} canEdit={canEdit} onSaved={handleSaved} />
      ))}

      {drafts.map((draft, idx) => (
        <AssignmentRow key={`draft-${idx}`} form={draft} iapId={iapId} canEdit={canEdit} onSaved={handleSaved} />
      ))}
    </div>
  );
}
