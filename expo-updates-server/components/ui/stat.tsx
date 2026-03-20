import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function StatCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-white px-4 py-3', className)} {...props} />;
}

export function StatLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

export function StatValue({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-2xl font-semibold', className)} {...props} />;
}