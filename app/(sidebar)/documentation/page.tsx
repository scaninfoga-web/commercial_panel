import { Loader } from "@/components/custom/custom-loader";
import Documentation from "@/components/pages/documentation/Documentation";
import { Suspense } from "react";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scaninfoga Documentation',
  description: 'View your Scaninfoga documentation',
};

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Documentation />
    </Suspense>
  );
}
