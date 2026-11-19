---
name: phc-app-paridade
description: Mapa de paridade entre o site phcauto.com e o app mobile PHC Auto - lista de todas as telas e funcionalidades do site, onde cada uma fica no app, o arquivo de origem e as chamadas de API. Use ao planejar o que construir, escolher a próxima tela, estimar o trabalho ou conferir se o app cobre tudo o que o site faz, inclusive o painel admin e a observabilidade.
---

# Paridade site → app

O app deve fazer tudo o que o site faz. Origem das telas: `../PhcAutoRepasse/frontend/src/pages/` e `App.tsx`. As chamadas estão em `../PhcAutoRepasse/frontend/src/lib/backend.ts`, no objeto indicado.

Ao concluir uma tela, marque-a aqui (`[x]` pronta, `[~]` existe mas está incompleta ou não foi testada de ponta a ponta). Se o site ganhar uma tela nova, acrescente a linha. Estado revisado em 16/11/2026; o que falta em cada `[~]` está em "Pendências das telas parciais".

## Público

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| [~] | Início: vitrine, abas, vendidos recentes, números | `App.tsx`, `HeroNumbers` | `homeAds`, `platformNumbers`, `searchAds` | aba Início |
| [~] | Busca com filtros, ordenação, paginação, localização por raio | `App.tsx`, `Filters`, `data/filters.ts` | `searchAds` | aba Buscar |
| [~] | Detalhe do anúncio: galeria, vídeo, laudo, FIPE, contato | `VehiclePage`, `FipeDeal`, `VideoPlayer` | `getPublicAd`, `revealAdFipe`, `getAdContactChannels`, `requestWhatsappContact`, `adStatsApi.view` | pilha |
| [~] | Lote de veículos | `LotPage` | `lotsApi` | pilha |
| [~] | Lojistas e página da loja | `StoresPage` | `searchStores`, `storeProfile`, `publicProfile` | Menu |
| [~] | Pátio PHC | `PatioPage` | `searchAds` | Menu |
| [~] | Tabela FIPE | `FipeTablePage`, `FipeVehicleSelector` | `getFipePage`, `resolveFipeReference`, `getFipeQuota` | Menu |
| [~] | Planos e preços | `PlansPage` | `plansApi.list` | Menu |
| [~] | Privacidade e termos | `PrivacyPage` | `privacyApi.info` | Menu |

## Conta

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| [x] | Login com 2FA por e-mail e dispositivo confiável (sempre conectado) | `LoginPage` | `authApi` | modal |
| [x] | Login com Google (testado em 17/11/2026 no build de desenvolvimento do Android contra produção) | `SocialAuthButtons` | `/oauth2/authorization/google`, `authApi` social | modal |
| [~] | Cadastro PF/PJ com aceite dos termos e ViaCEP (também o cadastro vindo do Google) | `RegisterPage`, `FormFields`, `lib/viacep.ts` | `authApi.register` | modal (`/cadastro`) |
| [~] | Redefinir senha | `ResetPasswordPage` | `authApi` (redefinições) | modal |
| [~] | Perfil, foto, troca de senha | `ProfilePage`, `ProfilePhoto` | `authApi.profile`, `uploadProfilePhoto` | Menu |
| [~] | Exportar e excluir dados (LGPD) | `AccountPrivacy` | `privacyApi` | Menu |
| [~] | Favoritos, com mescla dos favoritos de visitante ao entrar | `App.tsx` | `favoritesApi` | aba Favoritos |
| [~] | Avisos da conta | `App.tsx` | `noticesApi` | Início e Menu |
| [~] | Mensagens (chat em tempo real) | `MessagesPage`, `lib/chatSocket.ts` | `chatApi`, STOMP | Início e Menu |
| [~] | Fila de espera | `WaitlistPage` | `waitlistApi` | Menu |

## Anunciante

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| [~] | Conferir dados do anunciante | `ProfilePage` | `authApi.profile` | aba Anunciar |
| [~] | Criar anúncio: FIPE, campos por tipo, fotos, vídeo, laudo | `AnnouncePage`, `AdMedia`, `AdVehicleFields`, `data/announcementFields.ts` | `getAdFormCatalog`, `createAdWithPhotos`, `adMediaApi` | aba Anunciar |
| [~] | Cota de anúncios e aviso de limite | `AdQuotaDialog`, `AdSlots` | `myAdsApi.quota` | aba Anunciar |
| [~] | Meus anúncios: filtros, publicar, pausar, renovar, retirar, excluir | `MyAdsPage`, `AdRetireDialog`, `AdListFilters` | `myAdsApi` | Menu |
| [~] | Editar anúncio | `EditAdPage` | `myAdsApi.forEdit`, `adPatchFromDrafts` | pilha |
| [~] | Estatísticas do anúncio | `AdStatsDialog` | `adStatsApi` | folha |
| [~] | Criar e editar lote | `LotEditPage`, `LotUnits` | `lotsApi` | pilha |

