import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { FipeReference, UploadFile } from '@/api/announce';

/**
 * Rascunho do cadastro de anúncio guardado no aparelho, para não perder o preenchimento se o app fechar, o sistema
 * encerrá-lo em segundo plano ou a conexão cair. Fica só no aparelho (nada vai ao servidor), separado por conta, e
 * some ao criar o anúncio, ao escolher "Começar do zero", ao sair da conta ou depois de 30 dias.
 *
 * Os campos vão num JSON e as fotos, o vídeo e os laudos são copiados para a pasta de documentos do app: os arquivos
 * originais ficam no cache, que o sistema pode limpar. Os caminhos são guardados relativos à pasta, porque no iOS o
 * caminho absoluto do app muda a cada atualização.
 *
 * Nunca entram aqui: placa (do veículo e dos carros do lote) e rua, número e complemento do endereço, que o app não
 * mostra na vitrine e identificam a pessoa (a pasta de documentos entra no backup do aparelho). Senha, tokens, CPF,
 * e-mail e telefone não fazem parte do cadastro do anúncio; a sessão continua só no expo-secure-store.
 */

const VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Na web (só para conferir telas em desenvolvimento) não há rascunho.
const supported = Platform.OS !== 'web';

export type DraftLotUnit = { key: string; cor: string; placa: string; quilometragem: string; laudo: UploadFile | null };

export type AnnounceDraftData = {
  stage: number;
  furthest: number;
  values: Record<string, string>;
  motors: Record<string, string>[];
  photos: { file: UploadFile; alt: string }[];
  lotMode: boolean;
  lotUnits: DraftLotUnit[];
  existing: string[];
  video: UploadFile | null;
  videoNotice: string;
  report: UploadFile | null;
  reference: FipeReference | null;
};

export type AnnounceDraft = AnnounceDraftData & { savedAt: number };

export type SaveResult = 'saved' | 'stale' | 'failed';

type StoredFile = { name: string; type: string; file: string };
type Stored = Omit<AnnounceDraftData, 'photos' | 'lotUnits' | 'video' | 'report'> & {
  versao: typeof VERSION;
  savedAt: number;
  photos: { file: StoredFile; alt: string }[];
  lotUnits: (Omit<DraftLotUnit, 'laudo'> & { laudo: StoredFile | null })[];
  video: StoredFile | null;
  report: StoredFile | null;
};

/** Campos privados que não ficam no aparelho (ver o comentário do arquivo). */
export function isPrivateDraftField(key: string) {
  return key === 'placa' || key.endsWith('.placa') || /^endereco\.(rua|numero|complemento)$/.test(key);
}

const root = () => new Directory(Paths.document, 'anuncio-rascunho');
const folder = (usuarioId: string) => new Directory(root(), usuarioId.replace(/[^\w-]/g, '_'));
const mediaFolder = (usuarioId: string) => new Directory(folder(usuarioId), 'midias');
const draftFile = (usuarioId: string) => new File(folder(usuarioId), 'rascunho.json');

/**
 * Sobe a cada descarte: um formulário ainda aberto depois de "Começar do zero" (ou de enviado) não regrava o
 * rascunho antigo. Quem salva guarda a época em que abriu e só grava enquanto ela for a atual.
 */
let epoch = 0;
export const draftEpoch = () => epoch;

/** Leituras e gravações em fila: a limpeza de arquivos de uma gravação nunca corre junto com outra. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

/** Arquivo original já copiado nesta sessão: não copia de novo a cada gravação. */
const copied = new Map<string, string>();

function sameFolder(uri: string, directory: Directory) {
  const base = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  return uri.startsWith(base) ? uri.slice(base.length) : null;
}

async function persist(file: UploadFile, media: Directory): Promise<string> {
  const inside = sameFolder(file.uri, media);
  if (inside) return inside;
  const known = copied.get(file.uri);
  if (known && new File(media, known).exists) return known;
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  await new File(file.uri).copy(new File(media, name));
  copied.set(file.uri, name);
  return name;
}

function removeFolder(directory: Directory) {
  try {
    if (directory.exists) directory.delete();
  } catch {
    // Nada a apagar.
  }
}

