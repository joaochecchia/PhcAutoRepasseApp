# Riscos de reprovação — App Store e Google Play

Levantamento de 19/11/2026 (itens 1.1 a 1.5 resolvidos no mesmo dia) feito a partir do código (`app.json`, `eas.json`, `src/`) e de uma busca no backend em `../PhcAutoRepasse/backend`. Ainda não houve envio para revisão nem teste em build de loja.

Legenda:

- **Bloqueia**: reprovação provável, ou o envio nem é aceito. Resolver antes de enviar.
- **Risco**: depende do revisor. Vale reduzir.
- **Envio**: não está no código, mas é preenchido no App Store Connect ou no Play Console e reprova se faltar.
- ✅ já atendido (fica registrado para não se perder).

---

## 1. Bloqueiam

Os cinco itens abaixo foram resolvidos no código em 19/11/2026. O que ainda depende de você está em **Falta**.

### 1.1 Exclusão de conta revoga o "Entrar com Apple" (Apple 5.1.1(v)) ✅

- Backend: `AppleRevogacaoService`. Na exclusão, troca o código da Apple por tokens, confere que é a mesma conta Apple, exclui e revoga o refresh token. Nenhum token fica guardado. Se a Apple não responder, a conta não é excluída e a pessoa tenta de novo.
- Perfil (`GET /usuarios/{id}`) passou a trazer `contaApple`.
- App: no iPhone, numa conta com Apple, a exclusão pede uma nova confirmação da Apple (Face ID) e envia o código (`src/api/apple.ts`, `src/screens/account/delete-account.tsx`).
- **Falta:** criar em developer.apple.com › Keys uma chave com "Sign in with Apple" e definir `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY` no `.env` de produção. Sem elas a exclusão funciona, mas não revoga, e o log avisa. Depois, teste a exclusão num build de desenvolvimento ou TestFlight (no Expo Go a troca do código falha).
- Limite: uma conta com Apple excluída **pelo site** não é revogada, porque só o iPhone obtém o código. A revisão da Apple olha o app.

### 1.2 Textos de permissão em pt-BR (Apple 5.1.1) ✅

`expo-image-picker` está em `plugins` no `app.json`, com texto para fotos e câmera. O microfone foi desligado (`microphonePermission: false`), o que tira `NSMicrophoneUsageDescription` do iPhone e `RECORD_AUDIO` do Android. Conferido com `npx expo config --type introspect`. Só vale a partir do próximo build (no Expo Go os textos são os do Expo Go).

Revisão de 19/11/2026: cada texto diz todos os usos, e os genéricos em inglês que os plugins punham sumiram.

| Permissão (iOS) | Uso no app |
|---|---|
| Câmera | Fotografar o veículo do anúncio e a foto do perfil |
| Fotos | Escolher fotos e vídeo do veículo e a foto do perfil (só o selecionado é enviado) |
| Localização ao usar | "Perto de mim" na busca de veículos e de lojas, precisão reduzida por padrão |
| Localização sempre | Não é pedida; o texto fica para evitar o aviso ITMS-90683 e diz que não há uso em segundo plano |
| Movimento, Face ID, precisão total | Removidos (`false` nos plugins `expo-location` e `expo-secure-store`) |

O texto em inglês de rede local do `expo-dev-client` é apagado sozinho no build de loja (fase de build do `expo-dev-launcher`).

Notificações (sem texto de sistema no iOS; o app explica antes de pedir): mensagens de comprador ou vendedor, veículo novo da fila de espera e, só para a administração, alertas do sistema. O convite, a tela Notificações e o canal "Outros avisos da conta" do Android dizem que não há propaganda por notificação.

### 1.3 Conta de teste para o revisor (Apple 2.1 / Play "Acesso ao app") ✅ no código

- Backend: `MFA_ISENTOS` lista e-mails que entram sem o código por e-mail. Só vale para contas CLIENTE; ADMIN e DONO sempre pedem o código.
- **Falta:**
  1. criar em produção uma conta CLIENTE só para a revisão, com senha forte;
  2. publicar nela dois ou três anúncios e abrir uma conversa com outra conta;
  3. pôr o e-mail em `MFA_ISENTOS` e reiniciar o backend;
  4. informar e-mail e senha nas notas ao revisor (App Store Connect) e em "Acesso ao app" (Play Console);
  5. esvaziar `MFA_ISENTOS` quando não houver app em revisão.
