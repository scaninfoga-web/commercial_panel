import { Loader } from "@/components/custom/custom-loader";
import ActivitiesPage from "@/components/pages/activities/ActivitiesPage";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <ActivitiesPage />
    </Suspense>
  );
}
