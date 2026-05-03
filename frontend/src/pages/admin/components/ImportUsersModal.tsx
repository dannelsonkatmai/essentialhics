import { useState, useRef } from 'react';
import { X, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi } from '../../../api/facilities.api';
import type { Facility } from '../../../types';

interface Props {
  onClose: () => void;
  facilities: Facility[];
}

const CSV_TEMPLATE = `first_name,last_name,email,job_title,employee_id,phone_mobile,hics_role
Jane,Smith,jsmith@hospital.org,Charge Nurse,EMP-001,555-0100,RESPONDER
John,Doe,jdoe@hospital.org,Operations Chief,EMP-002,,OPERATIONS_SECTION_CHIEF`;

export default function ImportUsersModal({ onClose, facilities }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const importMutation = useMutation({
    mutationFn: () => facilitiesApi.importUsers(selectedFacility, file!),
    onSuccess: ({ data }) => {
      setResult({ created: data.created, skipped: data.skipped });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'hics-user-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Import users from CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {result ? (
            <div className="text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-medium text-gray-900">Import complete</p>
              <p className="text-sm text-gray-500">
                {result.created} user{result.created !== 1 ? 's' : ''} created.
                {result.skipped > 0 && ` ${result.skipped} skipped (already exist).`}
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="label">Facility</label>
                <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} className="input">
                  <option value="">Select facility…</option>
                  {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">CSV file</label>
                  <button onClick={downloadTemplate} className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1">
                    <Download className="h-3 w-3" /> Download template
                  </button>
                </div>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {file ? (
                    <p className="text-sm text-gray-700">{file.name}</p>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-400 mt-0.5">CSV files only, max 5MB</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".csv" className="sr-only"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              {importMutation.isError && (
                <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  {(importMutation.error as any)?.response?.data?.message ?? 'Import failed.'}
                  {(importMutation.error as any)?.response?.data?.errors?.slice(0, 3).map((e: any) => (
                    <div key={e.row} className="mt-1">Row {e.row}: {e.errors.join(', ')}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <button
              onClick={() => importMutation.mutate()}
              disabled={!file || !selectedFacility || importMutation.isPending}
              className="btn-primary"
            >
              {importMutation.isPending ? 'Importing…' : 'Import users'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
