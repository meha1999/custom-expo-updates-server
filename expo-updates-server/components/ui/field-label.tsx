import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface FieldLabelProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  hint: string;
  htmlFor?: string;
}

export function FieldLabel({ label, hint, htmlFor, className, ...props }: FieldLabelProps) {
  return (
    <div className={cn('mb-1 flex items-center gap-1.5', className)} {...props}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <span className="group relative inline-flex">
        <span
          tabIndex={0}
          role="button"
          aria-label={hint}
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground outline-none transition hover:bg-muted/80 focus:ring-2 focus:ring-primary/30"
        >
          ?
        </span>
        <span className="pointer-events-none absolute top-6 z-50 w-56 rounded-md border border-border bg-white p-2 text-[11px] leading-4 text-foreground opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {hint}
        </span>
      </span>
    </div>
  );
}
