import * as WebBrowser from 'expo-web-browser';
import { router, type Href } from 'expo-router';

const SITE = 'https://phcauto.com';

/** Caminhos do site que têm tela no app. O resto abre no navegador. */
const appRoutes: RegExp[] = [
  /^\/$/,
  /^\/buscar(\?.*)?$/,
  /^\/anunciar$/,
  /^\/anuncio\/[0-9a-f-]{36}$/i,
  /^\/lote\/[0-9a-f-]{36}$/i,
  /^\/loja\/[a-z0-9-]+$/,
  /^\/lojistas$/,
  /^\/patio$/,
  /^\/planos$/,
  /^\/tabela-fipe$/,
  /^\/privacidade$/,
  /^\/meus-anuncios$/,
  /^\/mensagens$/,
];

/** Abre um link vindo do backend (banner, aviso): rota do app quando existir, senão o navegador. */
export function openSiteLink(link: string) {
  let path = link;
  if (link.startsWith(SITE)) path = link.slice(SITE.length) || '/';
  if (path.startsWith('/') && appRoutes.some((pattern) => pattern.test(path))) {
    router.push(path as Href);
    return;
  }
  WebBrowser.openBrowserAsync(path.startsWith('/') ? `${SITE}${path}` : link);
}
