/**
 * Resource Catalog
 * Manage resource types (NIMS-typed) and facility inventory levels.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, X, Pencil, Trash2, Warehouse } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { resourcesApi } from '../../api/resources.api';

interface ResourceType {
  id: string;
  name: string;
  nimsKind: string;
  nimsType?: string;
  unit: string;
  defaultCostPerUnit?: string;
  description?: string;
  facilityInventory?: { quantityOnHand: number; quantityAvailable: number; reorderPoint?: number };
}

const NIMS_KINDS = ['PERSONNEL', 'EQUIPMENT', 'TEAM', 'SUPPLY', 'FACILITIES', 'OTHER'] as const;

const typeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nimsKind: z.enum(NIMS_KINDS),
  nimsType: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  defaultCostPerUnit: z.coerce.number().nonnegative().optional(),
  description: z.string().optional(),
});

const inventorySchema = z.object({
  quantityOnHand: z.coerce.number().int().nonnegative(),
  quantityAvailable: z.coerce.number().int().nonnegative(),
  reorderPoint: z.coerce.number().int().nonnegative().optional(),
});

type TypeForm = z.infer<typeof typeSchema>;
type InventoryForm = z.infer<typeof inventorySchema>;

const KIND_COLORS: Record<string, string> = {
  PERSONNEL: 'bg-blue-50 text-blue-700',
  EQUIPMENT: 'bg-amber-50 text-amber-700',
  TEAM: 'bg-purple-50 text-purple-700',
  SUPPLY: 'bg-green-50 text-green-700',
  FACILITIES: 'bg-gray-100 text-gray-700',
  OTHER: 'bg-gray-100 text-gray-500',
};

export default function ResourceCatalog() {
  const { user } = useAuthStore();
  const facilityId = user?.facilityIds?.[0] ?? '';
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);
  const [inventoryType, setInventoryType] = useState<ResourceType | null>(null);
  const [kindFilter, setKindFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Fetch resource types
  const { data: types = [], isLoading } = useQuery({
    queryKey: ['resource-types', facilityId],
    queryFn: async () => {
      const res = await resourcesApi.listTypes(facilityId);
      return res.data as ResourceType[];
    },
    enabled: !!facilityId,
  });

  // Create type form
  const {
    register: regCreate,
    handleSubmit: handleCreate,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<TypeForm>({ resolver: zodResolver(typeSchema), defaultValues: { nimsKind: 'SUPPLY', unit: 'each' } });

  // Edit type form
  const {
    register: regEdit,
    handleSubmit: handleEdit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<TypeForm>({ resolver: zodResolver(typeSchema) });

  // Inventory form
  const {
    register: regInv,
    handleSubmit: handleInv,
    reset: resetInv,
    formState: { errors: invErrors },
  } = useForm<InventoryForm>({ resolver: zodResolver(inventorySchema) });

  const createMutation = useMutation({
    mutationFn: (data: TypeForm) => resourcesApi.createType(facilityId, data),
    onSuccess: () => {
      setShowCreate(false);
      resetCreate();
      queryClient.invalidateQueries({ queryKey: ['resource-types', facilityId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TypeForm }) =>
      resourcesApi.updateType(facilityId, id, data),
    onSuccess: () => {
      setEditingType(null);
      queryClient.invalidateQueries({ queryKey: ['resource-types', facilityId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => resourcesApi.deleteType(facilityId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resource-types', facilityId] }),
  });

  const inventoryMutation = useMutation({
    mutationFn: ({ typeId, data }: { typeId: string; data: InventoryForm }) =>
      resourcesApi.upsertInventory(facilityId, typeId, data),
    onSuccess: () => {
      setInventoryType(null);
      queryClient.invalidateQueries({ queryKey: ['resource-types', facilityId] });
    },
  });

  const openEdit = (type: ResourceType) => {
    setEditingType(type);
    resetEdit({
      name: type.name,
      nimsKind: type.nimsKind as any,
      nimsType: type.nimsType ?? '',
      unit: type.unit,
      defaultCostPerUnit: type.defaultCostPerUnit ? parseFloat(type.defaultCostPerUnit) : undefined,
      description: type.description ?? '',
    });
  };

  const openInventory = (type: ResourceType) => {
    setInventoryType(type);
    resetInv({
      quantityOnHand: type.facilityInventory?.quantityOnHand ?? 0,
      quantityAvailable: type.facilityInventory?.quantityAvailable ?? 0,
      reorderPoint: type.facilityInventory?.reorderPoint ?? undefined,
    });
  };

  const filtered = types.filter((t) => {
    if (kindFilter && t.nimsKind !== kindFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const TypeFormFields = ({ register, errors }: { register: any; errors: any }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input {...register('name')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NIMS Kind *</label>
          <select {...register('nimsKind')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            {NIMS_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NIMS Type</label>
          <input {...register('nimsType')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. Type I, Type II" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
          <input {...register('unit')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="each, hour, gallon…" />
          {errors.unit && <p className="text-xs text-red-600 mt-1">{errors.unit.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Cost/Unit ($)</label>
          <input type="number" step="0.01" {...register('defaultCostPerUnit')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="0.00" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea {...register('description')} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Resource Catalog</h1>
          <span className="text-sm text-gray-500">({types.length} types)</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Type
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search types…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-52"
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => setKindFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              kindFilter === '' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {NIMS_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                kindFilter === k ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Kind / Type', 'Unit', 'Default Cost', 'On Hand', 'Available', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((type) => {
                const inv = type.facilityInventory;
                const lowStock = inv && inv.reorderPoint != null && inv.quantityAvailable <= inv.reorderPoint;
                return (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{type.name}</p>
                        {type.description && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{type.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[type.nimsKind] ?? 'bg-gray-100 text-gray-500'}`}>
                        {type.nimsKind}
                      </span>
                      {type.nimsType && (
                        <span className="ml-1 text-xs text-gray-400">{type.nimsType}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{type.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {type.defaultCostPerUnit
                        ? `$${parseFloat(type.defaultCostPerUnit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {inv ? inv.quantityOnHand : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {inv ? (
                        <span className={lowStock ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {inv.quantityAvailable}
                          {lowStock && <span className="ml-1 text-xs">⚠ low</span>}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openInventory(type)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Manage inventory"
                        >
                          <Warehouse className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(type)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${type.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(type.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>{types.length === 0 ? 'No resource types defined yet' : 'No types match your filters'}</p>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Resource Type</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate((d) => createMutation.mutate(d))} className="space-y-4">
              <TypeFormFields register={regCreate} errors={createErrors} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); resetCreate(); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {createMutation.isPending ? 'Saving…' : 'Save Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingType(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Edit Resource Type</h2>
              <button onClick={() => setEditingType(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEdit((d) => updateMutation.mutate({ id: editingType.id, data: d }))} className="space-y-4">
              <TypeFormFields register={regEdit} errors={editErrors} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingType(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory modal */}
      {inventoryType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setInventoryType(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Inventory</h2>
                <p className="text-sm text-gray-500">{inventoryType.name}</p>
              </div>
              <button onClick={() => setInventoryType(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={handleInv((d) => inventoryMutation.mutate({ typeId: inventoryType.id, data: d }))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">On Hand</label>
                  <input type="number" min={0} {...regInv('quantityOnHand')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                  {invErrors.quantityOnHand && <p className="text-xs text-red-600 mt-1">{invErrors.quantityOnHand.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Available</label>
                  <input type="number" min={0} {...regInv('quantityAvailable')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                  {invErrors.quantityAvailable && <p className="text-xs text-red-600 mt-1">{invErrors.quantityAvailable.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                <input type="number" min={0} {...regInv('reorderPoint')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Optional — triggers low-stock warning" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setInventoryType(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={inventoryMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {inventoryMutation.isPending ? 'Saving…' : 'Update Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
