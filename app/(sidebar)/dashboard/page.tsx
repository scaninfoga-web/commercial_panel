import { Loader } from "@/components/custom/custom-loader";
import Dashboard from "@/components/pages/dashboard/Dashboard";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Dashboard />
    </Suspense>
  );
}
