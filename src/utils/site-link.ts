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

const sitePath = (link: string) => (link.startsWith(SITE) ? link.slice(SITE.length) || '/' : link);

/**
 * Link para a página de planos do site (onde se contrata). O app é só de consumo dos planos: banner que leva para lá
 * é convite de compra fora da loja e não aparece no app (App Store 3.1.1 e Google Play Pagamentos).
 */
export function leadsToPlans(link: string | null | undefined) {
  return Boolean(link && /^\/planos(?:[/?#]|$)/.test(sitePath(link.trim())));
}

/** Abre um link vindo do backend (banner, aviso): rota do app quando existir, senão o navegador. */
export function openSiteLink(link: string) {
  const path = sitePath(link);
  if (path.startsWith('/') && appRoutes.some((pattern) => pattern.test(path))) {
    router.push(path as Href);
    return;
  }
  WebBrowser.openBrowserAsync(path.startsWith('/') ? `${SITE}${path}` : link);
}
