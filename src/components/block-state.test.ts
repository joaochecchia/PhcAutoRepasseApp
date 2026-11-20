/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blockControl } from './block-state.ts';

const SELLER = 'vendedor-1';

test('carregando: controle visível, sem ação', () => {
  assert.deepEqual(blockControl(SELLER, { status: 'pending', isFetching: true }), {
    kind: 'loading',
    label: 'Conferindo bloqueio…',
  });
});

test('erro: mostra o motivo e oferece tentar de novo, nunca bloquear às cegas', () => {
  const control = blockControl(SELLER, { status: 'error', isFetching: false });
  assert.equal(control.kind, 'error');
  assert.equal(control.label, 'Tentar novamente');
});

test('tentando de novo depois do erro volta a carregar', () => {
  assert.equal(blockControl(SELLER, { status: 'error', isFetching: true }).kind, 'loading');
});

test('lista carregada decide entre bloquear e desbloquear', () => {
  assert.deepEqual(blockControl(SELLER, { status: 'success', data: [], isFetching: false }), {
    kind: 'ready',
    blocked: false,
    label: 'Bloquear anunciante',
    next: true,
  });
  assert.deepEqual(blockControl(SELLER, { status: 'success', data: [{ usuarioId: SELLER }], isFetching: false }), {
    kind: 'ready',
    blocked: true,
    label: 'Anunciante bloqueado · Desbloquear',
    next: false,
  });
});
