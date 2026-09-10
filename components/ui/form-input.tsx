import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { UseFormReturn, FieldPath, FieldValues } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface FormInputProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'form'> {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  icon?: React.ReactNode;
}

export function FormInput<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  type = 'text',
  className,
  icon,
  ...props
}: FormInputProps<TFieldValues>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              {icon && (
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                  {icon}
                </div>
              )}
              <Input
                type={type}
                className={cn(
                  'rounded-xl border-emerald-500 bg-slate-950 py-6 text-white placeholder-gray-400',
                  icon && 'pl-11',
                  className,
                )}
                {...field}
                {...props}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
