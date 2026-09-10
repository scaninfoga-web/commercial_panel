'use client';

/**
 * Providers — wraps the app in the Redux <Provider>.
 * ─────────────────────────────────────────────────────────────
 * This is the missing piece causing:
 *   "could not find react-redux context value; please ensure
 *    the component is wrapped in a <Provider>"
 *
 * Any component that calls useAppDispatch() / useAppSelector()
 * (like the new Login.tsx) MUST render somewhere inside this
 * <Provider>. Wire it into your ROOT layout — see the
 * instructions below the code.
 *
 * NOTE: adjust the `@/redux/store` import path if your store
 * file lives somewhere else (e.g. `@/redux/store/index`).
 * ─────────────────────────────────────────────────────────────
 */

import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/redux/store';

export default function Providers({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}

/**
 * ─────────────────────────────────────────────────────────────
 * WIRE-UP: app/layout.tsx
 * ─────────────────────────────────────────────────────────────
 *
 * import Providers from './providers'; // adjust path if needed
 *
 * export default function RootLayout({
 *   children,
 * }: {
 *   children: React.ReactNode;
 * }) {
 *   return (
 *     <html lang="en" suppressHydrationWarning>
 *       <body>
 *         <Providers>{children}</Providers>
 *       </body>
 *     </html>
 *   );
 * }
 *
 * IMPORTANT: Providers must wrap the ENTIRE {children} tree at
 * the ROOT layout — not a nested layout (e.g. app/(auth)/layout.tsx),
 * otherwise routes outside that nested layout will still crash.
 *
 * If you already have a <Provider> somewhere and STILL get this
 * error, it's almost always a duplicate react-redux/react copy
 * (monorepo / nested node_modules). Check with:
 *
 *   npm ls react-redux
 *   npm ls react
 *
 * If more than one version/copy shows up, run `npm dedupe`, or
 * delete node_modules + package-lock.json and reinstall.
 * ─────────────────────────────────────────────────────────────
 */