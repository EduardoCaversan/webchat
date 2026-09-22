import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, Check, CheckCheck, Search, ShieldCheck, X } from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { day, peer, time, type Chat } from '../lib/types';
import { errorMessage, markRead } from '../lib/api';
import { Avatar, Notice, Spinner } from './ui';
import { Composer } from './Composer';

export function Conversation({
  chat,
  uid,
  onBack,
}: {
  chat: Chat;
  uid: string;
  onBack: () => void;
}) {
  const person = peer(chat, uid);
  const history = useMessages(chat.id);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [nearBottom, setNearBottom] = useState(true);
  const [readError, setReadError] = useState('');
  const [readAttempt, setReadAttempt] = useState(0);
  const [visible, setVisible] = useState(
    document.visibilityState === 'visible' && document.hasFocus(),
  );
  const scroll = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | null>(null);
  const stick = useRef(true);
  const maxSequence = history.messages.at(-1)?.sequence ?? 0;
  const lastRead = chat.readSequence[uid] || 0;
  const bottom = useCallback(() => {
    stick.current = true;
    setNearBottom(true);
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' });
  }, []);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible' && document.hasFocus());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, []);
  useEffect(() => {
    if (!visible || !nearBottom || search || maxSequence <= lastRead) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void markRead(chat.id, maxSequence)
        .then(() => {
          if (active) setReadError('');
        })
        .catch((err) => {
          if (active) setReadError(errorMessage(err));
        });
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [chat.id, lastRead, maxSequence, visible, nearBottom, search, readAttempt]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (previousHeight.current !== null) {
      element.scrollTop += element.scrollHeight - previousHeight.current;
      previousHeight.current = null;
    } else if (stick.current) element.scrollTop = element.scrollHeight;
  }, [history.messages]);
  const shown = history.messages.filter((message) =>
    message.text.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const otherRead = chat.readSequence[person.uid] || 0;
  return (
    <section className="conversation" aria-label={`Conversa com ${person.name}`}>
      <header className="conversation-header">
        <button
          className="icon-button back-button"
          onClick={onBack}
          aria-label="Voltar às conversas"
        >
          <ArrowLeft size={22} />
        </button>
        <Avatar profile={person} />
        <div className="conversation-person">
          <h2>{person.name}</h2>
          <span>
            <span className="status-dot" />
            Conversa individual
          </span>
        </div>
        <button
          className={`icon-button ${searchOpen ? 'is-active' : ''}`}
          aria-label="Buscar nesta conversa"
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen((value) => !value);
            setSearch('');
          }}
        >
          <Search size={21} />
        </button>
      </header>
      {searchOpen && (
        <div className="message-search">
          <Search size={18} />
          <input
            aria-label="Buscar no histórico carregado"
            placeholder="Buscar no histórico carregado"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Fechar busca"
            onClick={() => {
              setSearch('');
              setSearchOpen(false);
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div
        className="conversation-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="Histórico de mensagens"
        onScroll={() => {
          const element = scroll.current!;
          stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
          setNearBottom(stick.current);
        }}
      >
        <div className="privacy-note">
          <ShieldCheck size={14} /> Só os participantes têm acesso a esta conversa.
        </div>
        {history.loading && <Spinner label="Buscando suas mensagens…" />}
        {history.error && (
          <Notice>
            {history.error}{' '}
            <button className="text-button" onClick={history.retry}>
              Reconectar
            </button>
          </Notice>
        )}
        {history.hasMore && (
          <div className="history-more">
            <button
              className="subtle-button"
              disabled={history.loadingMore}
              onClick={async () => {
                stick.current = false;
                previousHeight.current = scroll.current!.scrollHeight;
                await history.loadMore();
              }}
            >
              {history.loadingMore ? 'Carregando…' : 'Carregar mensagens anteriores'}
            </button>
          </div>
        )}
        {!history.loading && !history.error && !history.messages.length && (
          <div className="chat-beginning">
            <span className="hello">
              Olá<span>!</span>
            </span>
            <h3>A conversa começa aqui.</h3>
            <p>Envie a primeira mensagem para {person.name.split(' ')[0]}.</p>
          </div>
        )}
        {search && (
          <p className="search-result" role="status">
            {shown.length} resultado(s) nas mensagens carregadas
            {history.hasMore ? '. Carregue mais mensagens para ampliar a busca.' : '.'}
          </p>
        )}
        <div
          className="messages"
          role="log"
          aria-label="Mensagens"
          aria-live="polite"
          aria-relevant="additions"
        >
          {shown.map((message, index) => {
            const own = message.senderId === uid;
            const previous = shown[index - 1];
            const dateBreak = !previous || day(previous.createdAt) !== day(message.createdAt);
            const grouped =
              previous?.senderId === message.senderId &&
              !dateBreak &&
              message.createdAt.toMillis() - previous.createdAt.toMillis() < 5 * 60 * 1000;
            return (
              <div key={message.id}>
                {dateBreak && (
                  <div className="date-divider">
                    <span>{day(message.createdAt)}</span>
                  </div>
                )}
                <div
                  className={`message-row ${own ? 'outgoing' : 'incoming'} ${grouped ? 'grouped' : ''}`}
                >
                  <div className="message-bubble">
                    <p>{message.text}</p>
                    <div className="message-meta">
                      <time dateTime={message.createdAt.toDate().toISOString()}>
                        {time(message.createdAt)}
                      </time>
                      {own && (
                        <span aria-label={otherRead >= message.sequence ? 'Lida' : 'Enviada'}>
                          {otherRead >= message.sequence ? (
                            <CheckCheck size={15} />
                          ) : (
                            <Check size={15} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!nearBottom && (
        <button className="jump-bottom" onClick={bottom}>
          <ArrowDown size={16} />
          Ir para as mais recentes
        </button>
      )}
      {readError && (
        <div className="read-error" role="status">
          Não foi possível confirmar a leitura.{' '}
          <button className="text-button" onClick={() => setReadAttempt((value) => value + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
      <Composer key={chat.id} chatId={chat.id} onSent={bottom} />
    </section>
  );
}
