import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronRight, CircleUser as UserCircle, X, Search, RefreshCw } from 'lucide-react';
import { positionsApi, PositionAssignment } from '../../../api/positions.api';
import { useAuthStore } from '../../../stores/auth.store';
import { useIncidentSocket } from '../../../hooks/useSocket';
import { useSocket } from '../../../hooks/useSocket';

// HICS command structure hierarchy
const HICS_ORG: {
  role: string;
  label: string;
  section?: string;
  tier: number;
}[] = [
  { role: 'INCIDENT_COMMANDER', label: 'Incident Commander', tier: 0 },
  { role: 'DEPUTY_INCIDENT_COMMANDER', label: 'Deputy IC', tier: 1 },
  { role: 'SAFETY_OFFICER', label: 'Safety Officer', tier: 1 },
  { role: 'LIAISON_OFFICER', label: 'Liaison Officer', tier: 1 },
  { role: 'PUBLIC_INFORMATION_OFFICER', label: 'PIO', tier: 1 },
  { role: 'OPERATIONS_SECTION_CHIEF', label: 'Operations Chief', section: 'Operations', tier: 2 },
  { role: 'PLANNING_SECTION_CHIEF', label: 'Planning Chief', section: 'Planning', tier: 2 },
  { role: 'LOGISTICS_SECTION_CHIEF', label: 'Logistics Chief', section: 'Logistics', tier: 2 },
  { role: 'FINANCE_ADMINISTRATION_SECTION_CHIEF', label: 'Finance/Admin Chief', section: 'Finance', tier: 2 },
  { role: 'MEDICAL_CARE_BRANCH_DIRECTOR', label: 'Medical Care Branch Dir.', section: 'Operations', tier: 3 },
  { role: 'INFRASTRUCTURE_BRANCH_DIRECTOR', label: 'Infrastructure Branch Dir.', section: 'Operations', tier: 3 },
  { role: 'SECURITY_BRANCH_DIRECTOR', label: 'Security Branch Dir.', section: 'Operations', tier: 3 },
  { role: 'SITUATION_UNIT_LEADER', label: 'Situation Unit Leader', section: 'Planning', tier: 3 },
  { role: 'RESOURCES_UNIT_LEADER', label: 'Resources Unit Leader', section: 'Planning', tier: 3 },
  { role: 'SUPPLY_UNIT_LEADER', label: 'Supply Unit Leader', section: 'Logistics', tier: 3 },
  { role: 'COMMUNICATIONS_UNIT_LEADER', label: 'Communications Unit Leader', section: 'Logistics', tier: 3 },
  { role: 'TIME_UNIT_LEADER', label: 'Time Unit Leader', section: 'Finance', tier: 3 },
  { role: 'COST_UNIT_LEADER', label: 'Cost Unit Leader', section: 'Finance', tier: 3 },
];

interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

function PositionCard({
  roleInfo,
  assignment,
  onVacate,
  canEdit,
}: {
  roleInfo: typeof HICS_ORG[0];
  assignment?: PositionAssignment;
  onVacate: (role: string) => void;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: roleInfo.role });
  const person = assignment?.assignedUser;

  return (
    <div
      ref={setNodeRef}
      className={`relative border rounded-xl p-3 min-w-[160px] transition-all ${
        isOver
          ? 'border-red-400 bg-red-50 shadow-lg scale-105'
          : person
          ? 'border-gray-200 bg-white shadow-sm'
          : 'border-dashed border-gray-300 bg-gray-50'
      }`}
    >
      <p className="text-xs font-semibold text-gray-500 mb-1 truncate">{roleInfo.label}</p>
      {person ? (
        <div className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {person.firstName} {person.lastName}
            </p>
            <p className="text-xs text-gray-400 truncate">{person.email}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => onVacate(roleInfo.role)}
              className="ml-auto text-gray-300 hover:text-red-500 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">
          {canEdit ? 'Drop to assign' : 'Unassigned'}
        </p>
      )}
    </div>
  );
}

