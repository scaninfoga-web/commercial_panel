import { cn } from '@/lib/utils';

export function CustomProgress({ value = 0, variant = 'default', className }: { value?: number; variant?: 'default' | 'danger'; className?: string }) {
  const progress = Math.max(0, Math.min(100, value));
  return <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-800', className)}><div className={cn('h-full rounded-full transition-all', variant === 'danger' ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${progress}%` }} /></div>;
}
