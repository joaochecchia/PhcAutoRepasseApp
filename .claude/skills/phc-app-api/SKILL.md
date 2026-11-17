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
