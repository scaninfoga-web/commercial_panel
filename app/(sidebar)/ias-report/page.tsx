import { Loader } from "@/components/custom/custom-loader";
import { Suspense } from "react";
import IASReportPage from "@/components/pages/ias-report/IASReportPage";

export default function Page() {
  return (
   <Suspense fallback={<Loader />}>
    <IASReportPage />
    </Suspense>
  );
}