import { Loader } from "@/components/custom/custom-loader";
import Documentation from "@/components/pages/documentation/Documentation";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Documentation />
    </Suspense>
  );
}
