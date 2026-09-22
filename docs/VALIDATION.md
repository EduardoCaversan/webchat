# Validação local — 22/09/2026

Ambiente Windows, Node 22.23.2 e Java 21 portáteis em `.tools/` (não versionados). O sistema tinha Node 21 e Java 17; as versões locais permitiram validar as dependências atuais sem modificar a instalação global. Nenhuma credencial do projeto Firebase antigo foi usada.

| Verificação | Resultado |
| --- | --- |
| Instalação limpa (`npm ci`) | Passou com Node 22, usando o lockfile versionado. |
| TypeScript frontend (`tsc -b`) e build (`vite build`) | Passaram. Build em `dist/`, SDK dividido em chunks; sem aviso de chunk acima de 500 kB. |
| TypeScript Functions (`tsc -p functions/tsconfig.json`) | Passou. |
| ESLint (`eslint .`) | Passou, sem erros ou avisos. |
| Vitest unitário (`vitest run`) | 7 testes passaram. |
| Firestore Emulator (`vitest run --config vitest.rules.config.ts`) | 10 testes passaram. |
| Auth + Functions + Firestore (`vitest run --config vitest.integration.config.ts`) | 7 testes passaram. |
| Chromium (`playwright test`) | 1 cenário completo passou, com duas contas e viewports desktop/mobile. |
| `npm audit --omit=dev` | 0 vulnerabilidades. |
| `npm --prefix functions audit --omit=dev` | 0 vulnerabilidades. |
| `npm audit` completo | 7 avisos moderados, todos na árvore das ferramentas de desenvolvimento; 0 altos/críticos. |
| `git diff --check` | Passou. |

Os comandos correspondem aos scripts `build`, `lint`, `test`, `test:rules`, `test:integration` e `test:emulators` do README. Nesta máquina, os executáveis foram chamados usando o Node 22 local e o PATH do Java 21. Foi necessário `FUNCTIONS_DISCOVERY_TIMEOUT=60` para a primeira inicialização do backend. O Firestore foi configurado na porta 8180 porque 8080 já tinha outro serviço.

A suíte completa foi executada sequencialmente em um único ciclo de emuladores pelo script `scripts/verify-emulators.mjs`. O navegador confirmou cadastro, descoberta, criação, envio/recebimento, não lidas, confirmação de leitura após foco, busca, retorno mobile, tema persistido e logout. Capturas verificadas visualmente: `artifacts/desktop-chat.png`, `artifacts/mobile-chat.png`, `artifacts/desktop-dark.png`. Artefatos/relatórios ficam ignorados no Git.

Os avisos restantes envolvem dependências transitivas de `firebase-tools` (OpenTelemetry/pubsub, csv-parse, stream-json e gaxios/uuid). O CLI foi atualizado; a sugestão automática de downgrade para Firebase CLI 10 não foi aplicada. Nas Functions, há um override restrito a `gaxios → uuid ^11.1.1`, que preserva a API v4 utilizada e foi exercitado nos testes de integração.

Não verificado: OAuth Google real, App Check real, IAM/faturamento, publicação do índice em produção, deploy remoto e conteúdo do Firestore legado. Esses pontos exigem o projeto escolhido pelo responsável. O teste de Google no emulador usa uma identidade simulada aceita exclusivamente pelo Auth Emulator. Não há alegação de E2EE nem importação automática do histórico antigo.
