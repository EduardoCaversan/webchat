import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCheck,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  WifiOff,
} from 'lucide-react';
import { useSession } from './hooks/useSession';
import { useTheme } from './hooks/useTheme';
import { useChats } from './hooks/useChats';
import { missingConfig, useEmulators } from './lib/firebase';
import { peer, time, unread, type Profile } from './lib/types';
import { Avatar, Brand, Dialog, Notice, Spinner } from './components/ui';
import { NewChat } from './components/NewChat';
import { Conversation } from './components/Conversation';
import { Welcome } from './components/Welcome';

function Workspace({
  profile,
  logout,
  error,
  theme,
  toggle,
}: {
  profile: Profile;
  logout: () => void;
  error: string;
  theme: string;
  toggle: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newChat, setNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const {
    chats,
    selected,
    loading,
    loadingMore,
    error: chatsError,
    more,
    loadMore,
    retry,
  } = useChats(profile.uid, selectedId);
  const unreadCount = chats.filter((chat) => unread(chat, profile.uid)).length;
  const filtered = chats.filter(
    (chat) =>
      peer(chat, profile.uid).name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (filter === 'all' || unread(chat, profile.uid)),
  );
  useEffect(() => {
    const back = () => setSelectedId(null);
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  function openChat(id: string) {
    if (!selectedId) window.history.pushState({ chat: true }, '');
    setSelectedId(id);
    setNewChat(false);
  }
  function back() {
    if (window.history.state?.chat) window.history.back();
    else setSelectedId(null);
  }
  useEffect(() => {
    document.title = unreadCount
      ? `(${unreadCount}) Entre — suas conversas`
      : 'Entre — suas conversas';
    return () => {
      document.title = 'Entre — boas conversas começam aqui';
    };
  }, [unreadCount]);
  return (
    <main className={`app-shell ${selectedId ? 'chat-open' : ''}`}>
      <nav className="rail" aria-label="Navegação principal">
        <Brand small />
        <button className="rail-chat" aria-label="Ir para conversas" onClick={back}>
          <MessageCircle size={23} />
          <span className="rail-marker" />
        </button>
        <div className="rail-bottom">
          <button
            className="icon-button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? <Sun size={21} /> : <Moon size={21} />}
          </button>
          <button
            className="profile-button"
            aria-label="Meu perfil"
            onClick={() => setShowProfile(true)}
          >
            <Avatar profile={profile} />
          </button>
        </div>
      </nav>
      <aside className="sidebar" aria-label="Lista de conversas">
        <header className="sidebar-header">
          <div className="sidebar-kicker">UM ESPAÇO SÓ SEU</div>
          <div className="sidebar-title">
            <h1>
              Conversas<span>.</span>
            </h1>
            <button
              className="new-chat-button"
              aria-label="Nova conversa"
              onClick={() => setNewChat(true)}
            >
              <Plus size={23} />
            </button>
          </div>
          <p>Que bom ter você por aqui, {profile.name.split(' ')[0]}.</p>
        </header>
        <div className="sidebar-tools">
          <div className="input-wrap search-input">
            <Search size={18} />
            <input
              type="search"
              aria-label="Buscar conversas"
              placeholder="Buscar uma conversa"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filter-tabs" aria-label="Filtrar conversas">
            <button
              aria-pressed={filter === 'all'}
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>
            <button
              aria-pressed={filter === 'unread'}
              className={filter === 'unread' ? 'active' : ''}
              onClick={() => setFilter('unread')}
            >
              Não lidas{unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
          </div>
        </div>
        {(error || chatsError) && (
          <Notice>
            {error || chatsError}{' '}
            {chatsError && (
              <button className="text-button" onClick={retry}>
                Tentar novamente
              </button>
            )}
          </Notice>
        )}
        <div className="chat-list">
          {loading && <Spinner label="Carregando conversas…" />}
          {!loading && !filtered.length && (
            <div className="sidebar-empty">
              <MessageCircle size={31} strokeWidth={1.4} />
              <h2>
                {search
                  ? 'Nenhuma conversa encontrada'
                  : filter === 'unread'
                    ? 'Tudo em dia'
                    : 'Dê o primeiro oi'}
              </h2>
              <p>
                {search
                  ? 'Tente outro nome nas conversas carregadas.'
                  : filter === 'unread'
                    ? 'Suas conversas não têm mensagens pendentes.'
                    : 'Encontre alguém pelo e-mail e comece uma boa conversa.'}
              </p>
              {!search && filter === 'all' && (
                <button className="text-button" onClick={() => setNewChat(true)}>
                  Encontrar uma pessoa <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}
          {filtered.map((chat) => {
            const person = peer(chat, profile.uid);
            const isUnread = unread(chat, profile.uid);
            return (
              <button
                key={chat.id}
                className={`chat-item ${selectedId === chat.id ? 'selected' : ''} ${isUnread ? 'unread' : ''}`}
                onClick={() => openChat(chat.id)}
                aria-current={selectedId === chat.id ? 'true' : undefined}
              >
                <Avatar profile={person} />
                <span className="chat-summary">
                  <span className="chat-summary-top">
                    <strong>{person.name}</strong>
                    <time>{time(chat.updatedAt)}</time>
                  </span>
                  <span className="chat-preview">
                    {chat.lastMessage?.senderId === profile.uid && <CheckCheck size={15} />}
                    <span>{chat.lastMessage?.text || 'Uma nova conversa começa aqui'}</span>
                    {isUnread && <span className="unread-dot" aria-label="Mensagens não lidas" />}
                  </span>
                </span>
              </button>
            );
          })}
          {more && (
            <button className="list-more subtle-button" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Carregando…' : 'Carregar mais conversas'}
            </button>
          )}
        </div>
        <footer className="sidebar-footer">
          <ShieldCheck size={15} />
          <span>Boas conversas, em um lugar privado.</span>
        </footer>
      </aside>
      <div className="main-panel">
        {selected ? (
          <Conversation key={selected.id} chat={selected} uid={profile.uid} onBack={back} />
        ) : selectedId ? (
          <div className="opening-chat">
            <button className="subtle-button" onClick={back}>
              Voltar às conversas
            </button>
            {chatsError ? <Notice>{chatsError}</Notice> : <Spinner label="Abrindo conversa…" />}
          </div>
        ) : (
          <Welcome onNew={() => setNewChat(true)} />
        )}
      </div>
      {newChat && <NewChat onClose={() => setNewChat(false)} onOpen={openChat} />}
      {showProfile && (
        <Dialog title="Seu perfil" onClose={() => setShowProfile(false)}>
          <div className="profile-card">
            <Avatar profile={profile} large />
            <h3>{profile.name}</h3>
            <p className="muted">{profile.email}</p>
          </div>
          <p className="fine-print">
            Nome e foto vêm da sua conta Google e são atualizados quando você entra. Participantes
            veem o perfil registrado ao abrir a conversa.
          </p>
          <button className="secondary-button" onClick={logout}>
            <LogOut size={18} />
            Sair da conta
          </button>
        </Dialog>
      )}
    </main>
  );
}

export default function App() {
  const session = useSession();
  const { theme, toggle } = useTheme();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="connection-banner" role="status">
          <WifiOff size={16} />
          Você está offline. Reconecte para enviar mensagens.
        </div>
      )}
      {useEmulators && <div className="emulator-banner">Ambiente local · dados de teste</div>}
      {session.profile ? (
        <Workspace
          key={session.profile.uid}
          profile={session.profile}
          logout={session.logout}
          error={session.error}
          theme={theme}
          toggle={toggle}
        />
      ) : (
        <main className="login-page">
          <section className="login-story">
            <Brand />
            <div>
              <span className="eyebrow">CONEXÕES REAIS. CONVERSAS SUAS.</span>
              <h1>
                Tem coisas
                <br />
                que são só
                <br />
                <em>entre a gente.</em>
              </h1>
              <p>
                Um espaço tranquilo para estar perto
                <br />
                de quem faz parte do seu dia.
              </p>
              <div className="login-art" aria-hidden="true">
                <span>
                  Oi, quanto tempo! <span>☀</span>
                </span>
                <span>Que bom te encontrar por aqui.</span>
              </div>
            </div>
            <span className="login-story-footer">MENOS RUÍDO. MAIS CONEXÃO.</span>
          </section>
          <section className="login-panel">
            <button
              className="icon-button login-theme"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
            <div className="login-card">
              <div className="login-mobile-brand">
                <Brand />
              </div>
              <span className="eyebrow">PODE ENTRAR</span>
              <h2>
                Boas conversas
                <br />
                começam aqui<span>.</span>
              </h2>
              <p className="muted">
                Entre com sua conta Google e encontre
                <br className="desktop-break" /> as pessoas que importam para você.
              </p>
              {missingConfig.length ? (
                <div className="setup-card">
                  <h3>Vamos preparar seu espaço?</h3>
                  <p>
                    Configure o Firebase para habilitar o login e as conversas. As instruções estão
                    no README do repositório.
                  </p>
                  <details>
                    <summary>Ver configuração pendente</summary>
                    <ul>
                      {missingConfig.map((key) => (
                        <li key={key}>
                          <code>{key}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              ) : session.loading ? (
                <Spinner
                  label={session.user ? 'Preparando seu perfil…' : 'Conectando com segurança…'}
                />
              ) : session.user ? (
                <>
                  <Notice>{session.error || 'Não foi possível preparar seu perfil.'}</Notice>
                  <button className="primary-button" onClick={session.retry}>
                    Tentar novamente
                  </button>
                  <button className="text-button" onClick={session.logout}>
                    Sair da conta
                  </button>
                </>
              ) : (
                <>
                  <button className="google-button" onClick={session.login}>
                    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c2-1.8 2.9-4.3 2.9-7.5z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22z"
                      />
                      <path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.5H3a10 10 0 0 0 0 9z" />
                      <path
                        fill="#EA4335"
                        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.7A6 6 0 0 1 12 6.1z"
                      />
                    </svg>
                    Continuar com Google
                    <ArrowRight size={18} />
                  </button>
                  {session.error && <Notice>{session.error}</Notice>}
                </>
              )}
              <div className="login-privacy">
                <ShieldCheck size={19} />
                <p>
                  Seu e-mail não fica em uma lista pública.
                  <br />
                  Suas conversas são acessíveis aos participantes.
                </p>
              </div>
            </div>
            <footer className="login-footer">
              Feito para conversar. Sem complicar.<span>ENTRE © {new Date().getFullYear()}</span>
            </footer>
          </section>
        </main>
      )}
    </>
  );
}
