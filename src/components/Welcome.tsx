import { ArrowUpRight, LockKeyhole, MessageCircle, Sparkles } from 'lucide-react';
export function Welcome({ onNew }: { onNew: () => void }) {
  return (
    <section className="welcome">
      <div className="welcome-top">
        <span>MENOS RUÍDO. MAIS CONEXÃO.</span>
        <Sparkles size={17} />
      </div>
      <div className="welcome-content">
        <div className="conversation-art" aria-hidden="true">
          <span className="art-orbit orbit-one" />
          <span className="art-orbit orbit-two" />
          <div className="art-bubble bubble-one">
            <span />
            <span />
            <span />
          </div>
          <div className="art-bubble bubble-two">
            <MessageCircle size={37} strokeWidth={1.5} />
          </div>
          <span className="art-star">✳</span>
          <span className="art-dot" />
        </div>
        <span className="eyebrow">SEU ESPAÇO DE CONVERSA</span>
        <h1>
          Perto, mesmo
          <br />
          de longe<span>.</span>
        </h1>
        <p>
          Um oi, uma ideia, uma boa notícia.
          <br />
          As melhores conversas acontecem entre pessoas.
        </p>
        <button className="primary-button" onClick={onNew}>
          Começar uma conversa
          <ArrowUpRight size={19} />
        </button>
      </div>
      <footer className="welcome-footer">
        <LockKeyhole size={15} />
        <span>Privado. Pessoal. Só entre vocês.</span>
        <span className="footer-edition">ENTRE / 01</span>
      </footer>
    </section>
  );
}