## Pagamentos

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| — | Assinar plano: **fora do app por decisão** (18/11/2026); contratação só no site | `PlanCheckout` | `plansApi` | não existe no app |
| [~] | Meu plano: plano em vigor, validade, limites e uso, benefícios, avisos; desligar renovação e reembolso | `PlansPage` | `plansApi.mine`, `myAdsApi.quota` | Menu › Meu plano (`/planos`) |
| [~] | Comprar veículo pelo app | `VehicleCheckout` | `salesApi` | modal `/comprar/[id]` |
| [~] | Minhas compras | `PurchasesPage` | `salesApi` | Menu (`/minhas-compras`) |

Cartão (18/11/2026, pedido do usuário): o app troca os dados do cartão pelo token direto na Cielo (Silent Order Post por `fetch`, `src/api/cielo.ts`) e roda a confirmação do banco (script MPI do 3DS) numa WebView com a URL da loja como origem (`src/hooks/use-card-payment.tsx`). O número do cartão nunca passa pelo backend da PHC. Desde 18/11/2026 o cartão no app serve só à compra de veículo (bem físico, permitido nas duas lojas). Planos: ver AGENTS.md › Assinaturas e lojas.

## Administração

Visível só para os papéis de admin e dono, conforme `papel` da sessão. As abas "Usuários" e "Limite de anúncios" são só do dono.

| Feito | Funcionalidade | Origem no site | API |
|---|---|---|---|
| [~] | Observabilidade (com os alertas do monitor) | `AdminObservability` | `adminApi.observability` (`GET /admin/observabilidade`) |
| [~] | Usuários, papéis e assinaturas cortesia | `AdminUsers` | `adminApi` |
| [~] | Limite de anúncios | `AdminAdLimit` | `adLimitReleaseApi` |
| [~] | Anúncios impulsionados (lista e painel no detalhe do anúncio) | `AdminBoosts`, `AdBoostPanel` | `boostsApi` |
| [~] | Banners da página inicial (alimentam o carrossel do Início) | `AdminBanners`, `BannerPreviewFrame` | `adminApi` (banners) |
| [~] | Promoções de anúncios | `AdminPage` (aba promoções) | `adminApi` (promoções) |
| [~] | Moderação de conversas | `AdminChats` | `chatModerationApi` |

O servidor é quem autoriza. Esconder a tela no app é só conveniência.

No app (17/11/2026): Menu › Administração abre `/admin` (rotas em `src/app/admin`, telas em `src/screens/admin`, chamadas em `src/api/admin.ts`). `AdminGate` esconde as áreas: `owner` para usuários, limite e promoções. O impulso de um anúncio fica no detalhe do veículo para ADMIN e DONO (`AdBoostPanel`). Promoções do dono reaproveitam `PromotionCard` e `PromotionEditor` de Meus anúncios. No editor de banner a prévia usa o mesmo `HeroCarousel` do Início e o ponto de foco é marcado tocando na imagem. Compila e passa no lint; não foi exercitado com login de admin (a senha do Dono local não estava disponível) nem conferido no aparelho.

## Pendências das telas parciais

Estado em 16/11/2026. Tudo o que está `[~]` compila e gera o bundle Android. As chamadas com login (sessão, favoritos, criar, editar, fotos, retirar e publicar, estatísticas, lotes, promoções e chat por REST e WebSocket) passaram de ponta a ponta contra o backend local, com o código de `src/api` rodando no Node. Falta conferir as telas no aparelho.

