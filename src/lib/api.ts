import { auth, db } from './firebase';
import { createChatApi } from './chat-api';
export const { syncProfile, startChat, sendMessage, markRead } = createChatApi(db, auth);
export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    'auth/popup-blocked':
      'O navegador bloqueou o login. Permita pop-ups para este site e tente novamente.',
    'auth/popup-closed-by-user': 'O login foi cancelado. Você pode tentar novamente.',
    'auth/cancelled-popup-request': 'Já existe uma janela de login aberta.',
    'auth/unauthorized-domain': 'Este domínio ainda não foi autorizado no Firebase Authentication.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet e tente novamente.',
    unauthenticated: 'Sua sessão expirou. Entre novamente.',
    'deadline-exceeded': 'A confirmação demorou. Tente novamente; a mensagem não será duplicada.',
    'resource-exhausted': 'A cota gratuita do Firebase foi atingida. Tente novamente mais tarde.',
    'permission-denied': 'Você não tem acesso a esses dados. Verifique sua sessão.',
    unavailable: 'Conexão indisponível. Tentaremos reconectar automaticamente.',
    'failed-precondition':
      'Não foi possível carregar os dados. Publique as regras atuais do Firestore e tente novamente.',
  };
  if (code === 'chat/invalid') return (error as Error).message;
  if (messages[code]) return messages[code];

  return 'Não foi possível concluir esta ação. Tente novamente.';
}
