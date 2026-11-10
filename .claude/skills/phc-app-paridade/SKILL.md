---
name: phc-app-paridade
description: Mapa de paridade entre o site phcauto.com e o app mobile PHC Auto - lista de todas as telas e funcionalidades do site, onde cada uma fica no app, o arquivo de origem e as chamadas de API. Use ao planejar o que construir, escolher a próxima tela, estimar o trabalho ou conferir se o app cobre tudo o que o site faz, inclusive o painel admin e a observabilidade.
---

# Paridade site → app

O app deve fazer tudo o que o site faz. Origem das telas: `../PhcAutoRepasse/frontend/src/pages/` e `App.tsx`. As chamadas estão em `../PhcAutoRepasse/frontend/src/lib/backend.ts`, no objeto indicado.

Ao concluir uma tela, marque-a aqui. Se o site ganhar uma tela nova, acrescente a linha.

## Público

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| [ ] | Início: vitrine, abas, vendidos recentes, números | `App.tsx`, `HeroNumbers` | `homeAds`, `platformNumbers`, `searchAds` | aba Início |
| [ ] | Busca com filtros, ordenação, paginação, localização por raio | `App.tsx`, `Filters`, `data/filters.ts` | `searchAds` | aba Buscar |
| [ ] | Detalhe do anúncio: galeria, vídeo, laudo, FIPE, contato | `VehiclePage`, `FipeDeal`, `VideoPlayer` | `getPublicAd`, `revealAdFipe`, `getAdContactChannels`, `requestWhatsappContact`, `adStatsApi.view` | pilha |
| [ ] | Lote de veículos | `LotPage` | `lotsApi` | pilha |
| [ ] | Lojistas e página da loja | `StoresPage` | `searchStores`, `storeProfile`, `publicProfile` | Menu |
| [ ] | Pátio PHC | `PatioPage` | `searchAds` | Menu |
| [ ] | Tabela FIPE | `FipeTablePage`, `FipeVehicleSelector` | `getFipePage`, `resolveFipeReference`, `getFipeQuota` | Menu |
| [ ] | Planos e preços | `PlansPage` | `plansApi.list` | Menu |
| [ ] | Privacidade e termos | `PrivacyPage` | `privacyApi.info` | Menu |

## Conta

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| [ ] | Login com 2FA por e-mail e dispositivo confiável | `LoginPage` | `authApi` | modal |
| [ ] | Login com Google | `SocialAuthButtons` | `/oauth2/authorization/google`, `authApi` social | modal |
| [ ] | Cadastro PF/PJ com aceite dos termos e ViaCEP | `RegisterPage`, `FormFields`, `lib/viacep.ts` | `authApi.register` | modal |
| [ ] | Redefinir senha | `ResetPasswordPage` | `authApi` (redefinições) | modal |
| [ ] | Perfil, foto, troca de senha | `ProfilePage`, `ProfilePhoto` | `authApi.profile`, `uploadProfilePhoto` | Menu |
| [ ] | Exportar e excluir dados (LGPD) | `AccountPrivacy` | `privacyApi` | Menu |
| [ ] | Favoritos, com mescla dos favoritos de visitante ao entrar | `App.tsx` | `favoritesApi` | aba Favoritos |
| [ ] | Avisos da conta | `App.tsx` | `noticesApi` | Início e Menu |
| [ ] | Mensagens (chat em tempo real) | `MessagesPage`, `lib/chatSocket.ts` | `chatApi`, STOMP | Início e Menu |
| [ ] | Fila de espera | `WaitlistPage` | `waitlistApi` | Menu |

## Anunciante

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| [ ] | Conferir dados do anunciante | `ProfilePage` | `authApi.profile` | aba Anunciar |
| [ ] | Criar anúncio: FIPE, campos por tipo, fotos, vídeo, laudo | `AnnouncePage`, `AdMedia`, `AdVehicleFields`, `data/announcementFields.ts` | `getAdFormCatalog`, `createAdWithPhotos`, `adMediaApi` | aba Anunciar |
| [ ] | Cota de anúncios e aviso de limite | `AdQuotaDialog`, `AdSlots` | `myAdsApi.quota` | aba Anunciar |
| [ ] | Meus anúncios: filtros, publicar, pausar, renovar, retirar, excluir | `MyAdsPage`, `AdRetireDialog`, `AdListFilters` | `myAdsApi` | Menu |
| [ ] | Editar anúncio | `EditAdPage` | `myAdsApi.forEdit`, `adPatchFromDrafts` | pilha |
| [ ] | Estatísticas do anúncio | `AdStatsDialog` | `adStatsApi` | folha |
| [ ] | Criar e editar lote | `LotEditPage`, `LotUnits` | `lotsApi` | pilha |

## Pagamentos

| Feito | Funcionalidade | Origem no site | API | No app |
|---|---|---|---|---|
| [ ] | Assinar plano: Pix, boleto, crédito, débito | `PlanCheckout`, `CardFields`, `BoletoBox`, `lib/cieloCard.ts` | `plansApi` | pilha |
| [ ] | Minha assinatura, renovação automática, reembolso | `PlansPage` | `plansApi` | Menu |
| [ ] | Comprar veículo pelo app | `VehicleCheckout` | `salesApi` | pilha |
| [ ] | Minhas compras | `PurchasesPage` | `salesApi` | Menu |

Cartão: no site, tokenização e 3DS da Cielo rodam com scripts do navegador e o número do cartão nunca passa pelo backend da PHC. No app, mantenha essa garantia; o caminho provável é uma WebView. Decida com o usuário antes de construir.

## Administração

Visível só para os papéis de admin e dono, conforme `papel` da sessão. As abas "Usuários" e "Limite de anúncios" são só do dono.

| Feito | Funcionalidade | Origem no site | API |
|---|---|---|---|
| [ ] | Observabilidade | `AdminObservability` | `adminApi.observability` (`GET /admin/observabilidade`) |
| [ ] | Usuários, papéis e assinaturas cortesia | `AdminUsers` | `adminApi` |
| [ ] | Limite de anúncios | `AdminAdLimit` | `adLimitReleaseApi` |
| [ ] | Anúncios impulsionados | `AdminBoosts`, `AdBoostPanel` | `boostsApi` |
| [ ] | Moderação de conversas | `AdminChats` | `chatModerationApi` |

O servidor é quem autoriza. Esconder a tela no app é só conveniência.

## Só do app

Barra inferior, banner para anunciantes, animação de abertura, hápticos e gestos (ver `phc-app-design`).

## Ordem sugerida

1. Base: projeto Expo, tema, cliente da API, barra inferior, abertura animada.
2. Leitura pública: Início, Buscar, detalhe do anúncio, lote, lojistas.
3. Sessão: login com 2FA, cadastro, perfil, favoritos.
4. Anunciante: criar anúncio, meus anúncios, edição, lotes.
5. Mensagens e avisos.
6. Planos, pagamentos e compras.
7. Administração e observabilidade.
8. Teste contra produção e preparação para as lojas.
