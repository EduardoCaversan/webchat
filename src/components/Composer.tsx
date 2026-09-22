import { useRef, useState, type FormEvent } from 'react';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { errorMessage, sendMessage } from '../lib/api';
import { Notice } from './ui';
export function Composer({ chatId, onSent }: { chatId: string; onSent: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ id: string; text: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (lock.current || (!pending.current && !text.trim())) return;
    lock.current = true;
    setSending(true);
    setError('');
    pending.current ??= { id: crypto.randomUUID(), text: text.trim() };
    try {
      await sendMessage(chatId, pending.current.id, pending.current.text);
      pending.current = null;
      setText('');
      onSent();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      lock.current = false;
      setSending(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  }
  return (
    <div className="composer-area">
      {error && <Notice>{error} O texto foi preservado. Use o botão para tentar novamente.</Notice>}
      <form className={`composer ${error ? 'composer-error' : ''}`} onSubmit={submit}>
        <textarea
          ref={input}
          aria-label="Mensagem"
          placeholder="Escreva uma mensagem…"
          rows={1}
          maxLength={4000}
          value={text}
          readOnly={sending || !!error}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              !window.matchMedia('(pointer: coarse)').matches
            ) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          className="send-button"
          type="submit"
          disabled={sending || !text.trim()}
          aria-label={error ? 'Tentar enviar novamente' : 'Enviar mensagem'}
        >
          {sending ? (
            <span className="spinner" />
          ) : error ? (
            <RotateCcw size={21} />
          ) : (
            <ArrowUp size={24} />
          )}
        </button>
      </form>
      <div className="composer-hint">
        <span>
          {sending
            ? 'Enviando…'
            : error
              ? 'Nova tentativa segura, sem duplicar o envio.'
              : 'Uma boa conversa está nos detalhes.'}
        </span>
        <span>
          {text.length > 3500 ? `${text.length}/4000` : 'Enter envia · Shift + Enter quebra linha'}
        </span>
      </div>
    </div>
  );
}
