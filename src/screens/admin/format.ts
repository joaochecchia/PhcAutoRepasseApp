const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const integer = new Intl.NumberFormat('pt-BR');

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : '—');
export const formatClock = (iso: string) => clock.format(new Date(iso));
export const formatInteger = (value: number) => integer.format(value);

/** "agora", "há 5 min", "há 3 h" ou a data. */
export function ago(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.round(minutes / 60)} h`;
  return dateOnly.format(new Date(iso));
}

export function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1).replace('.', ',')} h`;
}

export const roleLabels: Record<string, string> = {
  CLIENTE: 'Cliente',
  ADMIN: 'Admin',
  DONO: 'Dono',
  ANUNCIANTE: 'Anunciante',
  OPERADOR: 'Operador',
};

export function formatDocument(value: string | null) {
  if (!value) return '—';
  if (value.length === 11) return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (value.length === 14) return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value;
}
