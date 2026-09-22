# Entre — conversas só entre vocês

Remake de `EduardoCaversan/webchat`: chat individual com Google, texto em tempo real, histórico incremental e controle de acesso por UID. Interface própria em português, responsiva, com temas claro/escuro. Não há E2EE: Firebase/administradores do projeto podem acessar os dados. O acesso do cliente é protegido por autenticação, regras, App Check e TLS.

## O que mudou e por quê

A aplicação anterior usava React 18, CRA, Firebase 9 `compat`, styled-components e hooks de coleção. `users/{uid}` continha e-mail/foto; `chats/{id}` usava `users: [email, email]`; mensagens tinham `message`, `user` (e-mail), `photoURL` e `timestamp`. A criação usava IDs aleatórios e conferia duplicatas somente no navegador. O histórico era uma assinatura ilimitada e não havia regras versionadas, testes ou tratamento consistente de falhas.

Mantivemos React 18, Google Auth, Firestore e as coleções `users`/`chats`, mas reescrevemos os fluxos. Vite + TypeScript substituem CRA; o SDK modular substitui `compat`; CSS com variáveis substitui styled-components. As dependências e o build antigos foram removidos. A configuração Firebase antiga não é reutilizada. A identidade visual **Entre** usa tipografia, verdes e superfícies suaves, sem copiar a marca WhatsApp.

Todas as gravações passam por quatro Cloud Functions callable. Isso centraliza validação, identidade, concorrência e limites de uso. Leituras autorizadas usam diretamente o SDK Firestore, com listeners limitados. Não há backend próprio para manter, mas Functions exige um projeto Firebase com faturamento habilitado.

## Funcionalidades

- Google login/logout, criação/atualização de perfil, feedback de falhas e recuperação de sessão.
- Busca por e-mail completo de uma pessoa que já entrou nesta versão; nenhuma listagem pública de perfis.
- Uma conversa por par de UIDs, inclusive quando os dois participantes iniciam ao mesmo tempo.
- Lista com foto/nome, prévia, horário, filtro por nome e indicador de não lidas.
- Mensagens de até 4.000 caracteres, horário, agrupamento por dia/remetente e confirmação de leitura.
- Envio idempotente: uma tentativa com resposta perdida usa o mesmo UUID quando repetida. O texto só é limpo após confirmação.
- Histórico em páginas de 40, sem assinatura ilimitada, sem duplicação na mesclagem e com ordem atribuída pelo servidor.
- Busca no histórico carregado; carregar páginas anteriores amplia a busca.
- Celular: lista → conversa → voltar, inclusive pelo botão voltar do navegador. Enter envia no desktop, Shift+Enter quebra linha; no teclado de toque, Enter quebra linha.
- Tema persistido, preferência inicial do sistema, diálogos com foco contido/restaurado, labels, teclado, redução de movimento e avisos de conexão.

Não há anexos, chamadas, grupos, push ou controles decorativos sem função.

## Requisitos e instalação

- Node **22.13+** (recomendado: último Node 22 LTS) e npm.
- Java **21+** para o Firestore Emulator. Não é necessário para o frontend ou deploy.
- Chromium do Playwright para os testes de navegador.

```sh
npm ci
npm --prefix functions ci
npx playwright install chromium
```

### Executar tudo localmente, sem credenciais reais

Copie `.env.emulator.example` para `.env.local` (PowerShell: `Copy-Item .env.emulator.example .env.local`). Em um terminal:

```sh
npm run emulators
```

Em outro:

```sh
npm run dev
```

Abra `http://127.0.0.1:5173`. O botão Google abre a interface simulada do Auth Emulator, onde é possível criar/selecionar uma conta de teste. Use dois perfis do navegador ou uma janela anônima para duas contas. Cadastre ambas antes de procurar pelo e-mail. A barra “Ambiente local” identifica esse modo. Nenhuma credencial de produção é necessária.

Portas: Auth `9099`, Firestore `8180`, Functions `5001`, Emulator UI `4000`. O projeto local **deve** ser `demo-entre`; o frontend recusa outro ID com emuladores habilitados. Os dados locais são efêmeros por padrão. Todos os emuladores escutam em `127.0.0.1`; não os exponha à internet. Para testar em um celular físico, prefira o Hosting de um projeto de homologação: o `127.0.0.1` do celular não é o computador.

Em máquinas com inicialização lenta (por exemplo, arquivos no OneDrive/antivírus), se as Functions excederem o prazo de descoberta de 10 segundos, defina `FUNCTIONS_DISCOVERY_TIMEOUT=60` antes de iniciar os emuladores/deploy. No PowerShell: `$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'`.

