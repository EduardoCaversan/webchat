import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Profile } from './types';
export async function syncProfile() {
  return (await httpsCallable<Record<string, never>, Profile>(functions!, 'syncProfile')({})).data;
}
export async function startChat(email: string) {
  return (
    await httpsCallable<{ email: string }, { chatId: string }>(functions!, 'startChat')({ email })
  ).data.chatId;
}
export async function sendMessage(chatId: string, messageId: string, text: string) {
  await httpsCallable(functions!, 'sendMessage')({ chatId, messageId, text });
}
export async function markRead(chatId: string, sequence: number) {
  await httpsCallable(functions!, 'markRead')({ chatId, sequence });
}
export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    'auth/popup-blocked':
      'O navegador bloqueou o login. Permita pop-ups para este site e tente novamente.',
    'auth/popup-closed-by-user': 'O login foi cancelado. Você pode tentar novamente.',
    'auth/cancelled-popup-request': 'Já existe uma janela de login aberta.',
    'auth/unauthorized-domain': 'Este domínio ainda não foi autorizado no Firebase Authentication.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet e tente novamente.',
    'functions/unauthenticated': 'Sua sessão ou verificação de acesso expirou. Entre novamente.',
    'functions/unavailable': 'Não foi possível conectar. Tente novamente em instantes.',
    'functions/deadline-exceeded':
      'A confirmação demorou. Tente novamente; a mensagem não será duplicada.',
    'permission-denied': 'Você não tem acesso a esses dados. Verifique sua sessão.',
    unavailable: 'Conexão indisponível. Tentaremos reconectar automaticamente.',
    'failed-precondition': 'A consulta não está disponível. Confira os índices do Firestore.',
  };
  if (messages[code]) return messages[code];
  if (
    [
      'functions/not-found',
      'functions/invalid-argument',
      'functions/resource-exhausted',
      'functions/failed-precondition',
      'functions/permission-denied',
    ].includes(code)
  ) {
    return (error as Error).message;
  }
  return 'Não foi possível concluir esta ação. Tente novamente.';
}
