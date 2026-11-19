/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppleStepError, deletionGate, deletionOutcome, isAppleStepError } from './deletion-flow.ts';

test('perfil carregando ou com erro nunca libera a exclusão', () => {
  assert.deepEqual(deletionGate('ios', { status: 'pending' }), { kind: 'loading' });
  assert.deepEqual(deletionGate('ios', { status: 'error' }), { kind: 'error' });
  // Falha sem dados: antes virava "não é conta Apple" e excluía sem revogar.
  assert.deepEqual(deletionGate('android', { status: 'error' }), { kind: 'error' });
  assert.deepEqual(deletionGate('ios', { status: 'success' }), { kind: 'error' });
});

test('no iPhone, conta Apple sem token guardado pede a confirmação da Apple', () => {
  assert.deepEqual(deletionGate('ios', { status: 'success', data: { contaApple: true, appleRevogavel: false } }), {
    kind: 'ready',
    appleAccount: true,
    appleRevocable: false,
    appleConfirmation: true,
  });
  assert.deepEqual(deletionGate('ios', { status: 'success', data: { contaApple: true } }), {
    kind: 'ready',
    appleAccount: true,
    appleRevocable: false,
    appleConfirmation: true,
  });
});

test('com token guardado, ou fora do iPhone, não pede a folha da Apple', () => {
  assert.deepEqual(deletionGate('ios', { status: 'success', data: { contaApple: true, appleRevogavel: true } }), {
    kind: 'ready',
    appleAccount: true,
    appleRevocable: true,
    appleConfirmation: false,
  });
  assert.deepEqual(deletionGate('android', { status: 'success', data: { contaApple: true, appleRevogavel: false } }), {
    kind: 'ready',
    appleAccount: true,
    appleRevocable: false,
    appleConfirmation: false,
  });
  assert.deepEqual(deletionGate('ios', { status: 'success', data: { contaApple: false, appleRevogavel: true } }), {
    kind: 'ready',
    appleAccount: false,
    appleRevocable: false,
    appleConfirmation: false,
  });
});

test('erros da etapa da Apple são reconhecidos, os outros não', () => {
  assert.equal(isAppleStepError(new AppleStepError('cancelou')), true);
  assert.equal(isAppleStepError({ body: { title: 'Outra conta Apple' } }), true);
  assert.equal(isAppleStepError({ body: { title: 'Apple indisponível' } }), true);
  assert.equal(isAppleStepError({ body: { title: 'Senha incorreta' } }), false);
  assert.equal(isAppleStepError(new Error('rede')), false);
  assert.equal(isAppleStepError(null), false);
});

test('mensagem final só fala em revogação confirmada pela Apple', () => {
  assert.equal(deletionOutcome('REVOGADA').appleHelp, false);
  assert.doesNotMatch(deletionOutcome('NAO_SE_APLICA').message, /Apple/);
  assert.match(deletionOutcome('PENDENTE').message, /automaticamente/);
  const semToken = deletionOutcome('SEM_TOKEN');
  assert.equal(semToken.appleHelp, true);
  assert.match(semToken.message, /Iniciar sessão com a Apple/);
});
