import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', value, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'placeholder:gray-800 flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-base ring-offset-background [appearance:textfield] file:border-0 file:bg-transparent file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
      ref={ref}
      {...(value !== undefined ? { value } : {})}
      {...props}
    />
  );
});
Input.displayName = 'Input';
