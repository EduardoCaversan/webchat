import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const env = import.meta.env;
export const useEmulators = env.VITE_USE_EMULATORS === 'true';
export const missingConfig = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  ...(!useEmulators ? ['VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'] : []),
].filter((key) => !env[key]);
// A missing configuration renders an explicit setup screen. No old project is contacted.
const app = missingConfig.length
  ? null
  : initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    });
if (app && !useEmulators)
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functions = app
  ? getFunctions(app, env.VITE_FIREBASE_FUNCTIONS_REGION || 'southamerica-east1')
  : null;
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
if (useEmulators && auth && db && functions) {
  if (env.VITE_FIREBASE_PROJECT_ID !== 'demo-entre')
    throw new Error('Emuladores exigem o projeto demo-entre.');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
