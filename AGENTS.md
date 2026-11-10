# PHC Auto — app mobile

Orienta o trabalho neste repositório. Comunique-se com o usuário em português brasileiro.

## O que é

App mobile (iOS e Android) do PHC Auto Repasse, marketplace de repasse de veículos: carros, motos, caminhões, caminhonetes, barcos e linha amarela. O site já existe em https://phcauto.com e o código dele está em `../PhcAutoRepasse` (`frontend/` em React + Vite, `backend/` em Spring Boot).

- O app usa **o mesmo backend** do site. Não há backend próprio do app.
- O app deve ter **todas as funcionalidades do site**, incluindo o painel administrativo com observabilidade. O mapa de telas está na skill `phc-app-paridade`.
- A interface é **diferente da do site**: é um app nativo, com navegação por abas, gestos e animações fluidas. Não é o site encolhido numa WebView.
- O repositório `../PhcAutoRepasse` é referência de leitura. Só altere algo lá quando o usuário pedir.

## Stack

- Expo (SDK mais recente estável na criação do projeto) com React Native e TypeScript estrito.
- Deve rodar no **Expo Go**. Só entram bibliotecas que funcionam no Expo Go; se uma funcionalidade exigir build de desenvolvimento, avise o usuário antes de adicioná-la.
- Expo Router (rotas em `src/app`), Reanimated + Gesture Handler para animação e gestos, `expo-haptics`, `expo-image`, `expo-secure-store`.
- TanStack Query para dados do servidor. Estado global só para sessão, tema e favoritos de visitante.
- `@stomp/stompjs` para o chat, como no site.
- Instale pacotes com `npx expo install <pacote>`, nunca com `npm install` direto.

## Estrutura

Siga a skill `expo-project-structure`:

```
assets/images/          logo e foto de capa (as mesmas do site)
src/app/                rotas do Expo Router, e só rotas
src/screens/            corpo das telas
src/components/         componentes reutilizados
src/api/                cliente HTTP, chamadas por domínio e contratos
src/hooks/  src/utils/
src/theme.ts            tokens de cor, espaçamento, tipografia e movimento
```

Arquivos em kebab-case. `src/api/contracts.ts` nasce de `../PhcAutoRepasse/frontend/src/lib/contracts.ts`.

## Regras do produto

- **Regra de negócio só no backend.** O app exibe, coleta e valida formato. Preço, elegibilidade, cotas, FIPE e permissões vêm da API.
- Nunca chame do app um serviço externo que exija segredo. ViaCEP, que é público, pode ser chamado direto, como no site.
- Sessão e tokens ficam só no `expo-secure-store`. Nunca em AsyncStorage, log, URL ou mensagem de erro.
- Todo fluxo assíncrono tem carregando, vazio, erro com "tentar de novo", desabilitado e sucesso. Não esconda erro no console.
- Texto curto em pt-BR, do domínio de veículos, sem frases genéricas.
- Tema claro e escuro desde a primeira tela, seguindo o sistema, com troca manual.
- Acessibilidade: rótulo em todo controle, alvo de toque de 44 pt ou mais, fonte dinâmica, e respeito a "reduzir movimento".
- Não adicione dependência nem abstração sem necessidade real.

## Interface

Detalhes na skill `phc-app-design`. O essencial pedido pelo usuário:

- **Barra inferior** com Início, Buscar, **Anunciar** (no centro, em destaque), Favoritos e Menu.
- **Busca em destaque no topo** da tela inicial, com atalho para mensagens ao lado.
- **Banner com foto** logo abaixo. Hoje usa `assets/images/hero.jpg`; no futuro o espaço será vendido a anunciantes, então já nasce como carrossel alimentado por uma lista.
- Vitrine com abas (Vitrine PHC, Zero km, Seminovo, Repasse, Vendidos), carrosséis de recomendados e atalhos por faixa de preço.
- **Animações fluidas**, incluindo a abertura do app com a logo do site (`assets/images/phc-auto-logo-disc.png`, recorte circular nítido da logo de 1024 px; também gera os ícones do app).
- As capturas de outros apps de veículos que o usuário enviou são **referência de estrutura**. Nunca copie marca, nome, logo, texto ou arte de terceiros.

## Skills

Carregue a skill antes de escrever código da área dela.

| Quando | Skill |
|---|---|
| Qualquer tarefa neste repositório | `phc-app-mobile` |
| Chamada à API, login, sessão, chat, upload | `phc-app-api` |
| Tela, componente, tema, animação da marca | `phc-app-design` |
| Decidir o que construir ou conferir cobertura | `phc-app-paridade` |
| Qualquer tarefa Expo (ponto de entrada) | `expo-overview` |
| Animação, gesto, transição, háptico | `expo-animation` e `react-native-best-practices` |
| Navegação e abas | `expo-router` |
| Componentes nativos, estilo | `expo-native-ui`, `expo-ui` |
| Tokens e consistência visual | `expo-design-system` |
| Requisições e cache | `expo-data-fetching` |
| Revisão de design de qualquer tela | `apple-design` (instalada em `~/.claude/skills`) |
| Direção estética | `frontend-design` |

A origem e a licença das skills de terceiros estão em `.claude/skills/README.md`.

## Como rodar e testar

O backend local sobe pelo Docker Compose do repositório do site:

```bash
cd ../PhcAutoRepasse/backend
docker compose up -d
docker compose logs -f backend   # espere "Started BackendApplication"
```

Ele escuta em `127.0.0.1:8080`. Sem `EXPO_PUBLIC_API_URL`, o app usa o computador que serve o Metro na porta 8080 (`src/api/client.ts`); o endereço em uso aparece em Menu › Sobre › Servidor. Para fixar outro:

| Onde o app roda | `EXPO_PUBLIC_API_URL` |
|---|---|
| Emulador Android | `http://10.0.2.2:8080` |
| Simulador iOS | `http://127.0.0.1:8080` |
| Celular com Expo Go na mesma rede | `http://<IP da máquina>:8080`, com `BACKEND_BIND=0.0.0.0` no `.env` do backend |
| Produção (fase futura) | `https://phcauto.com` |

Arquivos `.env*` com valores reais não entram no git; mantenha um `.env.example`.

Teste primeiro contra o backend local. Contra produção, só quando o usuário pedir, e nunca crie, edite ou apague dados reais sem autorização explícita dele.

Antes de dizer que algo está pronto:

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

Depois abra a tela no Expo Go ou emulador, em claro e escuro, e confira os estados de carregando, vazio e erro. Diga o que foi verificado no aparelho e o que não foi.

## Pontos em aberto

Decisões que ainda precisam do usuário. Não as presuma resolvidas.

1. **Autenticação no app.** O backend entrega o token só no cookie `PHC_AUTH`, mas aceita `Authorization: Bearer`. O caminho está descrito na skill `phc-app-api` e precisa ser validado num teste real antes de construir as telas de login.
2. **Chat em tempo real.** O WebSocket do backend só aceita as origens configuradas em `APP_CORS_ALLOWED_ORIGINS`. Pode ser preciso ajustar o backend para o app.
3. **Login com Google.** No site é um redirecionamento do navegador; no app precisa de fluxo próprio.
4. **Pagamento com cartão.** A tokenização e o 3DS da Cielo usam scripts de navegador; no app provavelmente rodam numa WebView.
5. **Assinatura de planos nas lojas.** Apple e Google têm regras sobre venda de serviços digitais dentro do app. Avaliar antes de publicar.
