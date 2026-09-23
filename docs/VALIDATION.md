# Validação da versão estática — 23/09/2026

Node 22.23.2 e Java 21 locais; emuladores `demo-entre`. Não houve gravação em Firebase remoto.

| Verificação                                  | Resultado                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run build`                              | Passou; TypeScript e Vite, `dist` com caminhos relativos para GitHub Pages.                                        |
| `npm run lint`                               | Passou. Ferramentas temporárias em `.tools` são ignoradas.                                                         |
| `npm test`                                   | 7 testes passaram.                                                                                                 |
| Regras (`test:emulators`)                    | 15 testes passaram: isolamento, consultas limitadas, campos/remetentes falsos, recibos, imutabilidade e diretório. |
| Integração Auth/Firestore (`test:emulators`) | 6 testes passaram: cadastro, busca, criação concorrente, envio repetido e nos dois sentidos, invasor e recibos.    |
| Chromium (`test:emulators`)                  | Cenário com duas contas passou: descoberta, mensagens em tempo real, leitura, busca, mobile, tema e logout.        |

Os scripts foram executados com o Node 22 local no PATH. Build/Vitest precisaram de execução fora do sandbox devido a bloqueio de criação de subprocessos (`EPERM`). O teste concorrente revelou que a validação das regras pode ocorrer antes da rejeição de uma transação desatualizada; o cliente agora relê e repete até três vezes mantendo todas as regras. A suíte completa passou após essa correção.

O fluxo testado não usa Functions ou App Check. O build de produção usa a configuração pública original `bro-s-chat-5d46d`; isso não confirma que o projeto/chave ainda estão ativos. OAuth Google real, configuração remota de regras/índices/domínios, plano Spark e publicação no GitHub Pages dependem do acesso do proprietário. Nenhum histórico remoto foi apagado ou migrado.
