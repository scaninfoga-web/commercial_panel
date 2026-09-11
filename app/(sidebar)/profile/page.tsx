import Profile from '@/components/pages/profile/Profile';
import { Loader } from '@/components/ui/loader';
import { Suspense } from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scaninfoga Commercial Profile',
  description: 'Manage your Scaninfoga commercial profile',
};

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Profile />
    </Suspense>
  );
}
