---
name: phc-app-design
description: Identidade visual, estrutura das telas e movimento do app mobile PHC Auto - barra inferior com Anunciar em destaque, busca no topo, banner com foto, vitrine, cards de veículo, tema claro/escuro, animação de abertura com a logo. Use ao criar ou alterar qualquer tela, componente visual, tema, ícone, splash ou animação do app.
---

# Design — app PHC Auto

O app tem interface própria, diferente do site, mas a mesma marca. Use junto:

- `apple-design` para revisar cada tela contra as diretrizes da Apple (carregue também a referência de multiplataforma dela, por ser React Native).
- `expo-animation` para toda decisão de movimento. As curvas, molas e durações vêm de lá, não de estimativa.
- `expo-design-system` para tokens e `expo-native-ui` / `expo-ui` para controles nativos.
- `frontend-design` para direção estética.

## Marca

- Logo: `assets/images/phc-auto-logo-disc.png` (recorte circular da versão de 1024 px, fundo transparente; use esta no app). Originais do site: `phc-auto-logo.jpeg` (1024 px, fundo branco) e `phc-auto-logo-dark.png` (só 256 px, fica borrada ampliada). É um emblema circular preto com aro cromado, contorno vermelho, "PHC" e "AUTO" em vermelho e uma grade de câmbio no centro. Não redesenhe, recorte nem recolora.
- Paleta, a mesma do site (`../PhcAutoRepasse/frontend/src/styles.css`):

| Token | Claro | Escuro |
|---|---|---|
| fundo | `#fff` | `#121315` |
| superfície | `#fff` | `#1c1d20` |
| sutil | `#f6f6f6` | `#17181b` |
| texto | `#252527` | `#f1f1f2` |
| apagado | `#77777c` | `#a4a5ac` |
| borda | `#e8e8eb` | `#323339` |
| vermelho | `#cd1923` | `#ed424b` |
| vermelho pressionado | `#af111b` | `#ce2b35` |
| bom negócio (abaixo da FIPE) | `#28704a` | `#8bd4aa` |

- Vermelho é a cor de ação e de marca: use com parcimônia, uma ação principal por tela. Verde só para preço abaixo da FIPE e selos de confiança.
- Tipografia: títulos em Manrope e texto em DM Sans, como no site, via `expo-font`, com suporte a fonte dinâmica.
- Ícones: uma única família no app inteiro.

## Referências do usuário

O usuário enviou capturas de outro app de veículos como inspiração de **estrutura**: barra inferior, busca no topo, banner, carrossel de recomendados, atalhos por preço. Aproveite a organização. Não copie nome, logo, cores exatas, textos, campanhas ou arte de terceiros, e não crie telas que possam ser confundidas com as deles.

## Barra inferior

Cinco itens: **Início · Buscar · Anunciar · Favoritos · Menu**.

- Anunciar fica no centro e em destaque: botão vermelho elevado, maior que os vizinhos, com ícone de "+" e rótulo.
- Como o destaque central é customizado, use `Tabs` do Expo Router com barra própria, e não `NativeTabs`. Mantenha o comportamento de plataforma: área segura, rótulo sempre visível, alvo de 44 pt, estado selecionado em vermelho, háptico leve no toque.
- Anunciar sem sessão leva ao login e depois volta ao fluxo de anúncio, como no site.
- Menu reúne conta, meus anúncios, mensagens, planos, fila de espera, compras, lojistas, Pátio PHC, tabela FIPE, privacidade, tema e, para admin e dono, o painel administrativo.
- Troca de aba não desliza nem anima o conteúdo.

## Tela inicial, de cima para baixo

1. **Topo**: logo pequena, campo de busca largo e arredondado com texto de exemplo ("Busque por marca ou modelo") e, ao lado, o atalho de mensagens com contador de não lidas.
2. **Banner com foto**: carrossel de cantos arredondados com indicador de páginas. Começa com `assets/images/hero.jpg`. É alimentado por uma lista (imagem, destino, rótulo acessível), porque o espaço será de anunciantes no futuro. Com um item só, não mostra indicador nem gira sozinho.
3. **Números da plataforma**: "veículos à venda agora" e "vendidos pelo PHC" (`GET /anuncios/numeros`).
4. **Tipos de veículo** e **localização** ("Todo o Brasil", cidade, UF ou perto de mim) como atalhos de busca.
5. **Vitrine** com abas: Vitrine PHC, Zero km, Seminovo, Repasse, Vendidos. Aba ativa com sublinhado vermelho que acompanha o toque.
6. **Recomendados**: carrossel horizontal de cards, com contador e "Ver todos".
7. **Pesquise por preço**: atalhos em pílulas vermelhas que abrem a busca já filtrada.

## Card de veículo

Foto com proporção fixa, marca e modelo, versão, preço em destaque, ano e cidade/UF, coração de favorito. Selos quando houver: abaixo da FIPE, vendido, lote, loja verificada. Compacto e fácil de comparar; sem card dentro de card.

## Movimento

Siga a sequência da skill `expo-animation`: primeiro decidir se anima, depois o propósito, depois a ferramenta mais simples. Resumo aplicado a este app:

- **Abertura**: a splash nativa mostra a logo parada sobre o fundo escuro da marca. Ao carregar, uma splash em Reanimated assume com a logo na mesma posição e tamanho, faz uma entrada curta (escala com mola e um brilho no aro vermelho) e dissolve para a tela inicial enquanto o conteúdo sobe levemente. Dura cerca de um segundo, nunca segura o app depois que os dados chegaram, e com "reduzir movimento" vira um simples esmaecer. No Expo Go a splash nativa configurada não aparece igual; valide a passagem num build.
- **Carregamento**: esqueletos com o formato do conteúdo, não rodinha no meio da tela. Puxar para atualizar usa o controle nativo.
- **Toque**: resposta de pressão quase imperceptível em cards e botões; háptico leve em favoritar, trocar de aba e concluir ação.
- **Favoritar**: o coração é o lugar do pequeno momento de prazer.
- **Navegação**: transições nativas da pilha; filtros, localização e confirmações em folhas nativas (`formSheet`).
- **Galeria do anúncio**: deslizar entre fotos e pinçar para ampliar, com gesto contínuo e interrompível.
- Nada de animação em ações repetidas dezenas de vezes por sessão. Anime só transform e opacidade, na thread de UI.

## Qualidade

Antes de fechar uma tela: confira em claro e escuro, em tela pequena e grande, com fonte ampliada e com "reduzir movimento"; sem texto cortado nem rolagem horizontal acidental; e passe a revisão da `apple-design`.
