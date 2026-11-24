/** Textos do vídeo do anúncio e do lote (AdMedia do site). O servidor corta o vídeo longo; o app não recusa mais. */
export const trimmedVideoMessage = 'O vídeo tinha mais de 30 segundos e foi cortado nos primeiros 30 segundos.';
export const plateVideoWarning = 'O vídeo aparece após a compressão.';

/** Aviso (não erro) antes do envio: o vídeo longo vai ser cortado nos primeiros segundos pelo servidor. */
export function videoTrimNotice(durationMs: number | null | undefined, maxSeconds: number | undefined) {
  if (durationMs == null || maxSeconds == null) return '';
  const seconds = durationMs / 1000;
  if (seconds <= maxSeconds + 0.5) return '';
  return `O vídeo tem ${Math.round(seconds)} s: só os primeiros ${maxSeconds} s serão usados.`;
}

/** Mensagem depois do envio, com o corte quando houve. */
export function videoSentMessage(where: 'anúncio' | 'lote', cut: boolean | undefined) {
  return `Vídeo recebido.${cut ? ` ${trimmedVideoMessage}` : ''} Ele aparece no ${where} depois da compressão.`;
}
