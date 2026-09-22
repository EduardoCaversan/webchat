import type { Timestamp } from 'firebase/firestore';
export interface Profile {
  uid: string;
  name: string;
  photoURL: string | null;
  email?: string;
}
export interface Chat {
  id: string;
  schemaVersion: 2;
  participants: string[];
  profiles: Record<string, Profile>;
  sequence: number;
  readSequence: Record<string, number>;
  updatedAt: Timestamp;
  lastMessage: { text: string; senderId: string; sequence: number } | null;
}
export interface Message {
  id: string;
  text: string;
  senderId: string;
  sequence: number;
  createdAt: Timestamp;
}
export function peer(chat: Chat, uid: string): Profile {
  return chat.profiles[chat.participants.find((id) => id !== uid)!];
}
export function unread(chat: Chat, uid: string): boolean {
  return (
    !!chat.lastMessage &&
    chat.lastMessage.senderId !== uid &&
    chat.sequence > (chat.readSequence[uid] || 0)
  );
}
export function mergeMessages(...pages: Message[][]): Message[] {
  return [...new Map(pages.flat().map((message) => [message.id, message])).values()].sort(
    (a, b) => a.sequence - b.sequence,
  );
}
export function time(timestamp?: Timestamp): string {
  return timestamp
    ? timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
}
export function day(timestamp: Timestamp): string {
  return timestamp
    .toDate()
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}
