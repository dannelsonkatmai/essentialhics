/**
 * Shared field components for IAP forms.
 */

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-1">{title}</h3>
      {children}
    </div>
  );
}

export function Field({ label, required, error, children, hint }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readOnly?: boolean;
}

export function Input({ readOnly, className = '', ...props }: InputProps) {
  return (
    <input
      readOnly={readOnly}
      className={`w-full border ${readOnly ? 'bg-gray-50 text-gray-500 border-gray-200' : 'border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent'} rounded-lg px-3 py-2 text-sm ${className}`}
      {...props}
    />
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  readOnly?: boolean;
}

export function Textarea({ readOnly, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      readOnly={readOnly}
      className={`w-full border ${readOnly ? 'bg-gray-50 text-gray-500 border-gray-200' : 'border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent'} rounded-lg px-3 py-2 text-sm resize-none ${className}`}
      {...props}
    />
  );
}

export function Select({ readOnly, children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { readOnly?: boolean }) {
  if (readOnly) {
    return <Input readOnly value={String(props.value ?? '')} />;
  }
  return (
    <select
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
