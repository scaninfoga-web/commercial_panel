import { Loader } from "@/components/custom/custom-loader";
import Dashboard from "@/components/pages/dashboard/Dashboard";
import { Suspense } from "react";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scaninfoga Dashboard',
  description: 'View your Scaninfoga dashboard',
};

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Dashboard />
    </Suspense>
  );
}
