import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';
import {
  collection,
  connectFirestoreEmulator,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
const apps: FirebaseApp[] = [];
const suffix = Date.now();
async function account(name: string, register = true) {
  const app = initializeApp(
    { projectId: 'demo-entre', apiKey: 'demo-api-key', authDomain: 'demo-entre.firebaseapp.com' },
    `${name}-${suffix}`,
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const email = `${name}-${suffix}@example.com`;
  // Only the Auth emulator accepts this unsigned Google identity token.
  const token = JSON.stringify({ sub: `${name}-${suffix}`, email, email_verified: true, name });
  await signInWithCredential(auth, GoogleAuthProvider.credential(token));
  const functions = getFunctions(app, 'southamerica-east1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8180);
  if (register) await httpsCallable(functions, 'syncProfile')({});
  return { app, functions, email, uid: auth.currentUser!.uid };
}
let alice: Awaited<ReturnType<typeof account>>, bob: typeof alice, eve: typeof alice;
let id: string;
const call = async (functions: Functions, name: string, data: unknown) =>
  (await httpsCallable(functions, name)(data)).data as Record<string, unknown>;
beforeAll(async () => {
  [alice, bob, eve] = await Promise.all([account('Alice'), account('Bob'), account('Eve')]);
});
afterAll(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});
describe('callables com Auth + Firestore reais em emuladores', () => {
  it('recusa chamadas sem sessão e provedores diferentes de Google', async () => {
    const app = initializeApp(
      { projectId: 'demo-entre', apiKey: 'demo-api-key' },
      `anonymous-${suffix}`,
    );
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const functions = getFunctions(app, 'southamerica-east1');
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    await expect(call(functions, 'syncProfile', {})).rejects.toMatchObject({
      code: 'functions/unauthenticated',
    });
    await createUserWithEmailAndPassword(auth, `password-${suffix}@example.com`, 'local-test-only');
    await expect(call(functions, 'syncProfile', {})).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
  });
  it('cria/atualiza perfil de Google sem aceitar identidade fornecida pelo cliente', async () => {
    const profile = await call(alice.functions, 'syncProfile', {});
    expect(profile.uid).toBe(alice.uid);
    expect(profile.email).toBe(alice.email.toLowerCase());
    await expect(call(alice.functions, 'syncProfile', { uid: bob.uid })).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    });
  });
  it('impede conversa consigo mesmo e com conta ainda não cadastrada', async () => {
    await expect(call(alice.functions, 'startChat', { email: alice.email })).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    });
    const stranger = await account('NotRegistered', false);
    await expect(
      call(alice.functions, 'startChat', { email: stranger.email }),
    ).rejects.toMatchObject({ code: 'functions/not-found' });
    await expect(
      call(alice.functions, 'startChat', { email: 'missing@example.com' }),
    ).rejects.toMatchObject({ code: 'functions/not-found' });
  });
  it('duas criações concorrentes em sentidos opostos retornam a mesma conversa', async () => {
    const [first, second] = await Promise.all([
      call(alice.functions, 'startChat', { email: bob.email.toUpperCase() }),
      call(bob.functions, 'startChat', { email: alice.email }),
    ]);
    expect(first.chatId).toBe(second.chatId);
    id = first.chatId as string;
  });
  it('envio concorrente/repetido não duplica; sequência, prévia e remetente são do servidor', async () => {
    const messageId = randomUUID();
    const data = { chatId: id, messageId, text: 'Primeira mensagem' };
    await Promise.all([
      call(alice.functions, 'sendMessage', data),
      call(alice.functions, 'sendMessage', data),
    ]);
    await call(bob.functions, 'sendMessage', {
      chatId: id,
      messageId: randomUUID(),
      text: 'Resposta',
    });
    const snapshot = await getDocs(
      query(
        collection(getFirestore(alice.app), 'chats', id, 'messages'),
        orderBy('sequence'),
        limit(40),
      ),
    );
    expect(snapshot.size).toBe(2);
    expect(snapshot.docs.map((doc) => doc.data().sequence)).toEqual([1, 2]);
    expect(snapshot.docs[0].data().senderId).toBe(alice.uid);
    expect(snapshot.docs[0].data().createdAt.toMillis()).toBeGreaterThan(0);
  });
  it('rejeita invasor, remetente forjado, mensagem vazia, longa e reutilização de ID', async () => {
    const base = { chatId: id, messageId: randomUUID(), text: 'Mensagem' };
    await expect(call(eve.functions, 'sendMessage', base)).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
    await expect(
      call(alice.functions, 'sendMessage', { ...base, senderId: bob.uid }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(
      call(alice.functions, 'sendMessage', { ...base, text: '  ' }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(
      call(alice.functions, 'sendMessage', { ...base, text: 'a'.repeat(4001) }),
    ).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await call(alice.functions, 'sendMessage', base);
    await expect(call(bob.functions, 'sendMessage', base)).rejects.toMatchObject({
      code: 'functions/already-exists',
    });
  });
  it('protege confirmação de leitura e limita busca por e-mail inclusive sem resultados', async () => {
    await expect(
      call(eve.functions, 'markRead', { chatId: id, sequence: 2 }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await call(alice.functions, 'markRead', { chatId: id, sequence: 999 });
    await call(alice.functions, 'markRead', { chatId: id, sequence: 1 });
    const { getDoc, doc } = await import('firebase/firestore');
    const chat = (await getDoc(doc(getFirestore(alice.app), 'chats', id))).data()!;
    expect(chat.readSequence[alice.uid]).toBe(chat.sequence);
    for (let attempt = 0; attempt < 10; attempt++) {
      await expect(
        call(eve.functions, 'startChat', { email: 'missing@example.com' }),
      ).rejects.toMatchObject({ code: 'functions/not-found' });
    }
    await expect(call(eve.functions, 'startChat', { email: bob.email })).rejects.toMatchObject({
      code: 'functions/resource-exhausted',
    });
  });
});
