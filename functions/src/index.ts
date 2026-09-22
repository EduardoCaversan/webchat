import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const options = {
  region: 'southamerica-east1',
  maxInstances: 10,
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
};

function identity(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre com sua conta Google.');
  if (
    request.auth.token.firebase?.sign_in_provider !== 'google.com' ||
    !request.auth.token.email_verified
  ) {
    throw new HttpsError('permission-denied', 'Use uma conta Google com e-mail verificado.');
  }
  return request.auth.uid;
}

function input(data: unknown, allowed: string[]): Record<string, unknown> {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).some((key) => !allowed.includes(key))
  ) {
    throw new HttpsError('invalid-argument', 'Campos inválidos.');
  }
  return data as Record<string, unknown>;
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpsError('invalid-argument', `Informe um texto entre 1 e ${max} caracteres.`);
  }
  return value.trim();
}

function chatId(value: unknown): string {
  const id = text(value, 67);
  if (!/^v2_[a-f0-9]{64}$/.test(id)) throw new HttpsError('invalid-argument', 'Conversa inválida.');
  return id;
}

function member(chat: DocumentData | undefined, uid: string): asserts chat is DocumentData {
  if (
    !chat ||
    chat.schemaVersion !== 2 ||
    !Array.isArray(chat.participants) ||
    chat.participants.length !== 2 ||
    !chat.participants.includes(uid)
  ) {
    throw new HttpsError('permission-denied', 'Conversa indisponível.');
  }
}

// Atomic, persistent quotas; unsuccessful lookups also consume quota.
async function quota(uid: string, action: string, maximum: number, windowMs: number) {
  const ref = db.doc(`_limits/${uid}_${action}`);
  await db.runTransaction(async (tx) => {
    const old = (await tx.get(ref)).data();
    const now = Date.now();
    const active = old && old.resetAt.toMillis() > now;
    const count = active ? old.count : 0;
    if (count >= maximum)
      throw new HttpsError(
        'resource-exhausted',
        'Muitas tentativas. Aguarde um pouco e tente novamente.',
      );
    tx.set(ref, {
      count: count + 1,
      resetAt: active ? old.resetAt : Timestamp.fromMillis(now + windowMs),
    });
  });
}

export const syncProfile = onCall(options, async (request) => {
  const uid = identity(request);
  input(request.data, []);
  await quota(uid, 'profile', 30, 60 * 60 * 1000);
  // Never trust client-supplied name, email, UID or photo.
  const user = await getAuth().getUser(uid);
  if (user.disabled || !user.emailVerified || !user.email)
    throw new HttpsError('permission-denied', 'Conta indisponível.');
  const profile = {
    uid,
    name: (user.displayName || user.email.split('@')[0]).slice(0, 100),
    email: user.email.toLowerCase(),
    photoURL: user.photoURL || null,
    schemaVersion: 2,
  };
  await db
    .doc(`users/${uid}`)
    .set({ ...profile, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return profile;
});

export const startChat = onCall(options, async (request) => {
  const uid = identity(request);
  const data = input(request.data, ['email']);
  const email = text(data.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  await quota(uid, 'lookup', 10, 60 * 60 * 1000);
  let target;
  try {
    target = await getAuth().getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found')
      throw new HttpsError('internal', 'Não foi possível procurar agora.');
    throw new HttpsError('not-found', 'Não foi possível iniciar uma conversa com esse e-mail.');
  }
  if (target.uid === uid)
    throw new HttpsError('invalid-argument', 'Escolha outra pessoa para conversar.');
  if (target.disabled || !target.emailVerified)
    throw new HttpsError('not-found', 'Não foi possível iniciar uma conversa com esse e-mail.');
  const participants = [uid, target.uid].sort();
  // JSON serialization is unambiguous even for UIDs containing separators.
  const id = `v2_${createHash('sha256').update(JSON.stringify(participants)).digest('hex')}`;
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`chats/${id}`);
    const [own, other, existing] = await tx.getAll(
      db.doc(`users/${uid}`),
      db.doc(`users/${target.uid}`),
      ref,
    );
    if (own.data()?.schemaVersion !== 2)
      throw new HttpsError('failed-precondition', 'Atualize seu perfil entrando novamente.');
    if (other.data()?.schemaVersion !== 2)
      throw new HttpsError('not-found', 'Não foi possível iniciar uma conversa com esse e-mail.');
    const publicProfile = (profile: DocumentData) => ({
      uid: profile.uid,
      name: profile.name,
      photoURL: profile.photoURL,
    });
    const profiles = {
      [uid]: publicProfile(own.data()!),
      [target.uid]: publicProfile(other.data()!),
    };
    if (existing.exists) {
      member(existing.data(), uid);
      // Refresh display snapshots; participant identity never changes.
      tx.update(ref, { profiles });
    } else {
      tx.create(ref, {
        schemaVersion: 2,
        participants,
        profiles,
        sequence: 0,
        lastMessage: null,
        readSequence: { [uid]: 0, [target.uid]: 0 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
  return { chatId: id };
});

export const sendMessage = onCall(options, async (request) => {
  const uid = identity(request);
  const data = input(request.data, ['chatId', 'messageId', 'text']);
  const id = chatId(data.chatId);
  const body = text(data.text, 4000);
  const messageId = text(data.messageId, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(messageId)) {
    throw new HttpsError('invalid-argument', 'Identificador de mensagem inválido.');
  }
  await quota(uid, 'send', 60, 60 * 1000);
  const ref = db.doc(`chats/${id}`);
  const messageRef = ref.collection('messages').doc(messageId);
  await db.runTransaction(async (tx) => {
    const [chatDoc, existing] = await tx.getAll(ref, messageRef);
    const chat = chatDoc.data();
    member(chat, uid);
    if (existing.exists) {
      if (existing.data()!.senderId !== uid || existing.data()!.text !== body) {
        throw new HttpsError('already-exists', 'Identificador já utilizado.');
      }
      return; // A timed-out request can be retried without duplicate writes.
    }
    const sequence = chat.sequence + 1;
    tx.create(messageRef, {
      senderId: uid,
      text: body,
      sequence,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, {
      sequence,
      updatedAt: FieldValue.serverTimestamp(),
      lastMessage: { text: body.slice(0, 140), senderId: uid, sequence },
    });
  });
  return { messageId };
});

export const markRead = onCall(options, async (request) => {
  const uid = identity(request);
  const data = input(request.data, ['chatId', 'sequence']);
  const id = chatId(data.chatId);
  if (!Number.isSafeInteger(data.sequence) || (data.sequence as number) < 0)
    throw new HttpsError('invalid-argument', 'Posição inválida.');
  await quota(uid, 'read', 120, 60 * 1000);
  const ref = db.doc(`chats/${id}`);
  await db.runTransaction(async (tx) => {
    const chat = (await tx.get(ref)).data();
    member(chat, uid);
    const sequence = Math.min(data.sequence as number, chat.sequence);
    if (sequence > chat.readSequence[uid]) {
      tx.update(ref, { readSequence: { ...chat.readSequence, [uid]: sequence } });
    }
  });
  return { ok: true };
});