- O revisor provavelmente vai testar a exclusão de conta. Deixe uma segunda conta pronta ou recrie a conta depois de cada envio.

### 1.4 Convites para trocar de plano ✅

- **Textos do app**, iguais no Android e no iPhone. "Mude de plano", "nos planos que incluem…" e "quando o plano da conta inclui…" viraram frases neutras como "O seu plano atual não inclui vídeo e laudo." Telas: Meus anúncios, mídia do anúncio, lote, anunciar, promoções e estatísticas.
- **Erros do backend.** As mensagens de limite ("Assine um plano…") agora têm o convite sempre como última frase. Com o cabeçalho `X-PHC-Cliente: app`, o backend (`ConvitePlanoAppAdvice`) tira essa frase; o site continua recebendo a mensagem inteira. Também saiu "fazem parte dos planos pagos" das mensagens de mídia e de promoções.
- **Banners.** O app não mostra banner com link para `/planos` (`leadsToPlans` em `src/utils/site-link.ts`).
- **Avisos e push.** O backend só gera avisos de chat, fila de espera e alertas de sistema (só administração). Nenhum vende plano.
- **Falta (regra editorial):** não cadastrar banner sem link com arte de venda de plano ("Assine o Pro") para aparecer no celular. Esse banner o app não consegue identificar. Use `exibirEm: COMPUTADOR` nesses banners.

### 1.5 Recursos "em breve" ✅

As linhas "Relatórios de desempenho" e "API para integrar seu sistema" saíram da tela Meu plano (`src/data/plans.ts`). Voltam quando os recursos existirem.

---

## 2. Riscos

### 2.1 Assinatura multiplataforma sem compra da Apple (Apple 3.1.3(b))

Já registrado no `AGENTS.md`. Um app só de consumo, sem nenhuma menção a compra, costuma passar como "multiplatform service", mas o revisor pode pedir a compra da Apple. Para reduzir o risco, as notas ao revisor devem dizer: "Os planos são contratados no site por empresas e revendedores; o app não vende nem anuncia planos, só mostra o plano da conta." Se exigirem, as saídas estão no `AGENTS.md`: StoreKit, ou o link externo do Brasil.

### 2.2 Cadastro pede dados demais para quem só quer comprar (Apple 5.1.1(i)/(ii))

Criar conta exige CPF, data de nascimento, telefone e endereço completo, inclusive para quem entra com Apple (`src/components/account-fields.tsx`). A justificativa é que a conta serve para comprar e anunciar veículos, o que é aceitável. Vale deixar isso claro nas notas ao revisor e conferir:

- navegar, buscar, ver anúncio e favoritar funcionam sem conta ✅ (pelo código, favoritos de visitante existem);
- se a Apple contestar, peça CPF e endereço só ao anunciar ou comprar, e não ao criar conta para conversar.

Depois do "Entrar com Apple", o cadastro não pede de novo o e-mail (`lockEmail`) ✅ e só pede o nome quando a Apple não o envia ✅.

### 2.3 iPad habilitado sem layout próprio (Apple 2.4.1 / 2.1)

`app.json` tem `"supportsTablet": true`. A Apple testa no iPad e reprova tela cortada, esticada ou quebrada. Também passam a ser exigidas capturas de tela de iPad. Se o app não foi testado no iPad, use `false`: ele ainda roda no iPad em modo iPhone.

### 2.4 Localização precisa no Android sem uso (Play: permissões)

`app.json` declara `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION`, mas `src/utils/location.ts` usa precisão `Balanced` e o texto fala em "localização aproximada". A Play Store pede o mínimo necessário, e a declaração de Segurança dos dados terá de justificar a localização precisa. Deixe só `ACCESS_COARSE_LOCATION`.

### 2.5 Conteúdo gerado por usuários (Apple 1.2 / Play: UGC)

Já existe:

