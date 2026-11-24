import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from './useDebouncedValue';
import type { Paginated } from '../lib/types';

export interface SearchOption {
  value: number;
  label: string;
}

/**
 * Opções de um SelectField buscadas na API pelo termo digitado. Sem isso o
 * seletor mostra só a primeira página (a API limita a 100 registros).
 */
export function useOptionSearch<T>({
  queryKey,
  fetch,
  toOption,
  pinned,
  enabled = true,
}: {
  queryKey: unknown[];
  fetch: (search: string | undefined) => Promise<Paginated<T>>;
  toOption: (item: T) => SearchOption;
  /** Valor atual em edição, que pode estar fora dos resultados (ou inativo). */
  pinned?: SearchOption | null;
  enabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search).trim();
  const baseKey = [...queryKey, 'options'];
  const query = useQuery({
    queryKey: [...baseKey, term],
    queryFn: () => fetch(term || undefined),
    enabled,
    // Mantém a lista enquanto o termo muda, mas não entre filtros diferentes
    // (ex.: veículos de outro cliente).
    placeholderData: (prev, prevQuery) =>
      JSON.stringify(prevQuery?.queryKey.slice(0, -1)) ===
      JSON.stringify(baseKey)
        ? prev
        : undefined,
  });

  const results = query.data?.data.map(toOption) ?? [];
  const options =
    pinned && !results.some((o) => o.value === pinned.value)
      ? [pinned, ...results]
      : results;

  return { options, onSearch: setSearch, isLoading: query.isLoading };
}
