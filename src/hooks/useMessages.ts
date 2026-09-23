import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { errorMessage } from '../lib/api';
import { mergeMessages, type Message } from '../lib/types';

const PAGE = 40;
export function useMessages(chatId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const oldest = useRef<number | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const current = ++generation.current;
    oldest.current = null;
    busy.current = false;
    setMessages([]);
    setLoading(true);
    setError('');
    setLoadingMore(false);
    let stop = () => {};
    const base = collection(db!, 'chats', chatId, 'messages');
    // Fixed pages prevent moving-window gaps. Subscribe above the initial maximum;
    // rotate the bounded subscription every PAGE messages, retaining loaded pages.
    const listen = (after: number) => {
      stop = onSnapshot(
        query(base, where('sequence', '>', after), orderBy('sequence', 'asc'), limit(PAGE)),
        (snapshot) => {
          if (current !== generation.current) return;
          const incoming = snapshot.docs.map(
            (item) => ({ ...item.data({ serverTimestamps: 'estimate' }), id: item.id }) as Message,
          );
          setMessages((previous) => mergeMessages(previous, incoming));
          if (incoming.length === PAGE) {
            stop();
            listen(incoming[incoming.length - 1].sequence);
          }
        },
        (err) => {
          if (current === generation.current) setError(errorMessage(err));
        },
      );
    };
    void getDocs(query(base, orderBy('sequence', 'desc'), limit(PAGE)))
      .then((snapshot) => {
        if (current !== generation.current) return;
        const initial = snapshot.docs.map(
          (item) => ({ ...item.data({ serverTimestamps: 'estimate' }), id: item.id }) as Message,
        );
        setMessages(mergeMessages(initial));
        oldest.current = initial.at(-1)?.sequence ?? null;
        setHasMore(initial.length === PAGE && oldest.current! > 1);
        setLoading(false);
        listen(initial[0]?.sequence ?? 0);
      })
      .catch((err) => {
        if (current === generation.current) {
          setError(errorMessage(err));
          setLoading(false);
        }
      });
    return () => {
      generation.current = current + 1;
      stop();
    };
  }, [chatId, attempt]);
  const loadMore = useCallback(async () => {
    if (busy.current || oldest.current === null) return;
    busy.current = true;
    setLoadingMore(true);
    setError('');
    const current = generation.current;
    try {
      const snapshot = await getDocs(
        query(
          collection(db!, 'chats', chatId, 'messages'),
          where('sequence', '<', oldest.current),
          orderBy('sequence', 'desc'),
          limit(PAGE),
        ),
      );
      if (current !== generation.current) return;
      const older = snapshot.docs.map(
        (item) => ({ ...item.data({ serverTimestamps: 'estimate' }), id: item.id }) as Message,
      );
      oldest.current = older.at(-1)?.sequence ?? oldest.current;
      setMessages((previous) => mergeMessages(older, previous));
      setHasMore(older.length === PAGE && oldest.current! > 1);
    } catch (err) {
      if (current === generation.current) setError(errorMessage(err));
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoadingMore(false);
      }
    }
  }, [chatId]);
  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    retry: () => setAttempt((value) => value + 1),
  };
}
