import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookUser, Search, X } from 'lucide-react';
import { personnelLibraryApi } from '../../../../api/personnelLibrary.api';
import type { HicsRole, PersonnelRecord } from '../../../../types';

interface Props {
  facilityId: string;
  hicsRole?: HicsRole;
  onSelect: (name: string) => void;
}

function fullName(p: PersonnelRecord) {
  const base = `${p.firstName} ${p.lastName}`;
  const extras = [p.title, p.agency].filter(Boolean).join(' — ');
  return extras ? `${base} (${extras})` : base;
}

export default function PersonnelPicker({ facilityId, hicsRole, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['personnel-picker', facilityId, hicsRole, search],
    queryFn: () =>
      personnelLibraryApi.list(facilityId, {
        limit: 20,
        search: search || undefined,
        hicsRole: hicsRole,
        status: 'active',
      }).then(r => r.data.data),
    enabled: open && !!facilityId,
    staleTime: 60_000,
  });

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Pick from personnel library"
        className="ml-1 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors"
      >
        <BookUser className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col max-h-64">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search personnel…"
              className="flex-1 text-sm outline-none placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">
                {search ? 'No matches found.' : 'No active personnel on file.'}
              </p>
            )}
            {data?.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(`${p.firstName} ${p.lastName}`);
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                {(p.title || p.agency) && (
                  <p className="text-xs text-gray-400 truncate">
                    {[p.title, p.agency].filter(Boolean).join(' — ')}
                  </p>
                )}
              </button>
            ))}
          </div>

          {!isLoading && (data?.length ?? 0) > 0 && (
            <div className="px-3 py-1.5 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">From facility personnel library</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
