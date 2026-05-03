import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { iapApi } from '../../../../api/iap.api';
import { Field, Input, Textarea } from './FormField';

interface Props {
  facilityId: string;
  incidentId: string;
}

export default function Form213({ facilityId, incidentId }: Props) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ to: '', from: '', subject: '', date: '', time: '', message: '', reply: '' });

  const { data } = useQuery({
    queryKey: ['form213', incidentId],
    queryFn: () => iapApi.listMessages213(facilityId, incidentId).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => iapApi.createMessage213(facilityId, incidentId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form213', incidentId] });
      setShowNew(false);
      setForm({ to: '', from: '', subject: '', date: '', time: '', message: '', reply: '' });
    },
  });

  const messages = (data as any)?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{messages.length} message(s)</p>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus className="w-3 h-3" /> New Message
        </button>
      </div>

      {showNew && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-900">New General Message</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="To"><Input value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} /></Field>
            <Field label="From"><Input value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} /></Field>
          </div>
          <Field label="Subject"><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="Time"><Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></Field>
          </div>
          <Field label="Message">
            <Textarea value={form.message} rows={4} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              {createMutation.isPending ? 'Saving…' : 'Save Message'}
            </button>
          </div>
        </div>
      )}

      {messages.length === 0 && !showNew ? (
        <div className="text-center py-10 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No messages yet
        </div>
      ) : (
        messages.map((msg: any) => (
          <div key={msg.id} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{(msg.formData as any)?.subject}</p>
                <p className="text-xs text-gray-500">To: {(msg.formData as any)?.to} · From: {(msg.formData as any)?.from}</p>
              </div>
              <span className="text-xs text-gray-400">{format(new Date(msg.createdAt), 'MMM d, HH:mm')}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{(msg.formData as any)?.message}</p>
          </div>
        ))
      )}
    </div>
  );
}
