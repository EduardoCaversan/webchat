import type { Auth } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { Profile } from './types';

function invalid(message: string): never {
  throw Object.assign(new Error(message), { code: 'chat/invalid' });
}

/** Direct Firestore writes, validated atomically by the security rules. */
export function createChatApi(db: Firestore, auth: Auth) {
  // Rules can observe a newer parent before a conflicting transaction gets ABORTED.
  // Re-read on that race; every retry still runs under exactly the same rules.
  const transaction = async (work: Parameters<typeof runTransaction>[1]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        await runTransaction(db, work);
        return;
      } catch (error) {
        if (attempt >= 2 || (error as { code?: string }).code !== 'permission-denied') throw error;
      }
    }
  };
  const identity = () => {
    if (!auth.currentUser) invalid('Entre com sua conta Google.');
    return auth.currentUser!;
  };
  return {
    async syncProfile(): Promise<Profile> {
      const user = identity();
      const profile = {
        uid: user.uid,
        name: (user.displayName || user.email?.split('@')[0] || 'Pessoa').slice(0, 100),
        photoURL: user.photoURL || null,
        email: user.email!.toLowerCase(),
        schemaVersion: 2,
      };
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid), { ...profile, updatedAt: serverTimestamp() });
      batch.set(doc(db, 'directory', profile.email), { uid: user.uid });
      await batch.commit();
      return profile;
    },
    async startChat(input: string): Promise<string> {
      const user = identity();
      const email = input.trim().toLowerCase();
      if (!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email) || email.length > 254)
        invalid('Informe um e-mail válido.');
      if (email === user.email?.toLowerCase()) invalid('Escolha outra pessoa para conversar.');
      const target = (await getDoc(doc(db, 'directory', email))).data();
      if (!target) invalid('Pessoa não encontrada. Ela precisa entrar no chat primeiro.');
      if (target.uid === user.uid) invalid('Escolha outra pessoa para conversar.');
      const participants = [user.uid, target.uid as string].sort();
      const id = `direct_${participants[0]}__${participants[1]}`;
      await transaction(async (tx) => {
        const ref = doc(db, 'chats', id);
        if ((await tx.get(ref)).exists()) return;
        const own = (await tx.get(doc(db, 'users', user.uid))).data();
        const other = (await tx.get(doc(db, 'users', target.uid))).data();
        if (!own || !other) invalid('Entre novamente para atualizar seu cadastro.');
        const publicProfile = (p: Profile) => ({ uid: p.uid, name: p.name, photoURL: p.photoURL });
        tx.set(ref, {
          schemaVersion: 2,
          participants,
          profiles: {
            [user.uid]: publicProfile(own as Profile),
            [target.uid]: publicProfile(other as Profile),
          },
          sequence: 0,
          lastMessage: null,
          readSequence: { [participants[0]]: 0, [participants[1]]: 0 },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      return id;
    },
    async sendMessage(chatId: string, messageId: string, input: string) {
      const uid = identity().uid;
      const text = input.trim();
      if (!text || text.length > 4000) invalid('Escreva uma mensagem de até 4.000 caracteres.');
      const ref = doc(db, 'chats', chatId);
      const message = doc(ref, 'messages', messageId);
      await transaction(async (tx) => {
        const chat = (await tx.get(ref)).data();
        const existing = await tx.get(message);
        if (!chat?.participants.includes(uid)) invalid('Conversa indisponível.');
        if (existing.exists()) {
          if (existing.data().senderId !== uid || existing.data().text !== text)
            invalid('Identificador de mensagem já utilizado.');
          return;
        }
        const sequence = chat.sequence + 1;
        tx.set(message, { senderId: uid, text, sequence, createdAt: serverTimestamp() });
        tx.update(ref, {
          sequence,
          updatedAt: serverTimestamp(),
          lastMessage: { text, senderId: uid, sequence, messageId },
        });
      });
    },
    async markRead(chatId: string, sequence: number) {
      const uid = identity().uid;
      if (!Number.isSafeInteger(sequence) || sequence < 0) return;
      const ref = doc(db, 'chats', chatId);
      await transaction(async (tx) => {
        const chat = (await tx.get(ref)).data();
        if (!chat?.participants.includes(uid)) invalid('Conversa indisponível.');
        const next = Math.min(sequence, chat.sequence);
        if (next > (chat.readSequence[uid] || 0))
          tx.update(ref, { readSequence: { ...chat.readSequence, [uid]: next } });
      });
    },
  };
}
