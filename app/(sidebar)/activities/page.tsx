import { Loader } from "@/components/custom/custom-loader";
import ActivitiesPage from "@/components/pages/activities/ActivitiesPage";
import { Suspense } from "react";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scaninfoga Activities',
  description: 'View your Scaninfoga activities',
};

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <ActivitiesPage />
    </Suspense>
  );
}
