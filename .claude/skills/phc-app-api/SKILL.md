---
name: phc-app-api
description: Integração do app mobile PHC Auto com o backend Spring Boot (o mesmo do site phcauto.com) - URL base por ambiente, login com 2FA, sessão e renovação, CSRF, chat STOMP, upload de fotos e vídeo, contratos. Use ao criar ou alterar qualquer chamada de API, autenticação, sessão, chat em tempo real, upload, ou ao testar contra o backend local ou de produção.
---

# API — app PHC Auto

O app consome a API do site, em `/api/v1`. A fonte da verdade dos contratos é o código do site:

| O quê | Onde |
|---|---|
| Tipos de request e response | `../PhcAutoRepasse/frontend/src/lib/contracts.ts` |
| Todas as chamadas, por domínio | `../PhcAutoRepasse/frontend/src/lib/backend.ts` |
| Cliente, CSRF e renovação | `../PhcAutoRepasse/frontend/src/lib/api.ts` |
| Chat em tempo real | `../PhcAutoRepasse/frontend/src/lib/chatSocket.ts` |
| Regras de segurança do servidor | `../PhcAutoRepasse/backend/src/main/java/repasse/phcauto/backend/infra/config/SecurityConfig.java` |
| Cliente que já usa Bearer fora do navegador | `../PhcAutoRepasse/automacao/whatsapp/automacao.mjs` |

Ao portar uma chamada, leia a função no `backend.ts` do site e mantenha caminho, parâmetros, timeouts e conversões. Se o contrato do site mudar, atualize `src/api/contracts.ts` aqui.

## Organização em `src/api`

- `client.ts`: cliente HTTP, URL base, cabeçalhos, renovação de sessão.
- `contracts.ts`: tipos.
- Um arquivo por domínio, espelhando o site: `auth`, `ads`, `my-ads`, `lots`, `fipe`, `favorites`, `plans`, `sales`, `chat`, `waitlist`, `notices`, `stores`, `privacy`, `admin`.
- Telas nunca chamam `fetch` direto; usam hooks do TanStack Query sobre essas funções.

## URL base

Vem de `EXPO_PUBLIC_API_URL` (tabela em `AGENTS.md`). Monte `${EXPO_PUBLIC_API_URL}/api/v1`. O WebSocket do chat é a mesma origem com `ws`/`wss` em `/api/v1/chat/ws`. Fotos e mídias chegam como caminhos relativos e precisam da mesma origem na frente.

## Autenticação: modo app (implementado)

O backend tem um **modo app**, aprovado pelo usuário em 10/11/2026: todo pedido do app leva `X-PHC-Cliente: app` (`ClienteApp` no backend). Nesse modo:

- **Sem cookies e sem CSRF.** Os tokens vêm no corpo (`tokens: { accessToken, accessExpiresIn, refreshToken, refreshExpiresIn, dispositivo? }`). O cabeçalho não está no CORS, então outra página não consegue imitá-lo. Cookies enviados junto são ignorados.
- **Login:** `POST /autenticacao/login` com `{ email, senha, manterConectado: true, dispositivo }`. Responde `AUTENTICADO` com tokens ou `SEGUNDO_FATOR_NECESSARIO` (202, `challengeId`).
- **2FA:** `POST /autenticacao/2fa/verificar` com `{ challengeId, codigo, confiarNesteDispositivo }`. Se confiar, `tokens.dispositivo` volta e é guardado: dispensa o código por 30 dias. O User-Agent precisa ser o mesmo do login (o backend confere).
- **Sempre conectado:** a sessão do app é deslizante. Cada `POST /usuarios/refresh` com `{ refreshToken }` troca o refresh e empurra o prazo para 90 dias (`REFRESH_TOKEN_APP_TTL_SECONDS`). Só cai ao sair, trocar a senha ou ficar 90 dias sem abrir o app. O refresh é de uso único: nunca renove duas vezes em paralelo.
- **Sair:** `POST /usuarios/logout` com `{ refreshToken }`.
- **Google:** o app abre `GET /oauth2/authorization/google?app=1&retorno=<url do app>&desafio=<PKCE S256>` no navegador do sistema. O backend volta para `retorno` com `?codigo=` (conta existente, 60 s, uso único), `?social_token=` (conta nova) ou `?erro=`. O código vira sessão em `POST /autenticacao/social/troca` com `{ codigo, verificador }`. O cadastro social do app usa `POST /autenticacao/social/cadastro` com `verificador`. O `retorno` precisa estar em `OAUTH2_APP_REDIRECTS` (padrão `phcauto://auth`; `exp://` só em desenvolvimento).

