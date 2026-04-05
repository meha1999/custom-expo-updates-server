import { ReactNode, useEffect } from 'react';
import { Button } from './button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  widthClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  widthClassName = 'max-w-2xl',
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="absolute inset-0 overflow-y-auto p-4">
        <div
          className={`mx-auto mt-12 w-full ${widthClassName} rounded-xl border border-slate-300 bg-white p-4 shadow-[0_24px_60px_rgba(2,6,23,0.28)] ring-1 ring-slate-200 md:p-5`}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