export function loadDraft(usuarioId: string): Promise<AnnounceDraft | null> {
  if (!supported) return Promise.resolve(null);
  return serial(async () => {
    try {
      const file = draftFile(usuarioId);
      if (!file.exists) return null;
      const stored = JSON.parse(await file.text()) as Stored;
      if (stored?.versao !== VERSION || !stored.values || Date.now() - stored.savedAt > MAX_AGE_MS) {
        removeFolder(folder(usuarioId));
        return null;
      }
      const media = mediaFolder(usuarioId);
      // Arquivo que sumiu do aparelho sai do rascunho; os campos continuam.
      const restore = (entry: StoredFile | null): UploadFile | null => {
        if (!entry) return null;
        const local = new File(media, entry.file);
        return local.exists ? { uri: local.uri, name: entry.name, type: entry.type } : null;
      };
      return {
        ...stored,
        photos: stored.photos.flatMap((photo) => {
          const restored = restore(photo.file);
          return restored ? [{ file: restored, alt: photo.alt }] : [];
        }),
        lotUnits: stored.lotUnits.map((unit) => ({ ...unit, laudo: restore(unit.laudo) })),
        video: restore(stored.video),
        report: restore(stored.report),
      };
    } catch {
      return null;
    }
  });
}

export function saveDraft(usuarioId: string, data: AnnounceDraftData, since: number): Promise<SaveResult> {
  if (!supported) return Promise.resolve('failed');
  return serial(async () => {
    if (since !== epoch) return 'stale';
    try {
      const media = mediaFolder(usuarioId);
      if (!media.exists) media.create({ intermediates: true });
      const kept = new Set<string>();
      let complete = true;
      const store = async (file: UploadFile | null): Promise<StoredFile | null> => {
        if (!file) return null;
        try {
          const name = await persist(file, media);
          kept.add(name);
          return { name: file.name, type: file.type, file: name };
        } catch {
          // Arquivo que não pôde ser copiado (ex.: sem espaço): o resto do rascunho continua salvo.
          complete = false;
          return null;
        }
      };
      const photos: Stored['photos'] = [];
      for (const photo of data.photos) {
        const file = await store(photo.file);
        if (file) photos.push({ file, alt: photo.alt });
      }
      const lotUnits: Stored['lotUnits'] = [];
      for (const unit of data.lotUnits) lotUnits.push({ ...unit, placa: '', laudo: await store(unit.laudo) });
      const stored: Stored = {
        ...data,
        values: Object.fromEntries(Object.entries(data.values).filter(([key]) => !isPrivateDraftField(key))),
        versao: VERSION,
        savedAt: Date.now(),
        photos,
        lotUnits,
        video: await store(data.video),
        report: await store(data.report),
      };
      // "Começar do zero" pode ter chegado durante as cópias.
      if (since !== epoch) return 'stale';
      await draftFile(usuarioId).write(JSON.stringify(stored));
      for (const entry of media.list()) {
        if (entry instanceof File && !kept.has(entry.name)) entry.delete();
      }
      return complete ? 'saved' : 'failed';
    } catch {
      return 'failed';
    }
  });
}

/** Apaga o rascunho sem invalidar o formulário aberto (ex.: a pessoa esvaziou todos os campos). */
export function removeDraft(usuarioId: string) {
  if (!supported) return Promise.resolve();
  return serial(async () => removeFolder(folder(usuarioId)));
}

/** Descarta de vez: "Começar do zero" ou anúncio enviado. */
export function discardDraft(usuarioId: string) {
  epoch += 1;
  return removeDraft(usuarioId);
}

/** Saída da conta: nenhum rascunho fica no aparelho. */
export function discardAllDrafts() {
  epoch += 1;
  if (!supported) return Promise.resolve();
  return serial(async () => removeFolder(root()));
}

/** Nome curto do veículo do rascunho, para o aviso ao abrir "Anunciar". */
export function draftVehicleName(values: Record<string, string>) {
  const name = [values.fabricante, values.modelo].map((part) => (part || '').trim()).filter(Boolean).join(' ');
  const year = (values.anoModelo || '').trim();
  if (name) return year ? `${name} ${year}` : name;
  if ((values.titulo || '').trim()) return values.titulo.trim();
  return 'veículo ainda sem marca e modelo';
}

export function savedAtLabel(savedAt: number) {
  const date = new Date(savedAt);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `hoje às ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `ontem às ${time}`;
  return `em ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`;
}
