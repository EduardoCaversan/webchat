import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
let env: RulesTestEnvironment;
const google = (uid: string) =>
  env
    .authenticatedContext(uid, {
      email: `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    })
    .firestore();
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-entre',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8180 },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'chats/private'), {
      schemaVersion: 2,
      participants: ['alice', 'bob'],
      sequence: 1,
      readSequence: { alice: 0, bob: 0 },
      lastMessage: null,
    });
    await setDoc(doc(db, 'chats/private/messages/one'), {
      senderId: 'alice',
      text: 'Segredo',
      sequence: 1,
    });
    await setDoc(doc(db, 'chats/legacy'), { users: ['alice@example.com', 'bob@example.com'] });
    await setDoc(doc(db, 'users/alice'), { uid: 'alice', email: 'alice@example.com' });
    await setDoc(doc(db, '_limits/alice_lookup'), { count: 1 });
  });
});
afterAll(async () => {
  await env.cleanup();
});
describe('acesso privado no Firestore', () => {
  it('nega acesso anônimo a chats, mensagens e perfis', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'chats/private')));
    await assertFails(getDoc(doc(db, 'chats/private/messages/one')));
    await assertFails(getDoc(doc(db, 'users/alice')));
  });
  it('permite leitura somente aos participantes', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const eve = env.authenticatedContext('eve').firestore();
    await assertSucceeds(getDoc(doc(alice, 'chats/private')));
    await assertSucceeds(getDoc(doc(alice, 'chats/private/messages/one')));
    await assertFails(getDoc(doc(eve, 'chats/private')));
    await assertFails(getDoc(doc(eve, 'chats/private/messages/one')));
  });
  it('permite query limitada com filtro de participante e versão; nega listagem global', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'chats'),
          where('schemaVersion', '==', 2),
          where('participants', 'array-contains', 'alice'),
          limit(30),
        ),
      ),
    );
    await assertFails(getDocs(query(collection(db, 'chats'), limit(30))));
    await assertFails(
      getDocs(
        query(
          collection(db, 'chats'),
          where('schemaVersion', '==', 2),
          where('participants', 'array-contains', 'bob'),
          limit(30),
        ),
      ),
    );
  });
  it('exige limites em consultas de mensagens e impede histórico ilimitado', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDocs(query(collection(db, 'chats/private/messages'), limit(40))));
    await assertFails(getDocs(collection(db, 'chats/private/messages')));
    await assertFails(getDocs(query(collection(db, 'chats/private/messages'), limit(101))));
  });
  it('permite perfil por UID exato mas nega consultas e listagem de usuários', async () => {
    const db = env.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertFails(
      getDocs(query(collection(db, 'users'), where('email', '==', 'alice@example.com'), limit(1))),
    );
    await assertFails(getDocs(collection(db, 'users')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('alice').firestore(), 'users/alice')));
  });
  it('nega criação direta, mesmo com participantes e campos aparentemente válidos', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/new'), { schemaVersion: 2, participants: ['alice', 'bob'] }),
    );
    await assertFails(
      setDoc(doc(db, 'chats/new'), {
        schemaVersion: 2,
        participants: ['alice', 'alice'],
        extra: 'bad',
      }),
    );
  });
  it('impede inclusão de invasor e qualquer alteração dos participantes', async () => {
    await assertFails(
      updateDoc(doc(env.authenticatedContext('eve').firestore(), 'chats/private'), {
        participants: ['alice', 'eve'],
      }),
    );
    await assertFails(
      updateDoc(doc(env.authenticatedContext('alice').firestore(), 'chats/private'), {
        participants: ['alice', 'eve'],
      }),
    );
  });
  it('nega remetente forjado, campos extras, edição e exclusão de mensagens', async () => {
    const db = env.authenticatedContext('bob').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/private/messages/new'), {
        senderId: 'alice',
        text: 'Falso',
        sequence: 2,
      }),
    );
    await assertFails(
      setDoc(doc(db, 'chats/private/messages/new'), {
        senderId: 'bob',
        text: 'Texto',
        sequence: 2,
        admin: true,
      }),
    );
    await assertFails(updateDoc(doc(db, 'chats/private/messages/one'), { text: 'Alterado' }));
    await assertFails(deleteDoc(doc(db, 'chats/private/messages/one')));
    await assertFails(deleteDoc(doc(db, 'chats/private')));
  });
  it('protege perfis, cotas e qualquer coleção não autorizada', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(db, 'users/alice'), { email: 'bob@example.com' }));
    await assertFails(getDoc(doc(db, '_limits/alice_lookup')));
    await assertFails(setDoc(doc(db, '_limits/alice_lookup'), { count: 0 }));
    await assertFails(setDoc(doc(db, 'unknown/doc'), { public: true }));
  });
  it('nega dados legados sem identidade por UID validada', async () => {
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext('alice', { email: 'alice@example.com' }).firestore(),
          'chats/legacy',
        ),
      ),
    );
  });
});

describe('gravações autenticadas sem backend', () => {
  it('nega sequestro de e-mail e listagem do diretório', async () => {
    const db = google('alice');
    await assertFails(setDoc(doc(db, 'directory/bob@example.com'), { uid: 'alice' }));
    await assertFails(getDocs(query(collection(db, 'directory'), limit(1))));
    await assertSucceeds(getDoc(doc(db, 'directory/bob@example.com')));
  });
  it('nega mensagem sem atualização atômica da conversa', async () => {
    await assertFails(
      setDoc(doc(google('alice'), 'chats/private/messages/00000000-0000-4000-8000-000000000001'), {
        senderId: 'alice',
        text: 'Olá',
        sequence: 2,
        createdAt: serverTimestamp(),
      }),
    );
  });
  it('nega remetente forjado, campos extras, vazio e sequência forjada em lote', async () => {
    for (const override of [
      { senderId: 'bob' },
      { text: '  ' },
      { sequence: 10 },
      { admin: true },
    ]) {
      const db = google('alice');
      const messageId = '00000000-0000-4000-8000-000000000001';
      const batch = writeBatch(db);
      const message = { senderId: 'alice', text: 'Olá', sequence: 2, ...override };
      batch.set(doc(db, 'chats/private/messages', messageId), {
        ...message,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'chats/private'), {
        sequence: message.sequence,
        updatedAt: serverTimestamp(),
        lastMessage: { ...message, messageId },
      });
      await assertFails(batch.commit());
    }
  });
  it('permite apenas o próprio recibo e não além da última mensagem', async () => {
    const ref = doc(google('alice'), 'chats/private');
    await assertSucceeds(updateDoc(ref, { readSequence: { alice: 1, bob: 0 } }));
    await assertFails(updateDoc(ref, { readSequence: { alice: 1, bob: 1 } }));
    await assertFails(updateDoc(ref, { readSequence: { alice: 2, bob: 0 } }));
    await assertFails(updateDoc(ref, { participants: ['alice', 'eve'] }));
  });
  it('nega edição e remoção mesmo com login Google válido', async () => {
    const db = google('alice');
    await assertFails(updateDoc(doc(db, 'chats/private/messages/one'), { text: 'Alterado' }));
    await assertFails(deleteDoc(doc(db, 'chats/private/messages/one')));
    await assertFails(updateDoc(doc(db, 'chats/private'), { sequence: 2 }));
    await assertFails(deleteDoc(doc(db, 'chats/private')));
  });
});