- **Apple (só iPhone, 17/11/2026):** "Entrar com Apple" nativo (`expo-apple-authentication`, sem navegador). O app gera um nonce, passa à Apple o SHA-256 dele e manda a `POST /autenticacao/social/apple` `{ identityToken, nonce, nome, desafio }`. O backend (`AppleIdentityTokenService`) confere assinatura pelas chaves públicas da Apple, emissor, validade, `aud` em `APPLE_CLIENT_IDS` (padrão `com.phcauto.app`; `host.exp.Exponent` = Expo Go, só no `.env` local) e o nonce. Conta ligada → `AUTENTICADO`; e-mail de conta existente → 409; conta nova → `CADASTRO_NECESSARIO` com `cadastroToken`, preso ao PKCE, concluído em `/autenticacao/social/cadastro` como no Google. Funciona contra o backend local e no Expo Go do iPhone. Não precisa de segredo. Falta (fase 2, com a conta paga da Apple): revogar o token da Apple ao excluir a conta (regra 5.1.1 da App Store), com a chave `.p8`; e cadastrar o domínio de envio do Brevo no "Private Email Relay" da Apple para os e-mails chegarem a `@privaterelay.appleid.com`.

No app: `src/api/client.ts` (cabeçalhos, renovação única), `src/api/session-store.ts` (acesso na memória; refresh, usuário e dispositivo no SecureStore), `src/api/auth.ts`, `src/api/google.ts`, `src/hooks/use-session.tsx` (restaura ao abrir e renova ao voltar do segundo plano).

### Limites conhecidos

- Google no backend local não funciona pelo celular: o Google só aceita o `redirect_uri` cadastrado no console, e o IP da rede local não pode ser cadastrado. Teste o Google contra o backend publicado.
- No Expo Go o endereço de volta é `exp://...`, que precisa estar em `OAUTH2_APP_REDIRECTS`. Em produção, prefira testar com build de desenvolvimento (`phcauto://auth`) a liberar `exp://`.
- Cadastro de conta: `/usuarios/registrar` (multipart público quando há foto) e, para conta nova vinda do Google, `/autenticacao/social/cadastro` com `verificador`. O ticket e o verificador passam do login ao cadastro só na memória (`src/api/auth-handoff.ts`), nunca na rota. O cadastro aceita 5 por hora por IP.
- Redefinição e troca de senha mandam e-mail (código). No backend local com `BREVO_ENABLED=true` o e-mail sai de verdade: não teste esse fluxo com endereços inventados.

## Erros

Porte `apiErrorMessage` do `backend.ts` do site: ele traduz o corpo de erro e os erros por campo em mensagens para a pessoa. Trate também falta de rede e timeout com mensagem própria e ação de tentar de novo.

## Chat

STOMP sobre WebSocket com `@stomp/stompjs`. Assinaturas: `/user/queue/chat`, `/user/queue/confirmacoes`, `/user/queue/erros`. Sem conexão, o envio cai no `POST /chat/conversas/{id}/mensagens`.

Riscos a validar: o servidor restringe a origem do WebSocket (`APP_CORS_ALLOWED_ORIGINS`) e autentica o handshake por cookie. Se o app for recusado, o ajuste é no backend e precisa da aprovação do usuário. No React Native o `@stomp/stompjs` costuma precisar de `forceBinaryWSFrames` e `appendMissingNULLonIncoming`.

## Notificações push

Adicionadas em 17/11/2026, com mudança no backend aprovada pelo usuário. Todo aviso da conta (`AvisosUsuarioService.registrar`: mensagem nova, carro da fila de espera) publica `AvisoRegistrado`; depois do commit, `PushAvisosListener` manda pelo serviço de push da Expo (`ExpoPushClient`) aos aparelhos em `notificacoes.aparelhos_push`.

