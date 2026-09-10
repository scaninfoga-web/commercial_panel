'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const TabsContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({});
function Tabs({ value, defaultValue, onValueChange, children, className }: { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; children: React.ReactNode; className?: string }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;
  const change = (next: string) => { setInternalValue(next); onValueChange?.(next); };
  return <TabsContext.Provider value={{ value: currentValue, onValueChange: change }}><div className={className}>{children}</div></TabsContext.Provider>;
}
function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn('inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 p-1 shadow-inner shadow-slate-950/50', className)} {...props} />;
}
function TabsTrigger({ value, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const tabs = React.useContext(TabsContext);
  const active = tabs.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => tabs.onValueChange?.(value)}
      className={cn(
        'inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-zinc-400 transition-all duration-200 hover:text-white',
        active && 'border-emerald-500/30 bg-emerald-500 text-black shadow-[0_0_0_1px_rgba(16,185,129,0.35)]',
        className,
      )}
      {...props}
    />
  );
}
function TabsContent({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) { const tabs = React.useContext(TabsContext); if (tabs.value !== value) return null; return <div role="tabpanel" className={className} {...props} />; }

export { Tabs, TabsList, TabsTrigger, TabsContent };
