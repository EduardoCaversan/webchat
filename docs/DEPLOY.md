# Publicar no GitHub Pages usando o Firebase antigo

A versão atual é estática: não usa Cloud Functions, App Check ou service account. A configuração web original já é o padrão em `src/lib/firebase.ts`. Não é segredo administrativo; a proteção depende das regras.

## 1. Firebase — uma única vez

Abra o [console Firebase](https://console.firebase.google.com/) e selecione **bro-s-chat-5d46d**. Se você não tem acesso ou o projeto não existe mais, crie um projeto Spark, registre um aplicativo Web e copie sua configuração para `.env.local` usando `.env.example`. Ao trocar de projeto no deploy automático, atualize os valores padrão de `src/lib/firebase.ts` ou injete os quatro `VITE_FIREBASE_*` no passo de build do workflow; esses valores web são públicos.

1. Em **Authentication → Sign-in method**, habilite **Google** e escolha o e-mail de suporte.
2. Em **Authentication → Settings → Authorized domains**, adicione `eduardocaversan.github.io` (sem protocolo ou `/webchat`). Para desenvolvimento, adicione `localhost` e `127.0.0.1`. Se usar domínio próprio, autorize-o também.
3. Em **Firestore Database**, mantenha/crie o banco `(default)` na edição Standard. Em **Rules**, substitua o conteúdo por `firestore.rules` e clique **Publish**. Não use regras abertas de modo de teste.
4. Não é necessário criar índice composto para a lista de conversas. Ela consulta apenas os campos de participação e ordena os resultados no navegador. O arquivo `firestore.indexes.json` fica vazio de propósito.
5. Se você já ativou enforcement do **App Check para Firestore/Authentication**, desative-o para esta versão, que não usa App Check.
6. Confirme em **Usage and billing** que o projeto está no **Spark**. Não habilite Blaze para esta aplicação. Se o projeto já é Blaze ou tem funções antigas implantadas, esta mudança de código não muda o plano nem remove serviços remotos: revise-os no console antes de considerar o projeto sem possibilidade de cobrança.

Alternativa aos passos 3 e 4, no terminal:

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project bro-s-chat-5d46d
```

Isso publica regras e índices; não apaga documentos. Regras antigas serão substituídas e o cliente antigo por e-mail perderá acesso aos chats legados. Não execute `deploy --only functions`. As funções antigas não fazem parte da configuração de deploy atual.

A validade da chave antiga, o estado do projeto, os domínios e a configuração remota precisam ser conferidos no console. Sem acesso à sua conta, não é possível concluir esses passos automaticamente.

## 2. GitHub Pages automático

1. Faça commit/push das alterações para `main` ou `master` no repositório `EduardoCaversan/webchat`.
2. Abra **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Em **Actions**, execute **GitHub Pages → Run workflow** (ou faça novo push).
4. Aguarde o deploy e abra **https://eduardocaversan.github.io/webchat/**.

O arquivo `.github/workflows/pages.yml` instala, verifica lint/testes, gera `dist` e publica usando o token automático do GitHub. **Não é necessário criar secrets Firebase, JSON administrativo, PAT ou usar Docker.** Cada push em `main`/`master` publica novamente. A suíte completa de emuladores roda separadamente em `quality.yml`.

Para publicar manualmente em outra hospedagem estática, rode `npm ci` e `npm run build`, e envie o conteúdo de `dist`. Autorize o novo domínio no Google Auth.

## Custos

O fluxo foi adaptado para o **Spark, sem faturamento habilitado**. Google Auth não requer Functions. Firestore Standard oferece cotas gratuitas (atualmente 50 mil leituras e 20 mil gravações por dia, 1 GiB armazenado; veja a tabela oficial). Cada envio usa transação, grava mensagem e prévia e pode gerar recibos/leituras adicionais; não conte uma operação por mensagem. Ao exceder as cotas do Spark, o chat pode parar temporariamente. Não há promessa de uso ilimitado ou disponibilidade sem limites.

GitHub Pages é gratuito em repositórios públicos; repositórios privados dependem do plano GitHub. O workflow usa runners Linux padrão. Não são necessários domínio comprado, Functions, Storage ou planos pagos.

Fontes: [planos Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [cotas Firestore](https://firebase.google.com/docs/firestore/quotas), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages). Conferido em 23/09/2026.

## Problemas comuns

- `auth/unauthorized-domain`: adicione o domínio em Authentication.
- `auth/api-key-not-valid` / projeto inexistente: copie a configuração Web atual do console.
- `permission-denied`: publique as regras atuais, confira Google e e-mail verificado.
- `failed-precondition`: publique novamente as regras e confirme que o banco Firestore `(default)` existe no projeto selecionado.
- Pessoa não encontrada: ela precisa entrar uma vez na versão atual; registros antigos não têm entrada em `directory`.
- Build exibindo “Ambiente local”: remova `.env.local` de emuladores e refaça o build.
