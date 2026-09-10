import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function Loader({
  className,
  loaderStyle,
}: {
  loaderStyle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-screen items-center justify-center p-12',
        className,
      )}
    >
      <Loader2
        className={cn('h-8 w-8 animate-spin text-emerald-500', loaderStyle)}
      />
    </div>
  );
}
