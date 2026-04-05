import {
  Children,
  ChangeEvent,
  ReactElement,
  SelectHTMLAttributes,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/utils';

interface OptionItem {
  value: string;
  label: string;
  disabled: boolean;
}

function readOptions(children: SelectHTMLAttributes<HTMLSelectElement>['children']): OptionItem[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) {
      return [];
    }
    const element = child as ReactElement<{ value?: string; disabled?: boolean; children?: unknown }>;
    if (element.type !== 'option') {
      return [];
    }
    const rawValue = `${element.props.value ?? ''}`;
    const label = Children.toArray(element.props.children as any).join('').trim() || rawValue;
    return [
      {
        value: rawValue,
        label,
        disabled: Boolean(element.props.disabled),
      },
    ];
  });
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
  required,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(`${defaultValue ?? ''}`);
  const options = useMemo(() => readOptions(children), [children]);
  const selectedValue = typeof value === 'string' ? value : internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  function emitChange(nextValue: string) {
    if (typeof value !== 'string') {
      setInternalValue(nextValue);
    }
    if (!onChange) {
      return;
    }
    const syntheticEvent = {
      target: {
        value: nextValue,
        name: name ?? '',
      },
    } as ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-white px-3 pr-9 text-start text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        {...(rest as Record<string, unknown>)}
      >
        <span className="block truncate">{selectedOption?.label ?? ''}</span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          ▾
        </span>
      </button>

      <select
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        name={name}
        required={required}
        value={selectedValue}
        onChange={(event) => emitChange(event.target.value)}
      >
        {children}
      </select>

      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-white py-1 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                className={cn(
                  'block w-full px-3 py-2 text-start text-sm transition',
                  option.disabled
                    ? 'cursor-not-allowed text-muted-foreground/60'
                    : isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted',
                )}
                onClick={() => {
                  if (!option.disabled) {
                    emitChange(option.value);
                    setOpen(false);
                  }
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
