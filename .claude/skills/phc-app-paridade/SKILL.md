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
| [~] | Login com Google (produção aceita o modo app; falta o login real num build de desenvolvimento) | `SocialAuthButtons` | `/oauth2/authorization/google`, `authApi` social | modal |
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
| [ ] | Banners da página inicial (alimentam o carrossel do Início) | `AdminBanners`, `BannerPreviewFrame` | `adminApi` (banners) |
| [ ] | Promoções de anúncios | `AdminPage` (aba promoções) | `adminApi` (promoções) |
| [ ] | Moderação de conversas | `AdminChats` | `chatModerationApi` |

O servidor é quem autoriza. Esconder a tela no app é só conveniência.

## Pendências das telas parciais

Estado em 16/11/2026. Tudo o que está `[~]` compila e gera o bundle Android. As chamadas com login (sessão, favoritos, criar, editar, fotos, retirar e publicar, estatísticas, lotes, promoções e chat por REST e WebSocket) passaram de ponta a ponta contra o backend local, com o código de `src/api` rodando no Node. Falta conferir as telas no aparelho.

- Início: usa os banners do painel (`/site/banners`), com os locais como reserva. O número da plataforma por cima do banner (exibirNumeros) não é desenhado: os números já aparecem logo abaixo.
- Busca e lojistas: localização por cidade, UF, perto de mim (expo-location) e endereço do cadastro; o raio vem do servidor.
- Detalhe do anúncio: vídeo (expo-video), laudo, visualização, revelar FIPE com a cota, promoções e faixa do lote. Destaques e ficha técnica por tipo (barco, linha amarela), placa, aceita troca e histórico de leilão e sinistro (verde só com laudo), como no site.
- Mensagens: STOMP com o token no cabeçalho do handshake (sem mudança no backend). O Origin que o React Native manda (o do próprio servidor) é aceito como mesma origem. Envio com confirmação, recebimento, entrega e leitura em tempo real conferidos entre duas contas no backend local; sem conexão, volta a atualizar a cada 10 s.
- Conta (16/11/2026): cadastro em `/cadastro` (PF/PJ, CEP, foto, termos; conta nova do Google sem senha, com o verificador PKCE), senha em `/redefinir-senha` (esqueci e, com `origem=perfil`, troca), Minha conta em `/minha-conta` (dados, foto, senha, baixar dados, excluir em `/minha-conta/excluir`), avisos em `/avisos` (contador no Menu e na aba), fila de espera em `/fila-espera`, e a conferência dos dados como primeiro passo do Anunciar. Testado contra o backend local pela API e pela tela na web; redefinição e troca de senha não foram exercitadas até o fim porque mandam e-mail de verdade (Brevo ligado no backend local). Falta conferir no aparelho.
- Favoritos: na conta, com mescla dos de visitante ao entrar e desfazer em caso de erro; a aba carrega os cards do servidor.
- Google: produção aceita `phcauto://auth` e recusa `exp://`, então no Expo Go o Google não fecha contra produção. Testar com build de desenvolvimento ou liberar `exp://` em produção (decisão do usuário).
- Planos: lista, preços e "Seu plano". A assinatura abre o site: pagamento no app depende dos pontos em aberto 2 e 3 do AGENTS.md.
- Privacidade: sem a parte de cookies do site (o app não usa cookies nem o Pixel).
- Meus anúncios: completo, com Promoções e Lotes. Editar lote: completo.
- Detalhes do site trazidos em 17/11/2026: dicas de qualidade do anúncio (`AdQualityTips` → `src/components/ad-quality-tips.tsx`, nas etapas "Dados opcionais" e "Conferência"); troca automática da FIPE equivalente ao mudar zero km/seminovo (`useFipeConditionSync` → `src/hooks/use-fipe-condition-sync.ts`, no Anunciar e na edição; `POST /fipe/consultas/equivalente` e `GET /fipe/referencias/{id}`); dados da empresa do rodapé (`CompanyInfo` → Menu › Sobre, com o WhatsApp de `GET /vendas/atendimento` e o Instagram); e o atalho "Também quer anunciar?" no detalhe do veículo. Compilam e passam no lint; a troca da FIPE não foi exercitada contra o backend com login, e nada disso foi conferido no aparelho.
- Fora de propósito: aviso de cookies e Meta Pixel (o app não usa nenhum dos dois).

## Só do app

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
