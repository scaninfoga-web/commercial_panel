'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFormContext } from 'react-hook-form';
import React, { useEffect, useRef } from 'react';

interface FormInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  type?: string;
  className?: string;
  disabled?: boolean;
}

function AutoResizeTextarea({
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  disabled,
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      name={name}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      rows={3}
      className={cn(className, 'resize-none w-full p-2')}
      onInput={(event) => {
        const target = event.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
      }}
    />
  );
}

export function CustomInput({
  name,
  label,
  placeholder,
  type = 'text',
  className,
  disabled,
}: FormInputProps) {
  const { control } = useFormContext();

  const sharedStyles = cn(
    'rounded-xl border-emerald-500 bg-[#0A0D14] py-4 text-white placeholder-gray-400',
    className,
  );

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            {type === 'textarea' ? (
              <AutoResizeTextarea
                name={field.name}
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(sharedStyles, 'resize-none w-full p-2')}
              />
            ) : (
              <Input
                {...field}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                className={sharedStyles}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
