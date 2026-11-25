/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { videoFailed, videoPending, videoSentMessage, videoStatusText, videoTrimNotice } from './video-notice.ts';

test('vídeo dentro do limite (com folga de meio segundo) não gera aviso', () => {
  assert.equal(videoTrimNotice(30_400, 30), '');
  assert.equal(videoTrimNotice(null, 30), '');
  assert.equal(videoTrimNotice(45_000, undefined), '');
});

test('vídeo longo avisa o corte em vez de recusar', () => {
  assert.equal(videoTrimNotice(47_200, 30), 'O vídeo tem 47 s: só os primeiros 30 s serão usados.');
});

test('mensagem do envio cita o corte só quando o servidor cortou', () => {
  assert.equal(videoSentMessage('lote', false), 'Vídeo recebido. Ele aparece no lote depois da compressão e da análise.');
  assert.match(videoSentMessage('anúncio', true), /cortado nos primeiros 30 segundos\. Ele aparece no anúncio/);
});

test('compressão e análise ficam pendentes; recusa e falha pedem outro vídeo', () => {
  assert.equal(videoPending('PROCESSANDO'), true);
  assert.equal(videoPending('MODERANDO'), true);
  assert.equal(videoPending('PRONTO'), false);
  assert.equal(videoFailed('REJEITADO'), true);
  assert.equal(videoFailed('FALHOU'), true);
  assert.equal(videoFailed('MODERANDO'), false);
});

test('recusa mostra o motivo do servidor e o vídeo pronto mostra os dados', () => {
  const placa = 'O vídeo mostra a placa do veículo e não foi publicado.';
  assert.equal(videoStatusText({ status: 'REJEITADO', mensagemErro: placa }, 'anúncio', ''), `Vídeo recusado. ${placa}`);
  assert.match(videoStatusText({ status: 'MODERANDO', mensagemErro: null }, 'lote', ''), /^Em análise/);
  assert.equal(videoStatusText({ status: 'PRONTO', mensagemErro: null }, 'lote', '30s · 4 MB'), '30s · 4 MB');
});