- ✅ denunciar anúncio (`src/screens/vehicle/index.tsx`) e mensagem (`src/screens/messages/conversation.tsx`);
- ✅ bloquear e desbloquear usuário no chat;
- ✅ fila de denúncias no painel admin (`src/screens/admin/reports.tsx`);
- ✅ aceite dos Termos no cadastro.

Falta conferir:

- se os Termos (PDF `termos-uso-politica-privacidade-v1.1.pdf`) dizem com clareza que não se tolera conteúdo abusivo e que há punição (a Apple pede isso no aceite do EULA);
- se as denúncias são tratadas em até 24 h e o autor removido (é o que a Apple espera; explique nas notas ao revisor);
- se fotos de anúncio passam por alguma moderação antes de ir ao ar. Se não passam, a denúncia e a remoção rápida têm de bastar.

### 2.6 Pedido de notificação push (Apple 4.5.4)

O pedido de permissão parte de um botão (`src/components/push-prompt.tsx`) ✅, e não da abertura do app. Push de marketing ou promoção exige consentimento explícito e uma forma de desligar no app. Se o backend mandar push promocional, confira se existe essa opção separada em Notificações.

### 2.7 Pagamento com cartão dentro do app

Compra de **veículo** pela Cielo (cartão, Pix, boleto) é bem físico, permitido nas duas lojas ✅. Pontos de atenção:

- o revisor pode achar que é compra de conteúdo digital. Nas notas, explique que é o pagamento do veículo ou do sinal ao vendedor;
- o 3DS roda numa WebView (`src/hooks/use-card-payment.tsx`). Teste num build de loja; erro ou tela em branco ali vira reprovação por bug (2.1).

### 2.8 Linha "Servidor" no Menu

`src/screens/menu/index.tsx` mostra a URL da API e "No ar / Fora do ar". Em produção isso parece tela de depuração e pode levantar dúvida (Apple 2.3 / 4.0). Considere mostrá-la só em build de desenvolvimento ou para administradores.

### 2.9 Texto que fala do Expo Go

`src/screens/notification-settings/index.tsx:22` menciona "Expo Go" e "build de desenvolvimento". Num build de loja esse estado não deveria aparecer. Confira se ele fica atrás de `isRunningInExpoGo()`, para nunca mostrar ao revisor referências a ferramentas de desenvolvimento (Apple 2.3.10).

### 2.10 Diálogo de saída cita só Google

`confirmLogout` (`src/screens/menu/index.tsx`) diz "entrar com e-mail e senha ou Google". No iPhone, inclua Apple. Não reprova sozinho, mas é sinal de inconsistência.

### 2.11 Nome "FIPE" e dados de terceiros (Apple 5.2 / Play: propriedade intelectual)

A tela "Tabela FIPE" usa o nome e os dados da Fundação FIPE. Os dados são públicos e o uso é comum, então o risco é baixo. Não use o logotipo da FIPE e deixe claro que o preço é de referência.

---

## 3. Itens de envio

### Apple (App Store Connect)

- **Rótulos de privacidade** (App Privacy): nome, e-mail, telefone, CPF, endereço, localização aproximada, fotos, mensagens do chat, histórico de compras, identificador do aparelho (token de push). Marque "não usado para rastreamento" se for verdade.
- **Política de privacidade**: URL obrigatória. Hoje é um PDF (`https://phcauto.com/documentos/termos-uso-politica-privacidade-v1.1.pdf`). Funciona, mas uma página HTML é mais segura.
- **Criptografia**: adicione `"ios": { "infoPlist": { "ITSAppUsesNonExemptEncryption": false } }` (só HTTPS padrão). Sem isso, cada build fica parado esperando resposta.
- **Privacy manifest**: o Expo SDK 58 gera o dos módulos dele. Se o envio avisar sobre "required reason API", complete em `ios.privacyManifests` no `app.json`.
- **Notas ao revisor**: conta de demonstração (1.3), explicação dos planos (2.1), do pagamento de veículo (2.7) e da moderação (2.5).
- **Capturas**: iPhone 6,9" e, se `supportsTablet` ficar `true`, iPad 13".
- **Classificação etária**: o chat entre usuários entra como "conteúdo gerado por usuários / comunicação irrestrita".
- **Capacidades**: "Sign in with Apple" e "Push Notifications" ativadas no identificador `com.phcauto.app` (o EAS faz isso se as credenciais forem dele).

