export function formatBRL(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(num) ? num : 0);
}

export function formatQuantidade(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(Number.isFinite(num) ? num : 0);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}

/**
 * Data de `<input type="date">` para a API: vazio vira ausente (a API rejeita '')
 * e o dia vai ao meio-dia, para a meia-noite UTC não exibir o dia anterior no Brasil.
 */
export function toApiDate(value?: string): string | undefined {
  return value ? `${value}T12:00:00` : undefined;
}
