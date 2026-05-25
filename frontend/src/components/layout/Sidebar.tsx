import { NavLink, useParams } from 'react-router-dom';
import { Users, Building2, FileText, Settings, TriangleAlert as AlertTriangle, BookOpen, Package, ClipboardList, DollarSign, Warehouse, ContactRound } from 'lucide-react';

interface NavItem {
  label: string;
  to: string | ((params: Record<string, string | undefined>) => string);
  icon: React.ElementType;
  section?: string;
  /** If true, only show when inside an incident route */
  incidentScoped?: boolean;
}

const navItems: NavItem[] = [
  // Operations (Phase 2)
  { label: 'Incidents', to: '/incidents', icon: AlertTriangle, section: 'Operations' },
  { label: 'Templates', to: '/admin/templates', icon: BookOpen, section: 'Operations' },
  // Incident Operations (Phase 3 — shown when in an incident)
  {
    label: 'Resources',
    to: (p) => p.incidentId ? `/incidents/${p.incidentId}/resources` : '/incidents',
    icon: Package,
    section: 'Incident',
    incidentScoped: true,
  },
  {
    label: 'Requests (213RR)',
    to: (p) => p.incidentId ? `/incidents/${p.incidentId}/requests` : '/incidents',
    icon: ClipboardList,
    section: 'Incident',
    incidentScoped: true,
  },
  {
    label: 'Cost Ledger',
    to: (p) => p.incidentId ? `/incidents/${p.incidentId}/costs` : '/incidents',
    icon: DollarSign,
    section: 'Incident',
    incidentScoped: true,
  },
  // Administration (Phase 1 + 3)
  { label: 'Users', to: '/admin/users', icon: Users, section: 'Admin' },
  { label: 'Personnel Library', to: '/admin/personnel-library', icon: ContactRound, section: 'Admin' },
  { label: 'Facilities', to: '/admin/facilities', icon: Building2, section: 'Admin' },
  { label: 'Resource Catalog', to: '/admin/resource-catalog', icon: Warehouse, section: 'Admin' },
  { label: 'Mutual Aid', to: '/admin/mutual-aid', icon: Users, section: 'Admin' },
  { label: 'Audit Log', to: '/admin/audit-log', icon: FileText, section: 'Admin' },
  { label: 'Settings', to: '/admin/settings', icon: Settings, section: 'Admin' },
];

const sections = ['Operations', 'Incident', 'Admin'];

export default function Sidebar() {
  // useParams works because Sidebar is rendered inside <BrowserRouter> via DashboardShell
  const params = useParams<{ incidentId?: string }>();
  const hasIncident = !!params.incidentId;

  return (
    <aside className="w-56 bg-gray-900 flex flex-col min-h-0">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2 border-b border-gray-700">
        <div className="flex-shrink-0 h-8 w-8 rounded bg-red-600 flex items-center justify-center">
          <AlertTriangle className="h-4 w-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm leading-tight">
          Essential<br />HICS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4">
        {sections.map(section => {
          const items = navItems.filter(i => {
            if (i.section !== section) return false;
            // Hide incident-scoped items when not in an incident
            if (i.incidentScoped && !hasIncident) return false;
            return true;
          });

          // Hide entire Incident section when no incident is active
          if (section === 'Incident' && !hasIncident) return null;
          if (items.length === 0) return null;

          return (
            <div key={section}>
              <p className="px-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section}
              </p>
              <div className="space-y-0.5">
                {items.map(item => {
                  const resolvedTo = typeof item.to === 'function' ? item.to(params) : item.to;
                  return (
                    <NavLink
                      key={resolvedTo}
                      to={resolvedTo}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-red-700 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
