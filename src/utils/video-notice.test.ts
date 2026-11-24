/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { videoSentMessage, videoTrimNotice } from './video-notice.ts';

test('vídeo dentro do limite (com folga de meio segundo) não gera aviso', () => {
  assert.equal(videoTrimNotice(30_400, 30), '');
  assert.equal(videoTrimNotice(null, 30), '');
  assert.equal(videoTrimNotice(45_000, undefined), '');
});

test('vídeo longo avisa o corte em vez de recusar', () => {
  assert.equal(videoTrimNotice(47_200, 30), 'O vídeo tem 47 s: só os primeiros 30 s serão usados.');
});

test('mensagem do envio cita o corte só quando o servidor cortou', () => {
  assert.equal(videoSentMessage('lote', false), 'Vídeo recebido. Ele aparece no lote depois da compressão.');
  assert.match(videoSentMessage('anúncio', true), /cortado nos primeiros 30 segundos\. Ele aparece no anúncio/);
});
