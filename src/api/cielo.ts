import type { CardSession } from './plans';

/**
 * Integração do aparelho com a Cielo, como `lib/cieloCard.ts` do site: o número do cartão vai do app direto para a
 * Cielo e nunca passa pelo backend da PHC Auto, que só emite credenciais temporárias (sessão de cartão).
 */
export class CardFlowError extends Error {}

export type CardInput = {
  holder: string;
  number: string;
  /** MM/AAAA */
  expiration: string;
  cvv: string;
  type: 'creditCard' | 'debitCard';
};

const form = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

/** Silent Order Post: troca os dados do cartão por um PaymentToken de uso único (20 min). */
export async function tokenizeCard(session: CardSession['tokenizacao'], card: CardInput) {
  let response: Response;
  try {
    response = await fetch(session.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form({
        HolderName: card.holder,
        RawNumber: card.number,
        Expiration: card.expiration,
        SecurityCode: card.cvv,
        CardType: card.type,
        AccessToken: session.accessToken,
      }),
      credentials: 'omit',
    });
  } catch {
    throw new CardFlowError('Não foi possível falar com a Cielo. Confira a internet e tente de novo.');
  }
  if (response.status === 201) {
    const data = (await response.json().catch(() => ({}))) as { PaymentToken?: string };
    if (data.PaymentToken) return data.PaymentToken;
  }
  if (response.status === 400) throw new CardFlowError('A Cielo não aceitou os dados do cartão. Confira número, validade e CVV.');
  throw new CardFlowError('Não foi possível proteger os dados do cartão. Tente de novo.');
}

export type ThreeDsInput = {
  number: string;
  month: string;
  year: string;
  amountCents: number;
  method: 'Credit' | 'Debit';
  installments: number;
};

/** Mensagem que a página da confirmação do banco manda ao app. */
export type ThreeDsMessage =
  | { type: 'success'; cavv: string | null; xid: string | null; eci: string | null; versao: string | null; referenceId: string | null }
  | { type: 'failure' | 'unenrolled' | 'disabled' | 'error' | 'unsupported' | 'script' };

/** Valor seguro dentro de <script>: JSON sem fechar a tag. */
const inline = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * Página da autenticação 3DS 2 (script MPI da Cielo), aberta numa WebView com a URL da loja como origem: o firewall
 * do MPI recusa outras origens. O script lê os campos pelas classes "bpmpi_*"; se o banco pedir desafio, ele mesmo
 * mostra a tela do emissor nesta página. O resultado volta ao app por postMessage.
 */
export function threeDsPage(session: NonNullable<CardSession['autenticacao3ds']>, input: ThreeDsInput) {
  const buyer = session.comprador;
  const digits = (value: string | null) => (value ?? '').replace(/\D/g, '');
  const fields: Record<string, string> = {
    bpmpi_auth: 'true',
    bpmpi_auth_notifyonly: 'false',
    bpmpi_accesstoken: session.accessToken,
    bpmpi_ordernumber: session.pedido,
    bpmpi_currency: 'BRL',
    bpmpi_totalamount: String(input.amountCents),
    bpmpi_installments: String(input.installments),
    bpmpi_paymentmethod: input.method,
    bpmpi_cardnumber: input.number,
    bpmpi_cardexpirationmonth: input.month,
    bpmpi_cardexpirationyear: input.year,
    bpmpi_transaction_mode: 'S',
    bpmpi_merchant_url: session.urlLoja ?? '',
    bpmpi_billto_customerid: digits(buyer.documento),
    bpmpi_billto_contactname: buyer.nome ?? '',
    bpmpi_billto_email: buyer.email ?? '',
    bpmpi_billto_phonenumber: digits(buyer.telefone),
    bpmpi_billto_street1: buyer.rua ?? '',
    bpmpi_billto_city: buyer.cidade ?? '',
    bpmpi_billto_state: buyer.uf ?? '',
    bpmpi_billto_zipcode: digits(buyer.cep),
    bpmpi_billto_country: 'BR',
    bpmpi_device_ipaddress: session.ip ?? '',
  };
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font-family:-apple-system,Roboto,sans-serif;background:#fff;color:#252527}</style></head>
<body><div id="phc-bpmpi" hidden></div>
<script>
(function () {
  var fields = ${inline(fields)};
  var root = document.getElementById('phc-bpmpi');
  Object.keys(fields).forEach(function (name) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.className = name;
    input.value = fields[name];
    root.appendChild(input);
  });
  var done = false;
  function send(message) {
    if (done) return;
    done = true;
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  window.bpmpi_config = function () {
    return {
      Environment: ${inline(session.ambiente)},
      Debug: false,
      onReady: function () { if (window.bpmpi_authenticate) window.bpmpi_authenticate(); },
      onSuccess: function (e) {
        send({ type: 'success', cavv: e.Cavv || null, xid: e.Xid || null, eci: e.Eci || null,
          versao: e.Version || null, referenceId: e.ReferenceId || null });
      },
      onFailure: function () { send({ type: 'failure' }); },
      onUnenrolled: function () { send({ type: 'unenrolled' }); },
      onDisabled: function () { send({ type: 'disabled' }); },
      onError: function () { send({ type: 'error' }); },
      onUnsupportedBrand: function () { send({ type: 'unsupported' }); }
    };
  };
  var script = document.createElement('script');
  script.src = ${inline(session.scriptUrl)};
  script.async = true;
  script.onerror = function () { send({ type: 'script' }); };
  document.body.appendChild(script);
})();
</script></body></html>`;
}

const messages: Record<Exclude<ThreeDsMessage['type'], 'success'>, string> = {
  failure: 'Seu banco não confirmou a compra. Tente de novo ou use outro cartão.',
  unenrolled: 'Este cartão não está habilitado para compras online no débito. Fale com seu banco ou use o Pix.',
  disabled: 'A confirmação do banco está desativada. Tente de novo mais tarde.',
  error: 'Não foi possível falar com seu banco agora. Tente de novo ou use o Pix.',
  unsupported: 'A bandeira deste cartão não aceita débito online. Use Visa, Mastercard ou Elo.',
  script: 'Não foi possível carregar a verificação do banco. Tente de novo.',
};

/**
 * Regra do site: no débito a autenticação é obrigatória e qualquer insucesso encerra o pagamento. No crédito, cartão
 * não habilitado, bandeira sem suporte ou falha técnica seguem sem 3DS (null); só a recusa do banco interrompe.
 */
export function threeDsOutcome(message: ThreeDsMessage, credit: boolean) {
  if (message.type === 'success') {
    return {
      cavv: message.cavv,
      xid: message.xid,
      eci: Number(message.eci),
      versao: message.versao ?? '2',
      referenceId: message.referenceId,
    };
  }
  if (credit && message.type !== 'failure') return null;
  throw new CardFlowError(messages[message.type]);
}