### Google (Play Console)

- **Segurança dos dados**: os mesmos dados da Apple, com finalidade e se são compartilhados (Cielo para pagamento, Google para login, Firebase para push).
- **Exclusão de conta**: a Play exige, além da opção no app ✅, **um link na web** onde a pessoa pede a exclusão sem instalar o app. No site, a exclusão está dentro do perfil (`ProfilePage.tsx`). Crie uma página pública que explique o passo a passo (ou tenha um formulário) e informe a URL no Console.
- **Acesso ao app**: credenciais da conta de demonstração (1.3).
- **Declaração de permissões**: localização (2.4) e, se pedido, a de fotos e vídeos. A Play restringe `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` a apps cuja função central é mídia; confira se o build final usa o seletor de fotos do sistema e não declara essas permissões (`npx expo prebuild` e veja o `AndroidManifest.xml`).
- **Teste fechado**: conta pessoal de desenvolvedor criada depois de nov/2023 precisa de 12 testadores por 14 dias antes de publicar em produção. Conta de organização (CNPJ) não tem essa exigência.
- **Classificação de conteúdo** (questionário IARC): marque interação entre usuários e compras.
- **Público-alvo**: maiores de 18 (há compra e venda de veículos e CPF).

---

## 4. Resumo do que fazer, por ordem

1. Chave da Apple no `.env` de produção (1.1) e conta de revisão com `MFA_ISENTOS` (1.3).
2. `app.json`: `ITSAppUsesNonExemptEncryption`, remover `ACCESS_FINE_LOCATION` e decidir `supportsTablet` (2.3, 2.4, 3).
3. Página pública de exclusão de conta no site (Play).
4. Esconder a linha "Servidor" e textos de Expo Go em build de loja (2.8, 2.9).
5. Preencher privacidade, notas ao revisor e capturas (3).

---

## 5. Correções de 19/11/2026 (revisão com a lista do Codex)

- **Política de privacidade em HTML**: `phcauto.com/politica-de-privacidade` (site, `PrivacyPolicyPage.tsx`). Descreve só o que roda hoje; empresas, prazos e cookies vêm de `/compliance/privacidade`. É essa a URL para a Apple e para a Google. O app (Privacidade e cadastro) e o site apontam para ela.
- **Lista de empresas**: Hostinger no Brasil; entraram Expo (push), Google (login e FCM) e Apple (login e APNs); Cielo também na compra de veículos. Novos prazos: aparelhos de push, localização (não guardada) e denúncias e bloqueios.
- **Exclusão de conta**: página pública `phcauto.com/excluir-conta` (URL para o Play Console), com passo a passo no app, no site e sem acesso, e o que fica guardado. As telas de exclusão do app e do site passaram a citar conversas (180 dias), logins e acessos (6 meses) e logs e cópias (14 dias).
- **Apple**: o "Entrar com Apple" do app publicado é recusado enquanto `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY` não estiverem configurados (Expo Go segue funcionando). Limite que continua: conta Apple excluída pelo site ou pelo Android não é revogada, porque só o iPhone obtém o código; fechar isso exige guardar o refresh token da Apple criptografado.
- **Moderação**: bloqueio do anunciante direto pelo anúncio, sem conversa anterior (app; backend aceita qualquer conta existente). Filtro preventivo de palavrões, insultos e ofensas discriminatórias (`TextoOfensivo`) no título e na descrição de anúncios e lotes, nas promoções e no chat. Fotos continuam só com denúncia e moderação.
- **Ainda pendente**: o PDF `termos-uso-politica-privacidade-v1.1.pdf` (Termos e Política aceitos no cadastro) é uma minuta para revisão jurídica, com dados que não batem com a operação (Stripe, Mercado Pago, Supabase/AWS/Vercel, Google Analytics, biometria, "[Nome a definir]", anexo interno). Precisa de revisão do advogado e de nova versão.