- `PUT /notificacoes/aparelhos` (com sessão) com `{ token, plataforma: ios|android, tipos: [CHAT, FILA_ESPERA] }`: o app chama a cada abertura com sessão e ao mudar as preferências. Token de outra conta passa para esta; no máximo 10 aparelhos por conta; sem registro há 90 dias, o aparelho é esquecido.
- `POST /notificacoes/aparelhos/remocao` com `{ token }`, **público** (só o aparelho conhece o token): o app chama ao sair; sem rede, tenta de novo na próxima abertura sem sessão.
- O push leva `data: { aviso, link, tipo }` e `channelId` (`mensagens`, `fila-espera`, `avisos`). Ao tocar, o app marca o aviso como lido e abre `noticeRoute(link)`.
- Chat (17/11/2026): o push sai **a cada mensagem**, com o texto dela no corpo (até 180 caracteres). O aviso no menu continua um só por conversa não lida e **sem o texto**; as mensagens seguintes vão por `AvisosUsuario.notificar` (só push, sem `aviso` em `data`).
- Com o app aberto, o sistema não mostra a notificação: `setNotificationHandler` chama `showInAppNotice` (`src/components/in-app-notice.tsx`), um aviso no topo com o visual do app que abre a tela ao tocar e some ao arrastar para cima ou em 3 s (8 s com leitor de tela). Na conversa que já está aberta, não aparece nada.
- Backend: `PUSH_ENABLED` (padrão true) e `EXPO_ACCESS_TOKEN` (só com o "push seguro" do projeto Expo). O backend não guarda credencial da Apple nem do Google: elas ficam no EAS.
- App: `src/api/push.ts` (registro, preferências, canais), `src/hooks/use-push.tsx` (registro com a sessão, toque, número no ícone) e Menu › Notificações. A permissão do sistema só aparece depois de um convite do app: na primeira abertura (diálogo depois da animação da logo, uma vez por aparelho, chave `phc.push.convite`), no cartão do topo de Mensagens (`PushPrompt`, enquanto não houver permissão; recusada no sistema, abre os ajustes), depois de mandar uma mensagem ou entrar na fila, ou pelo botão em Notificações. Sem sessão, `askPushPermission` só pede a permissão; o registro sai ao entrar na conta.
- **Não funciona no Expo Go do Android** (o push remoto saiu do Expo Go no SDK 53) nem no simulador do iOS. Teste com build de desenvolvimento. O token exige o `projectId` do EAS (`eas init` grava em `app.json › extra.eas.projectId`); sem ele, a tela de Notificações explica o motivo.

### Alertas do sistema (17/11/2026)

Tipo de push `SISTEMA`, só para contas ADMIN e DONO (o papel é conferido a cada envio, no `join` com `identidade.usuarios`, não no registro do aparelho). O app manda `SISTEMA` em `tipos` quando a chave "Alertas do sistema" está ligada; o canal do Android `sistema` só é criado para quem é da administração.

- Backend: `infra/observability/MonitorOperacional` roda a cada `ALERTAS_APP_INTERVALO` (60 s). Um problema vira alerta depois de 2 verificações seguidas, é lembrado a cada 2 h e gera "Voltou" quando passa. Sinais: bancos e Redis (`DependencyAvailabilityMetrics`), atraso da projeção (10 min), fornecedores pelas chamadas reais dos últimos 15 min (`ChamadasExternas.janela`: 3 falhas seguidas, ou metade de 5 ou mais), sondas ativas a cada 5 min sem cota (`SondaExterna`: descoberta OpenID do Google, chaves da Apple, `GET /v3/account` da Brevo), cota diária da FIPE a 90% e 20 respostas 5xx em 5 min. Sem chamada na janela, o estado do fornecedor não muda (Parallelum e Cielo não têm sonda, para não gastar cota).
- Entrega: `notificacoes.internal.AlertasPushService` (implementa `DestinoAlertas`) com link `/admin/observabilidade` e canal `sistema`. Guarda na memória os aparelhos da última leitura, para avisar mesmo com o banco principal fora.
- `GET /admin/observabilidade` ganhou `alertas: { ativos, recentes }` (na memória da instância; somem ao reiniciar). `POST /admin/observabilidade/alertas/teste` (ADMIN e DONO) manda um alerta só aos aparelhos de quem pediu e devolve `{ aparelhos }`.
- Desligar: `ALERTAS_APP_ENABLED=false`. O estado é por instância; com mais de uma réplica, cada uma mandaria os seus alertas.

## Upload

Fotos (até 8), vídeo (até 30 s) e laudo vão em `multipart/form-data`, com os timeouts longos do site (60 a 120 s). O site reduz a foto e remove os metadados, inclusive GPS, antes de enviar (`prepareImage.ts`); o app faz o equivalente com `expo-image-manipulator`. As regras de mídia vêm de `GET /anuncios/midias/regras`.

## Testar

Backend local:

```bash
cd ../PhcAutoRepasse/backend && docker compose up -d
curl -s http://127.0.0.1:8080/api/v1/status
curl -s "http://127.0.0.1:8080/api/v1/anuncios/pagina-inicial" | head -c 400
```

- Usuários de teste: peça as credenciais ao usuário ou use as de bootstrap do `.env` do backend. Nunca exiba nem copie segredos do `.env`.
- O código do 2FA chega por e-mail; peça-o ao usuário.
- Para o celular físico, o backend precisa de `BACKEND_BIND=0.0.0.0`. Isso muda o `.env` do outro repositório: avise antes.

Produção (`https://phcauto.com`), fase futura: só leitura por padrão. Não crie anúncio, conta, conversa, compra ou assinatura, nem acione pagamento, sem autorização explícita do usuário para aquela ação. Lembre que há limite de requisições por IP no proxy.
