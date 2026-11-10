---
name: phc-app-mobile
description: Convenções do app mobile PHC Auto (Expo + React Native + TypeScript, Expo Router, Expo Go, pt-BR). Use em qualquer tarefa deste repositório - criar ou alterar telas, componentes, rotas, dependências, configuração do Expo ou a estrutura do projeto.
---

# App mobile — PHC Auto

Contexto completo em `AGENTS.md`. Esta skill resume como trabalhar no código. Para API use `phc-app-api`, para visual use `phc-app-design`, para saber o que falta construir use `phc-app-paridade`.

## Antes de escrever código

1. Carregue `expo-overview` e a skill Expo da área (ela aponta qual).
2. Leia a tela equivalente do site em `../PhcAutoRepasse/frontend/src/pages/` para entender o fluxo, os estados e as chamadas. Copie o comportamento, não o layout.
3. Confira a versão do SDK em `package.json` e use a documentação dessa versão.

## Criação do projeto (uma vez)

```bash
npx create-expo-app@latest . --template default
```

Depois organize conforme `expo-project-structure` (código em `src/`, alias `@/*`). Preserve `AGENTS.md`, `CLAUDE.md`, `.claude/` e `assets/images/`.

## Regras de código

- TypeScript estrito, sem `any` em contratos da API.
- `src/app` contém só rotas; o corpo da tela fica em `src/screens`.
- Componentes funcionais, um export nomeado por arquivo, nomes de arquivo em kebab-case.
- Dados do servidor passam pelo TanStack Query. Não guarde resposta de API em `useState`.
- Formulários controlados. Campo dependente limpa os seguintes quando o anterior muda (marca → modelo → versão).
- Listas longas usam `FlatList` ou FlashList, nunca `ScrollView` com `map`.
- Imagens com `expo-image`, sempre com proporção definida para não haver salto de layout.
- Respeite a área segura e o teclado em toda tela.
- Cores, espaçamentos, raios e durações vêm de `src/theme.ts`. Não fixe valores na tela.
- Valores em reais viram centavos só na camada `src/api`, como no site.

## Expo Go

O app precisa abrir no Expo Go. Antes de instalar uma biblioteca com código nativo, confirme que ela vem no Expo Go do SDK em uso. Se não vier, pare e apresente ao usuário a alternativa compatível e o custo de migrar para build de desenvolvimento.

## Validação

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
npx expo start
```

Abra a tela alterada no aparelho ou emulador, em tema claro e escuro, e passe pelos estados de carregando, vazio e erro. Animação só conta como verificada num aparelho real. Relate o que foi e o que não foi verificado, e remova imports sem uso e logs de depuração.
