import { Loader } from "@/components/custom/custom-loader";
import ManageApiKeysPage from "@/components/pages/manage_api_keys/manage_api_keys";
import { Suspense } from "react";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scaninfoga Manage API Keys',
  description: 'Manage your Scaninfoga API keys',
};

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <ManageApiKeysPage />
    </Suspense>
  );
}