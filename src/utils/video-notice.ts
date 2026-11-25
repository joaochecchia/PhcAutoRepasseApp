/**
 * Textos do vídeo do anúncio e do lote (AdMedia do site). O servidor corta o vídeo longo (o app não recusa mais) e,
 * depois da compressão, analisa o vídeo: placa visível ou conteúdo sexual recusam (MODERANDO → PRONTO ou REJEITADO).
 */
export const trimmedVideoMessage = 'O vídeo tinha mais de 30 segundos e foi cortado nos primeiros 30 segundos.';
export const plateVideoWarning = 'Não mostre a placa: vídeo em que a placa aparece é recusado.';

/** Aviso (não erro) antes do envio: o vídeo longo vai ser cortado nos primeiros segundos pelo servidor. */
export function videoTrimNotice(durationMs: number | null | undefined, maxSeconds: number | undefined) {
  if (durationMs == null || maxSeconds == null) return '';
  const seconds = durationMs / 1000;
  if (seconds <= maxSeconds + 0.5) return '';
  return `O vídeo tem ${Math.round(seconds)} s: só os primeiros ${maxSeconds} s serão usados.`;
}

/** Mensagem depois do envio, com o corte quando houve. */
export function videoSentMessage(where: 'anúncio' | 'lote', cut: boolean | undefined) {
  return `Vídeo recebido.${cut ? ` ${trimmedVideoMessage}` : ''} Ele aparece no ${where} depois da compressão e da análise.`;
}

export type VideoStatus = 'PROCESSANDO' | 'MODERANDO' | 'PRONTO' | 'REJEITADO' | 'FALHOU';

/** Vídeo ainda no servidor (compressão ou análise): a tela consulta de novo até o resultado. */
export function videoPending(status: VideoStatus | null | undefined) {
  return status === 'PROCESSANDO' || status === 'MODERANDO';
}

/** Vídeo que não vai aparecer (recusado ou com erro na compressão): texto em vermelho e pedido para enviar outro. */
export function videoFailed(status: VideoStatus | null | undefined) {
  return status === 'REJEITADO' || status === 'FALHOU';
}

/**
 * Situação do vídeo já enviado, para o dono. {@code ready} é o texto do vídeo pronto (nome, tamanho, duração).
 * Recusado traz o motivo do servidor (placa ou conteúdo impróprio).
 */
export function videoStatusText(
  video: { status: VideoStatus; mensagemErro: string | null },
  where: 'anúncio' | 'lote',
  ready: string,
) {
  switch (video.status) {
    case 'PROCESSANDO':
      return `Comprimindo o vídeo em HD. Depois ele passa por uma análise rápida e aparece no ${where}; você pode sair desta tela.`;
    case 'MODERANDO':
      return 'Em análise: conferimos se o vídeo mostra a placa ou conteúdo impróprio. Leva cerca de 30 segundos. Você pode publicar e sair: avisamos nas notificações quando terminar.';
    case 'REJEITADO':
      return `Vídeo recusado. ${video.mensagemErro || 'Envie outro vídeo do veículo.'}`;
    case 'FALHOU':
      return `${video.mensagemErro || 'Não foi possível processar o vídeo.'} Envie outro vídeo.`;
    default:
      return ready;
  }
}
