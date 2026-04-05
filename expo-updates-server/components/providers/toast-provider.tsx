import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const typeClasses: Record<ToastType, string> = {
  success: 'border-success bg-success text-white',
  error: 'border-danger bg-danger text-white',
  info: 'border-primary bg-primary text-primary-foreground',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType) => {
      const id = ++idRef.current;
      setToasts((current) => [...current, { id, message, type }]);
      setTimeout(() => dismiss(id), 3800);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
      info: (message) => show(message, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 z-50 w-full px-4 sm:right-4 sm:left-auto sm:w-[420px]">
        <div className="space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-start justify-between gap-3 rounded-md border p-3 text-sm shadow-[0_18px_40px_rgba(2,6,23,0.24)]',
                typeClasses[toast.type],
              )}
              role="status"
              aria-live="polite"
            >
              <p className="min-w-0 flex-1 break-words">{toast.message}</p>
              <button
                type="button"
                className="text-xs font-medium opacity-90 transition hover:opacity-100"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                Close
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return value;
}
