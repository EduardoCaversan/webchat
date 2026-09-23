import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { errorMessage } from '../lib/api';
import type { Chat } from '../lib/types';

const PAGE = 30;
const sort = (items: Chat[]) =>
  items.sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis() || a.id.localeCompare(b.id));
export function useChats(uid: string, selectedId: string | null) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selected, setSelected] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const base = useCallback(
    () =>
      query(
        collection(db!, 'chats'),
        where('schemaVersion', '==', 2),
        where('participants', 'array-contains', uid),
      ),
    [uid],
  );
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setChats([]);
    cursor.current = null;
    busy.current = false;
    let first = true;
    const stop = onSnapshot(
      query(base(), limit(PAGE)),
      (snapshot) => {
        const latest = snapshot.docs.map(
          (item) => ({ ...item.data({ serverTimestamps: 'estimate' }), id: item.id }) as Chat,
        );
        setChats((previous) =>
          sort([...new Map([...previous, ...latest].map((chat) => [chat.id, chat])).values()]),
        );
        if (first) {
          cursor.current = snapshot.docs.at(-1) ?? null;
          setMore(snapshot.size === PAGE);
          first = false;
        }
        setLoading(false);
      },
      (err) => {
        setError(errorMessage(err));
        setLoading(false);
      },
    );
    return () => {
      generation.current = current + 1;
      stop();
    };
  }, [base, attempt]);
  useEffect(() => {
    setSelected(null);
    if (!selectedId) return;
    return onSnapshot(
      doc(db!, 'chats', selectedId),
      (snapshot) => {
        setSelected(
          snapshot.exists()
            ? ({ ...snapshot.data({ serverTimestamps: 'estimate' }), id: snapshot.id } as Chat)
            : null,
        );
        if (!snapshot.exists())
          setError('Esta conversa não está disponível. Volte à lista e tente novamente.');
      },
      (err) => setError(errorMessage(err)),
    );
  }, [selectedId, attempt]);
  const loadMore = useCallback(async () => {
    if (!cursor.current || busy.current) return;
    const current = generation.current;
    busy.current = true;
    setLoadingMore(true);
    setError('');
    try {
      const snapshot = await getDocs(query(base(), startAfter(cursor.current), limit(PAGE)));
      if (current !== generation.current) return;
      const older = snapshot.docs.map(
        (item) => ({ ...item.data({ serverTimestamps: 'estimate' }), id: item.id }) as Chat,
      );
      // A live update wins if the page also contains that same conversation.
      setChats((previous) =>
        sort([...new Map([...older, ...previous].map((chat) => [chat.id, chat])).values()]),
      );
      cursor.current = snapshot.docs.at(-1) ?? cursor.current;
      setMore(snapshot.size === PAGE);
    } catch (err) {
      if (current === generation.current) setError(errorMessage(err));
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [base]);
  return {
    chats,
    selected,
    loading,
    loadingMore,
    error,
    more,
    loadMore,
    retry: () => setAttempt((value) => value + 1),
  };
}
