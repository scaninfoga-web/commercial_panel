'use client';

import { useState } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';

interface TabItem {
  value: string;
  label: string;
  component: React.ReactNode;
}

interface CustomTabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  className?: string;
}

const CustomTabs: React.FC<CustomTabsProps> = ({ tabs, defaultValue, className }) => {
  const initialTab = defaultValue ?? tabs[0]?.value ?? '';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={className ?? 'w-full'}>
      <TabsList
        className="grid h-auto w-full rounded-lg border border-slate-800 bg-slate-900 p-1 text-white"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-500"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4">
          {tab.component}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default CustomTabs;
