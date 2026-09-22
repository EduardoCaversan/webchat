import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail, UserRoundPlus } from 'lucide-react';
import { startChat, errorMessage } from '../lib/api';
import { Dialog, Notice } from './ui';
export function NewChat({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const id = await startChat(email.trim().toLowerCase());
      onOpen(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Uma nova conversa" onClose={onClose}>
      <div className="dialog-illustration">
        <UserRoundPlus size={30} />
      </div>
      <p className="muted">
        Boas conversas começam com um oi. Digite o e-mail Google de alguém que já entrou no Entre.
      </p>
      <form onSubmit={submit} className="new-chat-form">
        <label htmlFor="contact-email">E-mail da pessoa</label>
        <div className="input-wrap">
          <Mail size={19} />
          <input
            id="contact-email"
            type="email"
            autoComplete="off"
            placeholder="pessoa@gmail.com"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
        </div>
        {error && <Notice>{error}</Notice>}
        <button className="primary-button" disabled={busy || !email.trim()}>
          {busy ? 'Procurando…' : 'Iniciar conversa'}
          <ArrowRight size={18} />
        </button>
      </form>
      <p className="fine-print">
        A busca usa o e-mail completo. Não existe um diretório público de pessoas.
      </p>
    </Dialog>
  );
}
