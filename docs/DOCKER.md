# Testar localmente com Docker

Instale/inicie o Docker Desktop em modo **Linux containers** (ou Docker Engine com Compose v2 no Linux). Não precisa instalar Node, Java, Firebase CLI, configurar `.env` ou criar um projeto Firebase.

Na pasta do repositório, execute:

```sh
docker compose up --build -d --wait --wait-timeout 240
```

Na primeira execução, o Docker baixa imagens, pacotes e emuladores. Isso pode levar alguns minutos e requer internet. O comando só termina com sucesso quando o chat estiver pronto; confira também `docker compose ps`.

- **Chat:** http://localhost:5173
- **Painel do Firebase local:** http://localhost:4000

O painel permite inspecionar Auth e Firestore **de teste**, sem Firebase Console ou credenciais reais.

## Entrar e conversar

1. Abra o chat e clique em **Continuar com Google**.
2. A janela que abre é o **Auth Emulator**, não o Google real. Selecione uma das contas fictícias já criadas:
   - `marina@entre.test` — Marina Costa
   - `pedro@entre.test` — Pedro Almeida
   - `luiza@entre.test` — Luiza Santos
3. Para testar recebimento em tempo real, abra uma janela anônima/outro perfil do navegador e entre com outra dessas contas.
4. Marina já tem conversas com Pedro e Luiza. Você pode também usar **Nova conversa** e procurar um dos e-mails acima.

Não informe sua senha Google. O login é simulado, mas as sessões, regras, mensagens e listeners são executados de verdade nos emuladores. Isso não comprova o OAuth Google de produção.

## Parar, retomar e atualizar

```sh
# Encerra e exporta os dados de teste para o volume local.
docker compose down

# Retoma e importa o último estado salvo.
docker compose up -d --wait --wait-timeout 240

# Depois de alterar o código, reconstrói a imagem.
docker compose up --build -d --wait --wait-timeout 240

# Logs e estado.
docker compose logs -f entre
docker compose ps
```

O volume `firebase-data` guarda o export de Auth e Firestore. As contas/conversas iniciais são criadas uma vez, sem duplicar no reinício. Use uma parada normal: desligamento forçado, `docker kill` ou queda da máquina podem perder alterações posteriores ao último export. Aguarde `down` terminar; há até 90 segundos de tolerância para exportar.

Para **apagar somente os dados locais desse Compose** e recomeçar do zero:

```sh
docker compose down --volumes
docker compose up -d --wait --wait-timeout 240
```

## O que roda automaticamente

Uma imagem inclui Node 22, Java 21, dependências travadas nos lockfiles, frontend compilado e emuladores. O processo inicial:

1. Gera uma configuração exclusiva do container, sem alterar `firebase.json` do repositório.
2. Inicia Auth, Firestore e Emulator UI no projeto fictício `demo-entre`.
3. Espera o hub informar que Auth e Firestore estão disponíveis.
4. Restaura o volume ou cria três contas e seis mensagens pelo cliente autenticado, usando as mesmas regras do aplicativo.
5. Serve o build em `5173` e libera o healthcheck.

A imagem ignora `.env.local`, chaves de serviço comuns, `.git`, dependências do Windows e ferramentas temporárias. O seed recusa qualquer projeto/endpoint diferente dos emuladores fixos. O painel e APIs dos emuladores não exigem credenciais administrativas, por isso todas as portas publicadas ficam presas a `127.0.0.1`. Não exponha este Compose na internet.

Portas reservadas: `5173`, `4000`, `9099`, `8180`, `4400` e `9150`. Encerre outra instância dos emuladores/Vite antes de iniciar. Se uma porta estiver ocupada, o Compose falha explicitamente; não termina serviços alheios. As portas das APIs fazem parte da configuração do build, portanto não basta alterar só o mapeamento externo para movê-las.

Este Compose serve para testar o produto compilado; não tem hot reload. Não usa nenhum backend Firebase pago e não faz deploy. O custo de computação é o da própria máquina; termos/licenciamento do Docker Desktop dependem do seu contexto de uso.

## Problemas comuns

- `dockerDesktopLinuxEngine` não encontrado: abra/inicie Docker Desktop e aguarde o engine Linux ficar pronto.
- Erro de porta: pare o processo local que já está usando a porta indicada; confira `docker compose ps` e os logs.
- Download interrompido: confira internet/proxy e repita o comando com `--build`; camadas concluídas são reaproveitadas.
- Login bloqueado: permita o pop-up para `localhost`. O login de teste deve abrir em `127.0.0.1:9099`.
- Container `unhealthy`: execute `docker compose logs --tail 100 entre`. Em máquina com poucos recursos, dê mais memória ao Docker Desktop e aumente o `--wait-timeout`; o processo já espera até 180 segundos por serviço na inicialização.

Nenhuma mudança de plano Firebase é necessária para este teste local.

## Verificação automatizada opcional

Para quem também tiver Node 22 e dependências de desenvolvimento instalados no host, `npm run test:docker` testa o container já em execução com Chromium. O teste usa o pop-up real do Auth Emulator, confere as contas iniciais, envia uma mensagem entre duas sessões e abre o painel local. Instale o navegador uma vez com `npx playwright install chromium`. Essa verificação não é necessária para usar o Compose.