Sem `.env.local` a aplicação mostra uma tela de configuração útil, sem tentar acessar o projeto antigo e sem apresentar uma simulação como conversa real.

### Usar um projeto Firebase real

1. Crie ou selecione um projeto sob seu controle. Para preservar o legado, um novo projeto é a opção mais simples. Habilite faturamento (plano Blaze) para Functions e configure alertas/orçamento adequados ao uso.
2. Registre um aplicativo Web e copie sua configuração pública para `.env.local`, usando `.env.example` como modelo. São necessários `apiKey`, `authDomain`, `projectId` e `appId`.
3. Em **Authentication → Sign-in method**, habilite **Google**, informe nome público e e-mail de suporte. Em **Settings → Authorized domains**, adicione os domínios do Hosting/domínio próprio e `localhost` se usar desenvolvimento contra produção. Domínios de desenvolvimento não são presumidos automaticamente.
4. Crie o **Cloud Firestore** em modo de produção. Escolha conscientemente a localização. As funções usam `southamerica-east1`; se mudar, altere tanto `functions/src/index.ts` quanto `VITE_FIREBASE_FUNCTIONS_REGION`.
5. Configure **App Check → Web → reCAPTCHA Enterprise**: registre os domínios, associe o app e coloque a chave de site pública em `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. Habilite a API exigida pelo assistente e confira métricas/quotas do provedor. As quatro callables exigem App Check em produção. Ative também a fiscalização do App Check para Firestore no console após confirmar a integração. Não coloque tokens de depuração no Git nem habilite o bypass de emulador em produção.
6. Deixe `VITE_USE_EMULATORS=false`, instale dependências e faça o deploy abaixo. As variáveis `VITE_*` são incorporadas no build; alterar o arquivo exige novo build/deploy.

```sh
npx firebase login
npm run build
npm --prefix functions run build
npx firebase deploy --project SEU_PROJECT_ID --only firestore:rules,firestore:indexes,functions,hosting
```

O deploy usa `firebase.json`, `firestore.rules` e `firestore.indexes.json`. Aguarde o índice composto ficar pronto antes de testar a lista. O comando explícito `--project` evita publicar acidentalmente no Firebase antigo. O frontend é servido pelo Firebase Hosting com fallback para `index.html`; o deploy antigo para GitHub Pages foi removido.

A conta/serviço de execução das Functions precisa acessar Firebase Authentication e Firestore via Admin SDK. Em projetos com IAM restrito, conceda as permissões mínimas equivalentes a leitura de usuários Auth e acesso aos dados Firestore. O ambiente gerenciado fornece credenciais padrão; não crie nem inclua uma chave administrativa no frontend. Configuração pública do Firebase e chave de site do App Check não são segredos administrativos.

## Modelo e garantias de segurança

```text
users/{uid}
  uid, name, email, photoURL, schemaVersion: 2, updatedAt
chats/v2_{sha256(JSON.stringify(sortedUIDs))}
  schemaVersion: 2, participants: [uidA, uidB]
  profiles: { uid: { uid, name, photoURL } }
  sequence, readSequence: { uid: number }
  lastMessage: { text, senderId, sequence } | null
  createdAt, updatedAt
  messages/{UUIDv4}
    senderId, text, sequence, createdAt
_limits/{uid}_{operation}
  count, resetAt
