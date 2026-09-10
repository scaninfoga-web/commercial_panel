import { Loader } from "@/components/custom/custom-loader";
import ManageApiKeysPage from "@/components/pages/manage_api_keys/manage_api_keys";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <ManageApiKeysPage />
    </Suspense>
  );
}