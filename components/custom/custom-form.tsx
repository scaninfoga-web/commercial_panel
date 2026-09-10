'use client';

import { FormProvider } from 'react-hook-form';
import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';


interface FormProviderWrapperProps {
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}

export function CustomForm({
  form,
  onSubmit,
  children,
  className = '',
}: FormProviderWrapperProps) {
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={className}
      >
        {children}
      </form>
    </FormProvider>
  );
}