- Início: usa os banners do painel (`/site/banners`), com os locais como reserva. O número da plataforma por cima do banner (exibirNumeros) não é desenhado: os números já aparecem logo abaixo.
- Busca e lojistas: localização por cidade, UF, perto de mim (expo-location) e endereço do cadastro; o raio vem do servidor.
- Detalhe do anúncio: vídeo (expo-video), laudo, visualização, revelar FIPE com a cota, promoções e faixa do lote. Destaques e ficha técnica por tipo (barco, linha amarela), placa, aceita troca e histórico de leilão e sinistro (verde só com laudo), como no site.
- Mensagens: STOMP com o token no cabeçalho do handshake (sem mudança no backend). O Origin que o React Native manda (o do próprio servidor) é aceito como mesma origem. Envio com confirmação, recebimento, entrega e leitura em tempo real conferidos entre duas contas no backend local; sem conexão, volta a atualizar a cada 10 s.
- Conta (16/11/2026): cadastro em `/cadastro` (PF/PJ, CEP, foto, termos; conta nova do Google sem senha, com o verificador PKCE), senha em `/redefinir-senha` (esqueci e, com `origem=perfil`, troca), Minha conta em `/minha-conta` (dados, foto, senha, baixar dados, excluir em `/minha-conta/excluir`), avisos em `/avisos` (contador no Menu e na aba), fila de espera em `/fila-espera`, e a conferência dos dados como primeiro passo do Anunciar. Testado contra o backend local pela API e pela tela na web; redefinição e troca de senha não foram exercitadas até o fim porque mandam e-mail de verdade (Brevo ligado no backend local). Falta conferir no aparelho.
- Favoritos: na conta, com mescla dos de visitante ao entrar e desfazer em caso de erro; a aba carrega os cards do servidor.
- Google: funciona no build de desenvolvimento contra produção (`EXPO_PUBLIC_API_URL=https://phcauto.com`), conferido em 17/11/2026. Produção recusa `exp://`, então no Expo Go não fecha; contra o backend local pelo celular também não (o Google não volta para IP da rede local). O cadastro de conta nova vinda do Google ainda não foi exercitado no aparelho.
- Pagamentos (18/11/2026): assinatura, renovação, reembolso, compra de veículo e Minhas compras no app, com os mesmos endpoints do site. Compila e passa no lint; sem sessão, a disponibilidade de compra respondeu no formato esperado no backend local. Não foi feito pagamento de ponta a ponta (precisa de conta, Cielo sandbox e aparelho), nem a confirmação do banco numa WebView de verdade.
- Privacidade: sem a parte de cookies do site (o app não usa cookies nem o Pixel).
- Meus anúncios: completo, com Promoções e Lotes. Editar lote: completo.
- Detalhes do site trazidos em 17/11/2026: dicas de qualidade do anúncio (`AdQualityTips` → `src/components/ad-quality-tips.tsx`, nas etapas "Dados opcionais" e "Conferência"); troca automática da FIPE equivalente ao mudar zero km/seminovo (`useFipeConditionSync` → `src/hooks/use-fipe-condition-sync.ts`, no Anunciar e na edição; `POST /fipe/consultas/equivalente` e `GET /fipe/referencias/{id}`); dados da empresa do rodapé (`CompanyInfo` → Menu › Sobre, com o WhatsApp de `GET /vendas/atendimento` e o Instagram); e o atalho "Também quer anunciar?" no detalhe do veículo. Compilam e passam no lint; a troca da FIPE não foi exercitada contra o backend com login, e nada disso foi conferido no aparelho.
- Fora de propósito: aviso de cookies e Meta Pixel (o app não usa nenhum dos dois).

## Só do app

- [~] Entrar com Apple (só iPhone; exigência da App Store, regra 4.8). Backend e app prontos em 17/11/2026, com testes do token e da rota; não testado num iPhone. Fase 2 pendente: revogar o token da Apple ao excluir a conta (regra 5.1.1) e cadastrar o domínio de e-mail no relay da Apple (ver `phc-app-api`).

- [~] Alertas operacionais no celular de ADMIN e DONO (17/11/2026, com mudança no backend pedida pelo usuário): `MonitorOperacional` confere a cada minuto bancos, Redis, sincronização do banco de leitura, Brevo, Parallelum, Cielo, Expo, Google, Apple, cota diária da FIPE e picos de 5xx; avisa por push ("Fora do ar", "Ainda fora do ar" a cada 2 h, "Voltou"). Preferência "Alertas do sistema" em Menu › Notificações, com envio de teste. Ver `phc-app-api`.

Barra inferior, banner para anunciantes, animação de abertura, hápticos e gestos (ver `phc-app-design`).

- [~] Notificações push dos avisos da conta (mensagem nova e fila de espera), com preferências em Menu › Notificações. Backend e app prontos em 17/11/2026; backend local reconstruído com a V88 e testes de push passando; `eas.json` (perfil `development`) e `expo-dev-client` no app. Projeto no EAS (`@joaochecchia/phc-auto`), `google-services.json` (Firebase `phcauto`) e chave FCM V1 no EAS feitos em 17/11/2026. Falta o build de desenvolvimento do Android e o teste no aparelho; o iOS depende da conta paga da Apple (ver `phc-app-api`).

## Ordem sugerida

1. Base: projeto Expo, tema, cliente da API, barra inferior, abertura animada.
2. Leitura pública: Início, Buscar, detalhe do anúncio, lote, lojistas.
3. Sessão: login com 2FA, cadastro, perfil, favoritos.
4. Anunciante: criar anúncio, meus anúncios, edição, lotes.
5. Mensagens e avisos.
6. Planos, pagamentos e compras.
7. Administração e observabilidade.
8. Teste contra produção e preparação para as lojas.
