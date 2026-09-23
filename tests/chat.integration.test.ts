import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { createChatApi } from '../src/lib/chat-api';
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
  const email = `${name.toLowerCase()}-${suffix}@example.com`;
  await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(
      JSON.stringify({ sub: `${name}-${suffix}`, email, email_verified: true, name }),
    ),
  );
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
  const api = createChatApi(db, auth);
  if (register) await api.syncProfile();
  return { api, db, email, uid: auth.currentUser!.uid };
}
let alice: Awaited<ReturnType<typeof account>>, bob: typeof alice, eve: typeof alice;
let id: string;
beforeAll(async () => {
  [alice, bob, eve] = await Promise.all([account('Alice'), account('Bob'), account('Eve')]);
});
afterAll(async () => {
  await Promise.all(apps.map(deleteApp));
});
describe('cliente direto com Auth e Firestore', () => {
  it('sincroniza perfil e diretório autenticado', async () => {
    expect(await alice.api.syncProfile()).toMatchObject({ uid: alice.uid, email: alice.email });
    expect((await getDoc(doc(bob.db, 'directory', alice.email))).data()).toEqual({
      uid: alice.uid,
    });
  });
  it('recusa conversa consigo mesmo e pessoas não cadastradas', async () => {
    await expect(alice.api.startChat(alice.email)).rejects.toThrow('outra pessoa');
    const stranger = await account('Stranger', false);
    await expect(alice.api.startChat(stranger.email)).rejects.toThrow('não encontrada');
  });
  it('criação concorrente nos dois sentidos converge para o mesmo documento', async () => {
    const ids = await Promise.all([
      alice.api.startChat(bob.email.toUpperCase()),
      bob.api.startChat(alice.email),
    ]);
    expect(ids[0]).toBe(ids[1]);
    id = ids[0];
  });
  it('envia nos dois sentidos e repetição não duplica', async () => {
    const mid = randomUUID();
    await Promise.all([
      alice.api.sendMessage(id, mid, 'Olá\nPedro'),
      alice.api.sendMessage(id, mid, 'Olá\nPedro'),
    ]);
    await bob.api.sendMessage(id, randomUUID(), 'Resposta');
    const data = await getDocs(
      query(collection(alice.db, 'chats', id, 'messages'), orderBy('sequence'), limit(40)),
    );
    expect(data.docs.map((d) => d.data().sequence)).toEqual([1, 2]);
    expect(data.docs[0].data().senderId).toBe(alice.uid);
    expect(data.docs[0].data().createdAt.toMillis()).toBeGreaterThan(0);
    await expect(bob.api.sendMessage(id, mid, 'Falso')).rejects.toThrow('já utilizado');
  });
  it('recusa invasores, texto vazio e excesso de tamanho', async () => {
    await expect(eve.api.sendMessage(id, randomUUID(), 'Invasão')).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(alice.api.sendMessage(id, randomUUID(), '   ')).rejects.toThrow('Escreva');
    await expect(alice.api.sendMessage(id, randomUUID(), 'a'.repeat(4001))).rejects.toThrow(
      'Escreva',
    );
  });
  it('leitura só avança até o último envio', async () => {
    await alice.api.markRead(id, 999);
    await alice.api.markRead(id, 1);
    const chat = (await getDoc(doc(alice.db, 'chats', id))).data()!;
    expect(chat.readSequence[alice.uid]).toBe(chat.sequence);
    await expect(eve.api.markRead(id, 1)).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