```

`profiles` contém apenas nome/foto/UID, compartilhados dentro da conversa. Não replica e-mails de terceiros. Os snapshots de perfil são atualizados ao iniciar/reabrir o par pela busca; uma mudança posterior no Google não se propaga imediatamente para todas as conversas antigas.

| Operação | Validação e comportamento |
| --- | --- |
| `syncProfile({})` | Exige sessão Google com e-mail verificado; consulta o usuário no Admin Auth, não confia em campos de perfil do cliente. Faz merge no documento do próprio UID. |
| `startChat({email})` | E-mail completo, verificado no Admin Auth, perfil v2 já cadastrado, rejeita o próprio UID. ID determinístico e transação eliminam duplicatas concorrentes. |
| `sendMessage({chatId,messageId,text})` | Valida campos permitidos, UUIDv4, texto não vazio/limite e participação. Deriva `senderId` de `request.auth.uid`. Transação cria mensagem, incrementa sequência e atualiza prévia/data atomicamente. Repetição idêntica é no-op; reutilizar ID com autor/texto diferente falha. |
| `markRead({chatId,sequence})` | Exige participação, só avança o cursor do próprio UID e limita ao último número existente. |

**As regras negam todas as gravações diretas do cliente**, inclusive criações aparentemente válidas. Isso impede falsificação de remetente/campos, troca/inclusão de participantes, alteração da prévia, edição/exclusão de mensagens próprias ou de terceiros e alteração de perfis. A criação permitida ocorre exclusivamente no backend, com whitelist e validação explícita. Admin SDK ignora regras, portanto as funções validam sessão, pertencimento e payload por conta própria; ambos os lados têm testes.

As regras permitem leitura de chats v2 somente a participantes. Queries precisam incluir `schemaVersion == 2`, `participants array-contains UID` e limite de até 100; mensagens também exigem limite de até 100. Perfis só podem ser lidos diretamente pelo próprio dono. Listar `users`, consultar `users` por e-mail, ler `_limits` ou qualquer outra coleção é negado. Nenhum campo fornecido pelo cliente é usado como prova de identidade.

Descoberta privada não pode ser uma consulta pública a `users`: regras não funcionam como filtros e não oferecem limitação de consultas por pessoa. A callable usa Admin Auth para o endereço exato, retorna apenas o ID da conversa, exige cadastro no app e aplica **10 tentativas por hora por UID**, contando resultados negativos. App Check reduz abuso por clientes não autorizados. Isso reduz enumeração; não torna impossível testar alguns endereços conhecidos, nem elimina abuso com múltiplas contas legítimas. Um serviço que precise impedir qualquer confirmação de existência deve adotar convites/aprovação, fora desta versão.

Outros limites: 60 tentativas de envio/minuto, 120 confirmações de leitura/minuto e 30 sincronizações de perfil/hora, por UID, persistidas transacionalmente. Mensagens imutáveis simplificam paginação e auditoria. A leitura só é confirmada quando a janela tem foco, está visível, o usuário está perto do fim do histórico e não há busca ativa. Os dados não usam cache persistente em disco do Firestore; o login Google usa a persistência padrão do Firebase Auth.

O listener de mensagens lê até 40 itens acima da última sequência conhecida. Ao encher, muda o ponto inicial e mantém os itens já recebidos, evitando lacunas de uma janela móvel. Páginas anteriores usam sequência como cursor. Mesclagem por ID evita duplicação. A ordem não depende do relógio do navegador. A memória cresce com o histórico efetivamente carregado até sair da conversa.

## Dados antigos e migração

**Nenhuma rotina de exclusão ou migração automática é executada.** Os documentos antigos permanecem no Firestore. Ao entrar, o usuário atualiza por merge seu `users/{uid}`, preservando campos antigos não substituídos. Chats/mensagens v1 não são convertidos nem exibidos. Publicar estas regras no projeto antigo bloqueia os chats legados para clientes, inclusive o frontend antigo; planeje a troca de versão.

Não é seguro converter `[emailA,emailB]` em `[uidA,uidB]` automaticamente. E-mails podem mudar, o modelo antigo permitia destinatários não cadastrados e remetentes eram informados livremente pelo navegador. O código do repositório não permite comprovar a titularidade histórica nem a autoria dessas mensagens. Nenhum acesso ao Firestore remoto foi pressuposto.

Para migrar um histórico de verdade:

1. Faça export/backup pelo console/Google Cloud antes de qualquer alteração. Teste primeiro em projeto de homologação.
2. Audite a estrutura real com acesso administrativo e construa um mapeamento aprovado de e-mails históricos para UIDs. Separe registros sem identidade comprovável; não conceda acesso com base somente no e-mail atual.
3. Agrupe pares duplicados pelo hash v2, ordene mensagens por timestamp e ID de origem como desempate e preserve metadados de proveniência em armazenamento administrativo. Autoria legada não deve ser apresentada como validada por este novo sistema.
4. Desenvolva um importador específico, com dry-run, contagens, checkpoints, deduplicação, revisão e testes. Copie para documentos v2 novos; não sobrescreva nem apague a origem.

Esse importador depende dos dados reais e **não faz parte desta entrega**. A opção segura imediata é iniciar novas conversas v2 e manter o legado arquivado.

## Testes e qualidade

```sh
npm run lint
npm test
npm run build
npm --prefix functions run build
npm run test:rules
npm run test:integration
npm run test:emulators
```

`test:emulators` inicia Auth/Firestore/Functions uma vez, executa regras, integração e navegador em sequência, e encerra tudo. Não execute as suítes simultaneamente: a suíte de regras limpa apenas o banco `demo-entre`. `test:e2e` roda somente Playwright e pressupõe os emuladores já ligados. Playwright inicia seu próprio Vite com configuração demo explícita; libere a porta 5173 antes de executá-lo.

- Unitários: mesclagem/ordem, não lidas, envio vazio/pendente/repetido, IME e teclado; histórico com mais de uma janela e resposta atrasada de conversa anterior.
- Regras: acesso anônimo/terceiros, consultas com/sem filtros e limites, descoberta de perfis, adulteração de participantes/remetente, edição/exclusão, cotas e legado.
- Integração: perfil com identidade real do Auth Emulator, cadastro, concorrência de criação, idempotência, ordem, pertencimento, validações e cotas.
- Navegador: duas sessões independentes, mensagem indo e voltando, indicador não lido, busca, viewport mobile, retorno à lista, tema persistido e logout. Capturas em `artifacts/`, relatórios em `playwright-report/` (ignorados no Git).

O helper `tests/browser-auth.ts` cria identidades Google **somente no emulador**. Não é importado pelo app e não entra no build. Ele não substitui uma verificação real do OAuth Google e do App Check em produção.

### Roteiro manual com duas contas Google reais

1. Com regras, índice, Functions, domínios e App Check publicados, abra o Hosting em duas sessões isoladas. Entre com contas A e B; confirme nome/foto/e-mail em “Meu perfil”. Recarregue para conferir persistência.
2. Em A, procure um e-mail não cadastrado e o próprio e-mail: ambos devem falhar com feedback. Procure B e, ao mesmo tempo, em B procure A. Deve aparecer uma única conversa para cada conta.
3. Envie textos nos dois sentidos, incluindo emojis e quebras de linha. Confirme horário/ordem/prévia. Espaços vazios não devem enviar.
4. Em B, volte para a lista ou coloque a janela em segundo plano. Envie de A e veja a indicação não lida. Abra/focalize a conversa em B e vá ao fim: o indicador deve desaparecer e A deve ver a confirmação de leitura.
5. Troque mais de 40 mensagens (respeitando a cota por minuto), reabra a conversa e carregue mensagens anteriores. Confira continuidade, ausência de duplicatas e preservação da posição do scroll. Busque uma palavra, depois amplie o histórico.
6. Interrompa a rede durante um envio. O texto deve permanecer e haver opção de repetir. Reative a rede e repita: deve existir só uma mensagem com aquele envio. Nenhuma mensagem é apresentada como confirmada antes do servidor.
7. Teste largura de 390 px, botão voltar/navegador, teclado, foco do diálogo, Escape, tema claro/escuro e recarga. Faça logout e confirme que o conteúdo das conversas saiu da tela.
8. Uma conta C não participante não deve ler nem alterar documentos de A/B; os testes automatizados reproduzem esses acessos diretos. Confirme também no ambiente real que clientes sem App Check válido são recusados.

## Limitações e operação

- A lista assina as 30 conversas mais recentes e pagina as anteriores em lotes de 30. A busca e a contagem de não lidas cobrem as conversas carregadas; carregar mais amplia esse conjunto. Um novo envio traz a conversa para o topo em tempo real. Histórico/lista crescem em memória conforme o carregamento; não há virtualização para milhares de itens simultâneos.
- Nomes/fotos em conversas existentes são snapshots, atualizados ao reencontrar a pessoa pela busca. Não há presença online nem “digitando”; o texto “Conversa individual” não representa presença.
- Envio requer conexão. Uma falha mantém texto e UUID enquanto o compositor está montado. Recarregar, sair ou trocar de conversa perde esse rascunho; não há fila offline durável.
- Não há edição/exclusão, bloqueio/denúncia, recuperação/exportação na interface ou política de retenção automática. Configure monitoramento, quotas e manutenção conforme a implantação.
- App Check, OAuth Google real, IAM, billing e construção do índice precisam ser confirmados no projeto escolhido. Emuladores não comprovam essa configuração externa nem a entrega em produção.
- Auditorias npm podem reportar avisos de bibliotecas transitivas de ferramentas/SDKs. Consulte `npm audit` e `npm --prefix functions audit`; não aplique downgrade automático sugerido por `--force` sem revisar compatibilidade.

Arquivos principais: `src/components` (interface), `src/hooks` (sessão/listeners), `src/lib` (tipos/Firebase/callables), `functions/src/index.ts` (backend), `tests` (regras/integração/navegador).

Resultados da execução local e pendências externas: [registro de validação](docs/VALIDATION.md). As fontes são servidas pelo próprio build, sem chamadas ao Google Fonts.

Referências usadas nas decisões: [regras não são filtros](https://firebase.google.com/docs/firestore/security/rules-query), [validação e Admin SDK](https://firebase.google.com/docs/firestore/security/rules-conditions), [transações](https://firebase.google.com/docs/firestore/manage-data/transactions), [callable Functions](https://firebase.google.com/docs/functions/callable), [App Check para Functions](https://firebase.google.com/docs/app-check/cloud-functions).
