import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';

export function EditableCard({ children, className, label, onEdit }: {
  children: ReactNode;
  className: string;
  label: string;
  onEdit?: () => void;
}) {
  return (
    <div className={`relative ${className} ${onEdit ? 'pr-9' : ''}`}>
      {children}
      {onEdit && (
        <button type="button" aria-label={label} onClick={onEdit} className="absolute inset-0 flex items-start justify-end rounded-2xl p-3 text-slate-400 hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-sky-500">
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
