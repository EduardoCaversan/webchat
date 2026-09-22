import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { mergeMessages, unread, type Chat, type Message } from './types';
const message = (id: string, sequence: number): Message => ({
  id,
  sequence,
  text: id,
  senderId: 'a',
  createdAt: Timestamp.now(),
});
describe('histórico e leitura', () => {
  it('mescla páginas sobrepostas sem duplicar e ordena pela sequência do servidor', () => {
    expect(
      mergeMessages([message('b', 2), message('a', 1)], [message('b', 2), message('c', 3)]).map(
        (item) => item.id,
      ),
    ).toEqual(['a', 'b', 'c']);
  });
  it('considera não lida uma última mensagem recebida após o cursor de leitura', () => {
    const chat = {
      sequence: 8,
      readSequence: { a: 7 },
      lastMessage: { senderId: 'b', sequence: 8 },
    } as unknown as Chat;
    expect(unread(chat, 'a')).toBe(true);
    expect(unread({ ...chat, readSequence: { a: 8 } }, 'a')).toBe(false);
    expect(unread({ ...chat, lastMessage: { text: '', senderId: 'a', sequence: 8 } }, 'a')).toBe(
      false,
    );
  });
});
