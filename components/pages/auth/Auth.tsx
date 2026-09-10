'use client';

import LocationGate from './LocationGate';
import Login from './Login';

export default function AuthPage(): JSX.Element {
  return (
    <LocationGate>
      <Login />
    </LocationGate>
  );
}
