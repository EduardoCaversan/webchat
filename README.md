# Entre — chat direto, pronto para GitHub Pages

O design do remake foi mantido: desktop/celular, tema claro/escuro, busca, fotos, não lidas, confirmação de leitura e histórico paginado. O funcionamento voltou a ser **navegador → Firebase Auth/Firestore**, com mensagens em tempo real nos dois sentidos. Não precisa de Cloud Functions, servidor próprio, App Check, cartão ou credenciais administrativas.

## Rodar e publicar

Com Node 22.13+:

```sh
npm ci
npm run dev
```

Para gerar o site estático:

```sh
npm run build
```

Publique a pasta **dist**. Os caminhos relativos funcionam em `https://eduardocaversan.github.io/webchat/`. O login usa popup e a navegação não depende de rotas no servidor.

**A configuração pública original do projeto `bro-s-chat-5d46d` já está no código. Não precisa criar `.env` nem cadastrar secrets no GitHub.** Ela foi recuperada do histórico; não foi possível confirmar uma sessão Google real nesse projeto. Se a chave foi revogada ou o projeto removido, substitua os quatro valores usando `.env.example`. Nunca coloque uma chave de service account no frontend.

Antes de usar online, há uma configuração única e inevitável: habilitar Google Auth, autorizar o domínio e publicar as regras/índices atuais. [Passo a passo curto + deploy automático](docs/DEPLOY.md).

## Arquitetura e segurança

React 18 + Vite + TypeScript + Firebase modular. Mantivemos o design e os componentes do remake; as quatro operações da interface agora usam `src/lib/chat-api.ts`, diretamente no Firestore. `functions/` permanece como referência histórica; não é utilizado nem implantado por esta versão. Não instale suas dependências para rodar o chat.

- `users/{uid}`: identidade por UID; escrita apenas pelo próprio usuário Google verificado. E-mail validado contra o token, nome/foto são dados de apresentação.
- `directory/{emailEmMinusculas}`: busca autenticada por e-mail exato; contém somente UID. Não permite listar a coleção. A pessoa precisa entrar nesta versão uma vez para se tornar encontrável.
- `chats/direct_{uidMenor}__{uidMaior}`: uma conversa por par, criação em transação e formato validado nas regras. UIDs Google alfanuméricos.
- `chats/{id}/messages/{uuid}`: mensagens imutáveis, remetente validado contra `request.auth.uid`, texto até 4.000 caracteres. Mensagem, contador e prévia são gravados atomicamente; repetição de uma tentativa não duplica a mensagem.
- Leitura de chats/mensagens somente pelos participantes; mudança de participantes, escrita de terceiros e campos extras são negados. Apenas o próprio recibo de leitura pode avançar.
- Assinaturas limitadas, histórico em páginas de 40, lista em páginas de 30; recebimento automático via `onSnapshot`. Envio exige conexão e confirma antes de limpar o campo.

**Limitação da busca sem backend:** usuários autenticados podem testar e-mails exatos repetidamente e ler perfis por UID conhecido. As regras impedem listagem, mas não oferecem rate limiting confiável ou proteção completa contra descoberta de contas. Este é o compromisso da versão estática solicitada. Mensagens continuam privadas. Não há E2EE: administradores do Firebase podem acessar dados.

## Custo zero

Use **Firebase Spark**, sem habilitar faturamento. Google Auth e Firestore atendem esse fluxo dentro das cotas gratuitas. Ao atingir as cotas, o serviço pode ficar indisponível até a renovação, em vez de cobrar excedentes. Gratuito não significa ilimitado. GitHub Pages de repositório público atende o frontend. Veja [cotas e fontes oficiais](docs/DEPLOY.md#custos).

## Dados antigos

Nenhum dado remoto foi apagado ou modificado nesta entrega. As regras novas bloqueiam chats legados que identificavam participantes por e-mail; eles não aparecem automaticamente, porque confiar nesses campos reabriria acesso inseguro. Ambos devem entrar novamente e iniciar a conversa nesta versão. Chats do remake com `schemaVersion: 2` continuam legíveis e aceitam novos envios, mas iniciar pelo e-mail cria o novo ID determinístico, podendo haver uma conversa antiga adicional. Não execute migração automática sem backup e revisão de propriedade.

## Testes

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:emulators
```

A última etapa usa Java 21+, Auth/Firestore Emulator e executa regras, integração concorrente e navegador com duas contas simuladas. Não acessa o projeto real. Para testes manuais sem credenciais, copie `.env.emulator.example` para `.env.local`, execute `npm run emulators` e, em outro terminal, `npm run dev`. Remova esse arquivo antes do build de produção. Docker opcional: [docs/DOCKER.md](docs/DOCKER.md).

Teste online com duas contas Google: entre com ambas, busque o e-mail exato, envie nos dois sentidos sem recarregar, confirme não lidas/leitura, tente criar a mesma conversa dos dois lados, teste celular/voltar, tema após recarregar e logout. Uma terceira conta não deve acessar mensagens pelo SDK. Sem acesso administrativo ao Firebase e login real, a validação de produção continua dependente dessa configuração externa.
