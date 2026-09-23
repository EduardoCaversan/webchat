import { initializeApp, deleteApp } from 'firebase/app';
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
  getFirestore,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

// Fail closed: this script must never seed an actual Firebase project.
if (
  process.env.GCLOUD_PROJECT !== 'demo-entre' ||
  process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8180' ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
) {
  throw new Error('Seed permitido somente nos emuladores locais demo-entre.');
}
const marker =
  'http://127.0.0.1:8180/v1/projects/demo-entre/databases/(default)/documents/_local/bootstrap-direct-v1';
const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const apps = [];

async function profile(db, auth) {
  const user = auth.currentUser;
  const value = {
    uid: user.uid,
    name: user.displayName,
    photoURL: null,
    email: user.email,
    schemaVersion: 2,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), { ...value, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'directory', user.email), { uid: user.uid });
  await batch.commit();
  return value;
}

async function startChat(db, auth, email) {
  const target = (await getDoc(doc(db, 'directory', email))).data();
  const uid = auth.currentUser.uid;
  const participants = [uid, target.uid].sort();
  const id = `direct_${participants[0]}__${participants[1]}`;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'chats', id);
    if ((await tx.get(ref)).exists()) return;
    const own = (await tx.get(doc(db, 'users', uid))).data();
    const other = (await tx.get(doc(db, 'users', target.uid))).data();
    const publicProfile = (item) => ({ uid: item.uid, name: item.name, photoURL: item.photoURL });
    tx.set(ref, {
      schemaVersion: 2,
      participants,
      profiles: { [uid]: publicProfile(own), [target.uid]: publicProfile(other) },
      sequence: 0,
      lastMessage: null,
      readSequence: { [uid]: 0, [target.uid]: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return id;
}

async function sendMessage(db, auth, chatId, messageId, text) {
  const uid = auth.currentUser.uid;
  await runTransaction(db, async (tx) => {
    const chatRef = doc(db, 'chats', chatId);
    const messageRef = doc(collection(db, 'chats', chatId, 'messages'), messageId);
    const chat = (await tx.get(chatRef)).data();
    const sequence = chat.sequence + 1;
    tx.set(messageRef, { senderId: uid, text, sequence, createdAt: serverTimestamp() });
    tx.update(chatRef, {
      sequence,
      updatedAt: serverTimestamp(),
      lastMessage: { text, senderId: uid, sequence, messageId },
    });
  });
}

try {
  if ((await fetch(marker, { headers })).ok) {
    console.log('Dados locais restaurados; seed preservado.');
  } else {
    const accounts = {};
    for (const [id, name] of [
      ['marina', 'Marina Costa'],
      ['pedro', 'Pedro Almeida'],
      ['luiza', 'Luiza Santos'],
    ]) {
      const app = initializeApp(
        {
          projectId: 'demo-entre',
          apiKey: 'demo-api-key',
          authDomain: 'demo-entre.firebaseapp.com',
        },
        `seed-${id}`,
      );
      apps.push(app);
      const auth = getAuth(app);
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(
          JSON.stringify({
            sub: `entre-local-${id}`,
            email: `${id}@entre.test`,
            email_verified: true,
            name,
          }),
        ),
      );
      const db = getFirestore(app);
      connectFirestoreEmulator(db, '127.0.0.1', 8180);
      accounts[id] = { db, auth };
      await profile(db, auth);
    }
    const first = await startChat(accounts.marina.db, accounts.marina.auth, 'pedro@entre.test');
    const second = await startChat(accounts.marina.db, accounts.marina.auth, 'luiza@entre.test');
    const messages = [
      [first, 'marina', 'Oi, Pedro! Que bom encontrar você por aqui.'],
      [first, 'pedro', 'Oi, Marina! Agora temos um espaço só para nossas conversas.'],
      [first, 'marina', 'Tudo pronto para testar. Pode mandar uma mensagem!'],
      [second, 'luiza', 'Marina, bem-vinda ao Entre!'],
      [second, 'marina', 'Obrigada, Luiza! Gostei desse cantinho.'],
      [second, 'luiza', 'Experimente também o tema escuro ☾'],
    ];
    for (const [index, [chatId, sender, text]] of messages.entries()) {
      await sendMessage(
        accounts[sender].db,
        accounts[sender].auth,
        chatId,
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        text,
      );
    }
    const saved = await fetch(marker, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: { ready: { booleanValue: true } } }),
    });
    if (!saved.ok) throw new Error('Falha ao salvar marcador local.');
    console.log(
      'Três contas fictícias e duas conversas criadas diretamente pelo cliente autenticado.',
    );
  }
} finally {
  await Promise.all(apps.map(deleteApp));
}
