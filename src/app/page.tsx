'use client';

import { useAuth, useSessionPhase } from '@/lib/auth';
import { Landing } from '@/components/marketing/landing';
import { HomeScreen } from '@/components/home/home';
import { Splash } from '@/components/layout/splash';

/**
 * Signed-out visitors meet the landing page; signed-in patients land on their home screen.
 * While a stored session restores, a branded splash shows instead of the landing. Before
 * hydration both are in the HTML and the pre-paint CSS hint picks one, so neither group
 * sees the other's screen flash.
 */
export default function RootPage() {
  const { me } = useAuth();
  const { restoring, pending } = useSessionPhase();
  if (me) return <HomeScreen />;
  if (restoring) return <Splash full />;
  return (
    <>
      {pending && <div className="when-session"><Splash full /></div>}
      <div className={pending ? 'when-no-session' : 'contents'}><Landing /></div>
    </>
  );
}
