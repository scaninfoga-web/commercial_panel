import { Loader } from "@/components/custom/custom-loader";
import MSIAgreementPage from "@/components/pages/msi-agreement/MSIAgreementPage";
import { Suspense } from "react";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scaninfoga MSI Agreement',
  description: 'Read and accept the Scaninfoga MSI agreement',
};

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <MSIAgreementPage />
    </Suspense>
  );
}