# PHC Auto — app mobile

App iOS e Android do PHC Auto Repasse, feito com Expo (SDK 58) e React Native. Usa o mesmo backend do site [phcauto.com](https://phcauto.com).

## Rodar

1. Suba o backend local (repositório do site):

   ```bash
   cd ../PhcAutoRepasse/backend
   docker compose up -d
   ```

   Para o **celular** alcançar o backend, ele precisa escutar na rede local:

   ```bash
   BACKEND_BIND=0.0.0.0 docker compose up -d
   ```

2. Instale e inicie o app:

   ```bash
   npm install
   npx expo start
   ```

3. Abra o **Expo Go** no celular (mesma rede Wi-Fi do computador) e leia o QR code.

O app descobre sozinho o endereço do backend: usa o IP do computador que serve o Metro, na porta 8080. Para apontar para outro servidor, crie um `.env` a partir do `.env.example`:

```bash
EXPO_PUBLIC_API_URL=https://phcauto.com
```

O endereço em uso e se o servidor está no ar aparecem em **Menu › Sobre › Servidor**.

## Verificar

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## Estado do protótipo

Funciona com dados reais da API:

- Abertura animada com a logo, barra inferior com **Anunciar** em destaque.
- Início: busca, banner (preparado para anunciantes), números da plataforma, tipos de veículo, vitrine com abas (Vitrine PHC, Zero km, Seminovo, Repasse, Vendidos), faixas de preço e recém-chegados.
- Busca com texto, filtros (tipo, condição, preço, ordenação) e rolagem infinita.
- Detalhe do anúncio: galeria, ficha técnica, FIPE, vendedor, compartilhar.
- Favoritos (de visitante, na memória) e tema claro/escuro.

Ainda não: login, anúncio, mensagens, planos, compras e painel administrativo. Esses itens aparecem no Menu e respondem com "em breve". O que falta está mapeado na skill `.claude/skills/phc-app-paridade`.

Orientações para quem desenvolve: [AGENTS.md](AGENTS.md).
