import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MessageCircle, X } from 'lucide-react';
import type { Profile } from '../lib/types';
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'brand-small' : ''}`}>
      <span className="brand-symbol">
        <MessageCircle size={small ? 23 : 27} strokeWidth={1.8} />
      </span>
      {!small && (
        <span>
          entre<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
export function Avatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`avatar ${large ? 'avatar-large' : ''}`} aria-hidden="true">
      {profile.photoURL && !failed ? (
        <img
          src={profile.photoURL}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        profile.name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word[0])
          .join('')
          .toUpperCase()
      )}
    </span>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="notice">
      {children}
    </p>
  );
}
export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
