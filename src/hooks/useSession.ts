import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, provider } from '../lib/firebase';
import { errorMessage, syncProfile } from '../lib/api';
import type { Profile } from '../lib/types';

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!auth);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!auth) return;
    let version = 0;
    const unsubscribe = onAuthStateChanged(
      auth,
      async (next) => {
        const current = ++version;
        setUser(next);
        setProfile(null);
        setError('');
        setLoading(!!next);
        if (!next) return;
        try {
          const result = await syncProfile();
          if (current === version) setProfile(result);
        } catch (err) {
          if (current === version) setError(errorMessage(err));
        } finally {
          if (current === version) setLoading(false);
        }
      },
      (err) => {
        setError(errorMessage(err));
        setLoading(false);
      },
    );
    return () => {
      version++;
      unsubscribe();
    };
  }, [attempt]);
  const login = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth!, provider);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    try {
      await signOut(auth!);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  return {
    user,
    profile,
    loading,
    error,
    login,
    logout,
    retry: () => setAttempt((value) => value + 1),
  };
}
