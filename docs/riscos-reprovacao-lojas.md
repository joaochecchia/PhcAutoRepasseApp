# Riscos de reprovação — App Store e Google Play

Situação em 19/11/2026, conferida no código do app (`app.json`, `src/`) e do site/backend (`../PhcAutoRepasse`).
**O app ainda não foi enviado para revisão nem testado num build de loja.** Nada aqui garante aprovação: a decisão é
do revisor de cada loja.

Legenda: **Corrigido** (no código, com teste), **Falta configurar** (fora do código), **Decisão** (produto ou
jurídico), **Risco** (depende do revisor), **Não verificado** (precisa de aparelho, build ou credencial).

---

## 1. Exclusão de conta e "Entrar com Apple" (Apple 5.1.1(v); Google Play: exclusão de conta)

**Corrigido.**

- **Login no iPhone:** o app manda o código de autorização. O backend troca o código por refresh token e o guarda cifrado (AES-256-GCM), como pede a Apple (TN3194).
- **Exclusão por qualquer caminho:** app, site ou painel do DONO. O token entra numa fila de revogação na mesma transação da exclusão; a revogação é tentada na hora e repetida com intervalo crescente por até 7 dias.
- **Resposta da exclusão:** diz o que aconteceu (`REVOGADA`, `PENDENTE`, `SEM_TOKEN` ou `NAO_SE_APLICA`). App e site só falam em revogação quando a Apple confirmou.
- **Conta antiga sem token:**
  - No iPhone, a Apple confirma antes de excluir.
  - Se a pessoa recusa, a Apple falha, ou a exclusão é pelo site ou pelo Android, a conta é excluída mesmo assim; a exclusão nunca fica bloqueada.
  - A pessoa recebe o caminho oficial para remover o app na conta Apple (support.apple.com/pt-br/102571).
- **Tela do app:** não libera a exclusão com o perfil carregando ou com erro. Mostra "Tentar novamente"; antes, uma falha do perfil permitia excluir sem revogar.
- **Sem configuração:** sem as chaves da Apple e de cifra, o login com Apple do app publicado é recusado, para não criar conta que não possa ser revogada.
- **Página pública de exclusão (Google Play):** `phcauto.com/excluir-conta`, sem precisar do app.
- Arquivos:
  - backend: `usuarios/.../security/AppleRevogacaoService.java`, `CifraTokensApple.java`, `RevogacaoAppleListener.java` e a migração `V92__tokens_apple.sql`;
  - app: `src/screens/account/delete-account.tsx` e `deletion-flow.ts`;
  - site: `AccountPrivacy.tsx`, `AccountDeletionPage.tsx` e `lib/accountSafety.ts`.

**Falta configurar:**

- Criar a chave "Sign in with Apple" em developer.apple.com › Keys.
- Definir no backend de produção:
  - `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY` (o conteúdo do .p8);
  - `APPLE_TOKENS_CHAVE`, gerada com `openssl rand -base64 32`.
- Guardar a chave de cifra só no `.env` de produção e num cofre de senhas.
- Para trocar a chave de cifra, mover a antiga para `APPLE_TOKENS_CHAVE_ANTERIOR`.
- Informar `https://phcauto.com/excluir-conta` no Play Console.

**Não verificado:**

- Troca do código e revogação com a Apple de verdade: exige build de desenvolvimento ou TestFlight e a chave real; no Expo Go o código é de outro cliente.
- Testado localmente, simulando a conta Apple direto no banco: exclusão `SEM_TOKEN`, `PENDENTE` com o token indo para a fila, e `NAO_SE_APLICA`.

**Limites que continuam:**

- Contas Apple criadas antes desta versão só ganham token no próximo login com Apple no iPhone.
- Se forem excluídas pelo site ou pelo Android antes disso, não há como revogar pelo servidor: a pessoa recebe as instruções da Apple.
- As notificações servidor a servidor da Apple (`consent-revoked`) não foram implementadas. São opcionais e serviriam para apagar o token quando a pessoa remove o app pela Apple.

## 2. Bloqueio de anunciante e moderação (Apple 1.2; Google Play: conteúdo gerado por usuários)

**Corrigido.**

- **Bloqueio pelo anúncio:**
  - O controle fica sempre visível: "Conferindo bloqueio…" enquanto carrega e "Tentar novamente" se a lista falha.
  - Com o estado desconhecido, nunca bloqueia nem desbloqueia. Vale no app (`src/screens/vehicle/block-seller.tsx`) e no site (`BlockSellerButton.tsx`).
  - O backend aceita o bloqueio sem conversa anterior; bloqueado, nenhum dos dois abre conversa nem manda mensagem.
- **Filtro de texto** (`TextoOfensivo`, no backend). Recusa palavrão, insulto e ofensa discriminatória em:
  - anúncio e lote (criação e edição, inclusive lote montado só com anúncios já existentes);
  - promoções e descrição de foto;
  - nome e razão social da conta;
  - mensagens do chat (pela API e pelo WebSocket).
- **Chat no site:** mensagem recusada pelo filtro volta ao campo para editar, em vez de "Tentar de novo".
- **Testado localmente:** bloqueio sem conversa, lista, desbloqueio, 404 para conta inexistente, e nome ofensivo recusado no cadastro e na edição.

**Não resolve tudo:**

- **Fotos e vídeos:** não têm filtro automático. Dependem de denúncia e da equipe. Não foi adicionado serviço pago de moderação de imagem.
- **Filtro de palavras:** pega os casos óbvios e pode ser contornado. Não substitui a moderação humana.

