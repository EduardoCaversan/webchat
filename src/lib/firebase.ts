import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
const env = import.meta.env;
export const useEmulators = env.VITE_USE_EMULATORS === 'true';
// Public web config recovered from the original repository; not administrative secrets.
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDJlrVBBVOMVDzq1xV5Lp_7_oTCg3clQn4',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'bro-s-chat-5d46d.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'bro-s-chat-5d46d',
  appId: env.VITE_FIREBASE_APP_ID || '1:623361636710:web:457a6afb50aa8644f570a7',
};
export const missingConfig: string[] = [];
const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
if (useEmulators) {
  if (config.projectId !== 'demo-entre') throw new Error('Emuladores exigem o projeto demo-entre.');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
}
