import { useEffect, useRef } from 'react';

import { announceApi, type FipeReference } from '@/api/announce';
import { formatCents } from '@/utils/format';

/** No cadastro a referência chega sem o valor; a mensagem só cita o preço quando ele existe. */
const priceSuffix = (reference: FipeReference) =>
  reference.valorCentavos == null ? '' : `: ${formatCents(reference.valorCentavos)}`;

type Options = {
  condicao: string;
  anoModelo: string;
  /** Marca e modelo: a referência guardada só volta se o veículo for o mesmo. */
  veiculo: string;
  reference: FipeReference | null;
  onReference: (reference: FipeReference | null) => void;
  onNotice: (message: string) => void;
};

/**
 * A FIPE cota zero km separado do usado. Quando a condição deixa de bater com a referência escolhida, pede ao
 * servidor a mesma versão na cotação certa (zero km, ou usado do ano do modelo), como no site. Sem essa cotação, a
 * referência sai com aviso e fica guardada: se a condição voltar a bater, com o mesmo veículo e ano, ela volta sem
 * nova consulta. Devolve true enquanto consulta.
 */
export function useFipeConditionSync({ condicao, anoModelo, veiculo, reference, onReference, onNotice }: Options) {
  const callbacks = useRef({ onReference, onNotice });
  useEffect(() => {
    callbacks.current = { onReference, onNotice };
  });
  const zeroKm = condicao === 'ZERO_KM';
  // Repasse e seminovo usam a mesma cotação de usado; a mensagem mostra a condição escolhida.
  const label = zeroKm ? 'zero km' : condicao === 'REPASSE' ? 'repasse' : 'seminovo';
  const needsSwitch = Boolean(reference && condicao && reference.zeroKm !== zeroKm);
  const identity = `${veiculo}|${anoModelo}`;
  // Consulta em andamento: a troca é necessária e possível. Ela termina trocando a referência ou tirando-a (guardada).
  const syncing = needsSwitch && (zeroKm || Number(anoModelo) > 1885);
  const parked = useRef<{ reference: FipeReference; identity: string } | null>(null);

  useEffect(() => {
    if (reference) {
      parked.current = null;
      return;
    }
    const saved = parked.current;
    if (!saved || !condicao || saved.identity !== identity || saved.reference.zeroKm !== zeroKm) return;
    parked.current = null;
    callbacks.current.onReference(saved.reference);
    callbacks.current.onNotice(
      `Referência FIPE ${zeroKm ? label : `de ${label} ${saved.reference.anoModelo}`} de volta${priceSuffix(saved.reference)}.`,
    );
  }, [reference, identity, condicao, zeroKm, label]);

  useEffect(() => {
    if (!reference || !needsSwitch) return;
    const park = () => {
      parked.current = { reference, identity };
      callbacks.current.onReference(null);
    };
    const ano = Number(anoModelo);
    if (!zeroKm && !(ano > 1885)) {
      park();
      callbacks.current.onNotice(`Informe o ano do modelo para vincular a FIPE de ${label}.`);
      return;
    }
    const controller = new AbortController();
    announceApi
      .fipeEquivalent({ referenciaId: reference.id, zeroKm, anoModelo: zeroKm ? null : ano }, controller.signal)
      .then((equivalent) => {
        if (controller.signal.aborted) return;
        callbacks.current.onReference(equivalent);
        callbacks.current.onNotice(
          `Referência FIPE trocada para a cotação ${zeroKm ? label : `de ${label} ${ano}`}${priceSuffix(equivalent)}.`,
        );
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        park();
        const detail = reason instanceof Error ? reason.message : 'Não foi possível buscar a cotação FIPE equivalente';
        callbacks.current.onNotice(`${detail.replace(/\.$/, '')}. Escolha a versão na FIPE de novo para vincular.`);
      });
    return () => controller.abort();
    // A referência entra pelo id: trocar pela equivalente não deve disparar outra consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference?.id, needsSwitch, zeroKm, anoModelo]);

  return syncing;
}