**Decisão (operação):**

- **Quem age sobre o conteúdo:** só o DONO remove anúncio e desativa conta. O ADMIN só marca a denúncia como resolvida ou descartada. Defina quem modera e se o ADMIN deve poder retirar anúncio e suspender conta.
- **Prazo de análise:** a Apple espera ação rápida sobre denúncias (é comum citar 24 h). Defina o prazo, escreva-o nos Termos e explique a rotina nas notas ao revisor.

**Risco:** a Apple pode considerar insuficiente a moderação só por denúncia para fotos. Nas notas ao revisor, descreva:
- o filtro de texto;
- a denúncia de anúncio e de mensagem;
- o bloqueio;
- a fila no painel;
- o prazo de resposta.

## 3. Termos de Uso e Política de Privacidade

**Situação real (19/11/2026):**

- **Política de Privacidade 2.0 em vigor, como página web:** `https://phcauto.com/politica-de-privacidade` (`POLITICA_PRIVACIDADE_VERSAO_ATUAL=2.0`, texto em `../PhcAutoRepasse/frontend/src/legal/documents.ts`).
  - Documento oficial, com versão, data de vigência, controlador, endereço oficial e sumário.
  - Descreve tudo o que o site e o app coletam: CPF/CNPJ, cadastro, anúncios, mensagens do chat, pagamentos (Cielo), localização aproximada, câmera, fotos, arquivos, token push (Expo, Google, Apple), login com Google e Apple, registros de acesso e cookies do site. Também diz o que não coletamos (biometria, contatos, microfone, identificador de publicidade, rastreamento).
  - O app mostra o endereço oficial em Menu › Privacidade; o cadastro mostra as duas versões em vigor.
  - A Política 1.1 (PDF) fica consultável em `?versao=1.1`, para o histórico de aceites.
- **Termos de Uso 2.0 em vigor, como página web:** `https://phcauto.com/termos-de-uso` (`TERMOS_USO_VERSAO_ATUAL=2.0`), no mesmo formato oficial da Política. Inclui denúncias analisadas em até 24 horas e o EULA padrão da Apple (App Store 1.2 e 5.1.1). O PDF 1.1 fica em `?versao=1.1`.

**Corrigido antes:**

- **Rotas públicas:** `/termos-de-uso` e `/politica-de-privacidade` mostram a versão que o backend declara em vigor. Se apontarem para uma minuta, a página mostra o erro em vez de apresentá-la como aprovada.
- **Links:** todos os links do app e do site (cadastro, rodapé, Privacidade) passaram a usar essas páginas.
- **Lista de empresas e prazos** (`/compliance/privacidade`):
  - Hostinger no Brasil;
  - Expo, Google e Apple incluídos;
  - Cielo também na compra de veículos;
  - token da Apple e prazo real de 190 dias do registro de acesso.

**Ainda em aberto:**

- Política: completa (CNPJ 07.593.679/0001-19 e encarregado Paulo Henrrique Campos incluídos em 19/11/2026, antes da publicação).
- Termos: CEP da sede fora do texto; quem aceitou a 1.1 não é chamado a aceitar a 2.0 (o item 2 dos Termos vale pelo aviso prévio e pelo uso continuado).

**Para as lojas:** informe `https://phcauto.com/politica-de-privacidade` como URL da política na App Store Connect e na Google Play Console. A política só aparece como página depois do deploy do site e do backend com a 2.0.

## 4. Planos (Apple 3.1.1 / 3.1.3(b))

**Risco assumido** por decisão de 18/11/2026: o app só consome planos contratados no site, sem preço, sem compra e sem link de compra.
- Pelas regras 3.1.3(b) e 3.1.3(g), recursos digitais usados no app (incluindo destaque de anúncio) deveriam também estar à venda pela compra da Apple.
- O revisor pode reprovar.
- Nada disso foi alterado nesta etapa.

## 5. Outros itens abertos no app

| Item | Situação |
| --- | --- |
| `ios.infoPlist.ITSAppUsesNonExemptEncryption` | Não definido no `app.json` (cada build pede a resposta sobre criptografia) |
| `supportsTablet: true` | Continua; o app não foi testado no iPad |
| `ACCESS_FINE_LOCATION` no Android | Continua declarado, embora a busca use precisão reduzida |
| Linha "Servidor" no Menu | Continua visível em produção |
| Diálogo de saída cita só Google | Continua (no iPhone, falta citar Apple) |
| Textos de permissão (câmera, fotos, localização) | Corrigidos em 19/11/2026; valem a partir do próximo build |
| Conta de demonstração (`MFA_ISENTOS`) | Implementado; falta criar a conta em produção e informar às lojas |

## 6. Itens de envio

- **Apple:**
  - rótulos de privacidade: nome, e-mail, telefone, CPF, endereço, localização aproximada, fotos, mensagens, compras, identificador do aparelho, token do login com Apple;
  - URL da política;
  - notas ao revisor: conta de demonstração, planos, pagamento de veículo, moderação e área administrativa restrita;
  - capturas de tela;
  - classificação etária.
- **Google:**
  - Segurança dos dados: os mesmos dados, com Cielo, Google, Apple e Expo como destinatários;
  - URL da política (ver item 3);
  - URL de exclusão `https://phcauto.com/excluir-conta`;
  - acesso ao app com a conta de demonstração;
  - declaração de permissões;
  - público-alvo 18+;
  - teste fechado, se a conta de desenvolvedor for pessoal.
