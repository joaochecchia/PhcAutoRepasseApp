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

## Autenticação: o que o servidor faz hoje

Fatos conferidos no código do backend:

- O login (`POST /autenticacao/login`) responde `AUTENTICADO` ou `SEGUNDO_FATOR_NECESSARIO` (HTTP 202, com `challengeId`). O 2FA conclui em `POST /autenticacao/2fa/verificar`.
- O token de acesso (JWT, 15 min) **não vem no corpo**: vem só no cookie `PHC_AUTH`. O refresh também é cookie.
- O servidor aceita o mesmo JWT em `Authorization: Bearer <token>`.
- Requisição com Bearer **não exige CSRF**. Sem Bearer (login, 2FA, refresh), `POST/PUT/PATCH/DELETE` exigem o cookie `XSRF-TOKEN` e o cabeçalho `X-XSRF-TOKEN` iguais.
- `POST /usuarios/refresh` renova pelo cookie de refresh; 409 significa que outra renovação acabou de acontecer, basta esperar e seguir.
- `confiarNesteDispositivo: true` no 2FA grava um cookie de dispositivo que dispensa o código por 30 dias.

## Autenticação: caminho no app

Este ponto está **em aberto** e deve ser validado com um teste real antes das telas de login:

1. No React Native, o armazenamento de cookies é do sistema e os cookies vão sozinhos nas requisições. Ler `Set-Cookie` pelo JavaScript não é confiável entre iOS e Android.
2. Primeira tentativa: deixar o sistema guardar os cookies e obter o `XSRF-TOKEN` para o cabeçalho. Verifique login, 2FA, renovação após 15 min e reabertura do app, em iOS e Android.
3. Se isso não se sustentar, a solução limpa é uma pequena mudança no backend: devolver os tokens no corpo para o cliente mobile. Isso altera o outro repositório, então **proponha ao usuário e espere a aprovação**.

Em qualquer caminho: token só em `expo-secure-store`, nunca em log, e em 401 renove uma vez e repita a chamada, com uma única renovação compartilhada entre chamadas simultâneas (como o `renewSession` do site).

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