function DraggableUser({ user }: { user: StaffUser }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: user.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing bg-white ${
        isDragging ? 'opacity-40' : 'hover:border-red-300 hover:shadow-sm'
      }`}
    >
      <UserCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
      </div>
    </div>
  );
}

export default function OrgBoard() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const user = useAuthStore((s) => s.user);
  const facilityId = user?.roles?.[0]?.facilityId ?? '';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const { on } = useSocket();

  useIncidentSocket(incidentId);

  // Listen for real-time position changes
  useEffect(() => {
    const cleanup = on('position:assigned', () => {
      queryClient.invalidateQueries({ queryKey: ['positions', facilityId, incidentId] });
    });
    const cleanup2 = on('position:relieved', () => {
      queryClient.invalidateQueries({ queryKey: ['positions', facilityId, incidentId] });
    });
    return () => { cleanup(); cleanup2(); };
  }, [on, queryClient, facilityId, incidentId]);

  const { data: assignments = [] } = useQuery({
    queryKey: ['positions', facilityId, incidentId],
    queryFn: () => positionsApi.list(facilityId, incidentId!).then(r => r.data),
    enabled: !!(facilityId && incidentId),
  });

  // For the staff roster panel — in a real app would come from /api/facilities/:id/users
  // Using a simplified static list here; replace with actual API call
  const [staffUsers] = useState<StaffUser[]>([]);

  const assignMutation = useMutation({
    mutationFn: ({ hicsRole, userId }: { hicsRole: string; userId: string }) =>
      positionsApi.assign(facilityId, incidentId!, { hicsRole, userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['positions', facilityId, incidentId] }),
  });

  const vacateMutation = useMutation({
    mutationFn: (hicsRole: string) =>
      positionsApi.vacate(facilityId, incidentId!, hicsRole),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['positions', facilityId, incidentId] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const assignmentMap = assignments.reduce<Record<string, PositionAssignment>>((acc, a) => {
    if (a.isActive) acc[a.hicsRole] = a;
    return acc;
  }, {});

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedUserId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedUserId(null);
    const { active, over } = event;
    if (!over) return;
    assignMutation.mutate({ hicsRole: over.id as string, userId: active.id as string });
  };

  const draggedUser = staffUsers.find(u => u.id === draggedUserId);

  // Group positions by tier
  const tier0 = HICS_ORG.filter(r => r.tier === 0);
  const tier1 = HICS_ORG.filter(r => r.tier === 1);
  const sections = ['Operations', 'Planning', 'Logistics', 'Finance'];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/incidents" className="hover:text-gray-900">Incidents</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/incidents/${incidentId}`} className="hover:text-gray-900">Incident</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">Command Structure</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">HICS Command Structure</h1>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block" />
          Live · Updates in real time
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-6">
          {/* Org board */}
          <div className="flex-1 space-y-6 overflow-x-auto">
            {/* Tier 0 — IC */}
            <div className="flex justify-center">
              {tier0.map(r => (
                <PositionCard key={r.role} roleInfo={r} assignment={assignmentMap[r.role]}
                  onVacate={(role) => vacateMutation.mutate(role)} canEdit={true} />
              ))}
            </div>

            {/* Tier 1 — Command staff */}
            <div className="flex justify-center gap-4 flex-wrap">
              {tier1.map(r => (
                <PositionCard key={r.role} roleInfo={r} assignment={assignmentMap[r.role]}
                  onVacate={(role) => vacateMutation.mutate(role)} canEdit={true} />
              ))}
            </div>

            {/* Tier 2+3 — Sections */}
            <div className="grid grid-cols-4 gap-4">
              {sections.map(section => {
                const chiefRole = HICS_ORG.find(r => r.tier === 2 && r.section === section);
                const subRoles = HICS_ORG.filter(r => r.tier === 3 && r.section === section);
                return (
                  <div key={section} className="space-y-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center pb-1 border-b border-gray-200">
                      {section}
                    </div>
                    {chiefRole && (
                      <PositionCard roleInfo={chiefRole} assignment={assignmentMap[chiefRole.role]}
                        onVacate={(role) => vacateMutation.mutate(role)} canEdit={true} />
                    )}
                    {subRoles.map(r => (
                      <PositionCard key={r.role} roleInfo={r} assignment={assignmentMap[r.role]}
                        onVacate={(role) => vacateMutation.mutate(role)} canEdit={true} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staff roster panel */}
          <aside className="w-56 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 flex-shrink-0 self-start sticky top-4">
            <h3 className="text-sm font-semibold text-gray-900">Staff Roster</h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500"
              />
            </div>
            <p className="text-xs text-gray-400">Drag staff to assign positions</p>
            <div className="space-y-1.5 overflow-y-auto max-h-[60vh]">
              {staffUsers
                .filter(u => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
                .map(u => <DraggableUser key={u.id} user={u} />)}
              {staffUsers.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">
                  Facility users will appear here
                </p>
              )}
            </div>
          </aside>
        </div>

        <DragOverlay>
          {draggedUser && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-300 bg-white shadow-xl">
              <UserCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm font-medium">{draggedUser.firstName} {draggedUser.lastName}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
