import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Trash2, ChevronRight, BookOpen, Target, Zap } from 'lucide-react';
import { templatesApi, IapTemplate } from '../../../api/templates.api';
import { useAuthStore } from '../../../stores/auth.store';

type Tab = 'templates' | 'objectives' | 'tactics';

export default function TemplateLibrary() {
  const user = useAuthStore(s => s.user);
  const facilityId = user?.roles?.[0]?.facilityId;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('templates');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<IapTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', facilityId],
    queryFn: () => templatesApi.list(facilityId).then(r => r.data),
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ['objectives', facilityId],
    queryFn: () => templatesApi.listObjectives(facilityId).then(r => r.data),
    enabled: tab === 'objectives',
  });

  const { data: tactics = [] } = useQuery({
    queryKey: ['tactics', facilityId],
    queryFn: () => templatesApi.listTactics(facilityId).then(r => r.data),
    enabled: tab === 'tactics',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => templatesApi.duplicate(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IAP Template Library</h1>
          <p className="text-sm text-gray-500 mt-1">Manage reusable templates, objectives, and tactics</p>
        </div>
        {tab === 'templates' && (
          <button
            onClick={() => setShowCreateTemplate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
        {tab === 'objectives' && (
          <button
            onClick={() => {/* open modal */}}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            <Plus className="w-4 h-4" />
            Add Objective
          </button>
        )}
        {tab === 'tactics' && (
          <button
            onClick={() => {/* open modal */}}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            <Plus className="w-4 h-4" />
            Add Tactic
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'templates', label: 'Templates', icon: BookOpen },
          { key: 'objectives', label: 'Objectives Bank', icon: Target },
          { key: 'tactics', label: 'Tactics Bank', icon: Zap },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Templates */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : templates.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No templates yet. Create one to pre-fill IAP forms.</p>
            </div>
          ) : (
            (templates as IapTemplate[]).map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    {t.parentTemplate && (
                      <p className="text-xs text-gray-400 mt-0.5">Inherits from: {t.parentTemplate.name}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => duplicateMutation.mutate({ id: t.id, name: `${t.name} (Copy)` })}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this template?')) deleteMutation.mutate(t.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {t.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{t._count?.formDefaults ?? 0} form defaults</span>
                  <button
                    onClick={() => setSelectedTemplate(t)}
                    className="text-xs text-red-600 font-medium hover:underline flex items-center gap-1"
                  >
                    Edit <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Objectives Bank */}
      {tab === 'objectives' && (
        <div className="space-y-3">
          {(objectives as any[]).length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No objectives in the bank yet.</p>
            </div>
          ) : (
            (objectives as any[]).map((obj: any) => (
              <div key={obj.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{obj.objectiveText}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      obj.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                      obj.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      obj.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{obj.priority}</span>
                    {(obj.tags ?? []).map((tag: string) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>
                    ))}
                    <span className="text-xs text-gray-400 ml-auto">Used {obj.usageCount}×</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tactics Bank */}
      {tab === 'tactics' && (
        <div className="space-y-3">
          {(tactics as any[]).length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No tactics in the bank yet.</p>
            </div>
          ) : (
            (tactics as any[]).map((tac: any) => (
              <div key={tac.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{tac.tacticText}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {(tac.tags ?? []).map((tag: string) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>
                    ))}
                    <span className="text-xs text-gray-400 ml-auto">Used {tac.usageCount}×</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create template modal */}
      {showCreateTemplate && (
        <CreateTemplateModal
          onClose={() => setShowCreateTemplate(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            setShowCreateTemplate(false);
          }}
          facilityId={facilityId}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({ onClose, onCreated, facilityId }: {
  onClose: () => void;
  onCreated: () => void;
  facilityId?: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () => templatesApi.create({ name, description, facilityId }),
    onSuccess: onCreated,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900">New IAP Template</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            placeholder="e.g. Mass Casualty Template" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            placeholder="When to use this template…" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
