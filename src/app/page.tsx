'use client';

import { useAuthStore } from '@/lib/store';
import { Landing } from '@/components/landing/Landing';

export default function HomePage() {
  const { isAuthenticated, hasHydrated } = useAuthStore();

  // Until the auth store rehydrates, render the landing as a logged-out
  // visitor — this keeps the marketing page visible on first paint and
  // avoids a redirect flash for everyone who lands here.
  const authed = hasHydrated && isAuthenticated;

  return <Landing isAuthenticated={authed} />;
}
