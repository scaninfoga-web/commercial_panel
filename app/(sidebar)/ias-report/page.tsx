import { Loader } from "@/components/custom/custom-loader";
import { Suspense } from "react";
import IASReportPage from "@/components/pages/ias-report/IASReportPage";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scaninfoga IAS Report',
  description: 'View your Scaninfoga IAS reports',
};

export default function Page() {
  return (
   <Suspense fallback={<Loader />}>
    <IASReportPage />
    </Suspense>
  );
}