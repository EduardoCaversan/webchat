// Test-only Vite module. Not imported by the production app or included in dist.
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, useEmulators } from '../src/lib/firebase';
export async function login(name: string, email: string) {
  if (!useEmulators || !auth || auth.app.options.projectId !== 'demo-entre')
    throw new Error('Emulator only');
  return signInWithCredential(
    auth,
    GoogleAuthProvider.credential(
      JSON.stringify({ sub: email, email, email_verified: true, name }),
    ),
  );
}
