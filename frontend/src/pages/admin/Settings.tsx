import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Bell, Shield, Globe, Save, CircleCheck as CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { facilitiesApi } from '../../api/facilities.api';

type TabId = 'organization' | 'notifications' | 'security' | 'system';

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'system', label: 'System', icon: Globe },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('organization');
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesApi.list().then(r => r.data),
  });

  const primaryFacility = (facilities ?? []).find(
    (f: { id: string }) => f.id === user?.primaryFacilityId
  );

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">
            <CheckCircle className="h-4 w-4" /> Changes saved
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'organization' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Primary Facility</h3>
            {primaryFacility ? (
              <div className="space-y-3">
                {[
                  ['Facility name', (primaryFacility as any).name],
                  ['Address', (primaryFacility as any).address ?? '—'],
                  ['City / State', [(primaryFacility as any).city, (primaryFacility as any).state].filter(Boolean).join(', ') || '—'],
                  ['Phone', (primaryFacility as any).phone ?? '—'],
                  ['Type', (primaryFacility as any).facilityType ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center">
                    <span className="w-40 text-sm text-gray-500 flex-shrink-0">{label}</span>
                    <span className="text-sm text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No primary facility assigned.</p>
            )}
            <p className="mt-4 text-xs text-gray-400">
              To update facility details, go to{' '}
              <a href="/admin/facilities" className="text-red-600 hover:underline">Admin &rarr; Facilities</a>.
            </p>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Notification Preferences</h3>
          <p className="text-sm text-gray-500">
            Configure which events generate in-app notifications for your facility.
          </p>
          {[
            { key: 'incident_created', label: 'New incident activated', description: 'Notify when a new incident is created' },
            { key: 'resource_request', label: 'Resource requests', description: 'Notify on new ICS-213RR submissions' },
            { key: 'mutual_aid', label: 'Mutual aid requests', description: 'Notify when a mutual aid request is received' },
            { key: 'iap_approval', label: 'IAP approval needed', description: 'Notify when an IAP is submitted for approval' },
          ].map(item => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
            </label>
          ))}
          <div className="pt-2">
            <button onClick={showSaved} className="btn-primary text-sm flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save preferences
            </button>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Session Policy</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Session timeout (minutes)</label>
                <select className="input w-48">
                  <option value="30">30 minutes</option>
                  <option value="60" selected>60 minutes</option>
                  <option value="120">2 hours</option>
                  <option value="480">8 hours</option>
                </select>
              </div>
              <div>
                <label className="label">Maximum concurrent sessions per user</label>
                <select className="input w-48">
                  <option value="1">1</option>
                  <option value="3" selected>3</option>
                  <option value="5">5</option>
                  <option value="0">Unlimited</option>
                </select>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Password Policy</h3>
            <div className="space-y-3">
              {[
                { key: 'mfa_required', label: 'Require MFA for all users', description: 'Users must set up two-factor authentication' },
                { key: 'strong_pw', label: 'Enforce strong passwords', description: 'Minimum 12 characters with complexity requirements' },
                { key: 'pw_expiry', label: 'Password expiry (90 days)', description: 'Force password reset every 90 days' },
              ].map(item => (
                <label key={item.key} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked={item.key !== 'pw_expiry'} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <button onClick={showSaved} className="btn-primary text-sm flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save security settings
          </button>
        </div>
      )}

      {tab === 'system' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">System Information</h3>
            <div className="space-y-2">
              {[
                ['Application', 'Essential HICS'],
                ['Version', '3.0.0'],
                ['Environment', 'Production'],
                ['Database', 'Supabase (PostgreSQL)'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center">
                  <span className="w-40 text-sm text-gray-500 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-900 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Locale & Display</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Date format</label>
                <select className="input w-64">
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </div>
              <div>
                <label className="label">Time zone</label>
                <select className="input w-64">
                  <option>America/Los_Angeles (PT)</option>
                  <option>America/Denver (MT)</option>
                  <option>America/Chicago (CT)</option>
                  <option>America/New_York (ET)</option>
                  <option>UTC</option>
                </select>
              </div>
            </div>
            <div className="pt-4">
              <button onClick={showSaved} className="btn-primary text-sm flex items-center gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
