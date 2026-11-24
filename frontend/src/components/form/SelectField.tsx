import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type SelectHTMLAttributes,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconCheck, IconChevronDown } from '../icons';
import { FieldError } from './FieldError';

interface Option {
  value: string | number;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: Option[];
  placeholder?: string;
  /** Mostra um campo de busca na lista; o termo vai para quem carrega as opções. */
  onSearch?: (term: string) => void;
}

/**
 * Dropdown "preto neon" — assinatura do Design System Obsidian.
 *
 * Mantém um <select> nativo oculto (fonte da verdade) para integrar com
 * react-hook-form sem alterar os formulários: o valor é escrito no elemento
 * nativo e um evento `change` é disparado para o RHF reagir. Por cima, um
 * listbox custom totalmente estilizado e acessível (teclado + leitor de tela).
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    {
      label,
      error,
      options: optionsProp,
      placeholder,
      onSearch,
      id,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const listboxId = `${fieldId}-listbox`;
    const labelId = `${fieldId}-label`;

    const selectRef = useRef<HTMLSelectElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);
    // Última opção escolhida: continua na lista quando a busca troca os
    // resultados, senão o <select> nativo perderia o valor.
    const keptRef = useRef<Option | null>(null);
    const [term, setTerm] = useState('');

    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);

    const kept = keptRef.current;
    const options =
      kept && !optionsProp.some((o) => String(o.value) === String(kept.value))
        ? [kept, ...optionsProp]
        : optionsProp;

    const setRefs = useCallback(
      (node: HTMLSelectElement | null) => {
        selectRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    // Sincroniza o rótulo com o valor real do <select> a cada render
    // (cobre reset() e mudanças programáticas do react-hook-form).
    useEffect(() => {
      const node = selectRef.current;
      if (node && node.value !== value) setValue(node.value);
    });

    const selectedIndex = options.findIndex((o) => String(o.value) === value);
    const selectedLabel =
      selectedIndex >= 0 ? options[selectedIndex].label : '';

    const commit = (next: string) => {
      const node = selectRef.current;
      if (!node) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value',
      )?.set;
      keptRef.current =
        options.find((o) => String(o.value) === next) ?? keptRef.current;
      setter?.call(node, next);
      node.dispatchEvent(new Event('change', { bubbles: true }));
      setValue(next);
    };

    const openList = useCallback(() => {
      if (disabled) return;
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      setOpen(true);
    }, [disabled, selectedIndex]);

    const closeList = useCallback(() => {
      setOpen(false);
      if (onSearch && term) {
        setTerm('');
        onSearch('');
      }
    }, [onSearch, term]);

    useEffect(() => {
      if (open && onSearch) searchRef.current?.focus();
    }, [open, onSearch]);

    // Fecha ao clicar fora
    useEffect(() => {
      if (!open) return;
      const onPointer = (e: MouseEvent) => {
        if (!rootRef.current?.contains(e.target as Node)) closeList();
      };
      window.addEventListener('mousedown', onPointer);
      return () => window.removeEventListener('mousedown', onPointer);
    }, [open, closeList]);

    // Mantém a opção ativa visível
    useEffect(() => {
      if (!open || activeIndex < 0) return;
      const el = listRef.current?.children[activeIndex] as
        HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex]);

    const move = (delta: number) => {
      setActiveIndex((i) => {
        const n = options.length;
        if (n === 0) return -1;
        const start = i < 0 ? (delta > 0 ? -1 : 0) : i;
        return (start + delta + n) % n;
      });
    };

    const onTriggerKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === ' ' && e.target === searchRef.current) return;
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!open) openList();
          else if (e.key === 'ArrowDown') move(1);
          else if (e.key === 'ArrowUp') move(-1);
          else if (activeIndex >= 0) {
            commit(String(options[activeIndex].value));
            closeList();
          }
          break;
        case 'Escape':
          if (open) {
            e.preventDefault();
            closeList();
          }
          break;
        case 'Home':
          if (open) {
            e.preventDefault();
            setActiveIndex(0);
          }
          break;
        case 'End':
          if (open) {
            e.preventDefault();
            setActiveIndex(options.length - 1);
          }
          break;
        default:
          break;
      }
    };

    const triggerCls = [
      'flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-all outline-none',
      'focus-visible:ring-4',
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      error
        ? 'border-[#dc2626] focus-visible:border-[#dc2626] focus-visible:ring-[#dc2626]/15'
        : open
          ? 'border-[#0a0a0a] ring-4 ring-[#0a0a0a]/10'
          : 'border-[#e5e5e5] hover:border-[#a3a3a3] focus-visible:border-[#0a0a0a] focus-visible:ring-[#0a0a0a]/10',
      className,
    ].join(' ');

    return (
      <div className="flex flex-col gap-1" ref={rootRef}>
        <label
          id={labelId}
          htmlFor={fieldId}
          className="text-sm font-semibold text-[#0a0a0a]"
        >
          {label}
        </label>

        {/* Fonte da verdade para o react-hook-form */}
        <select
          ref={setRefs}
          id={fieldId}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="relative">
          <button
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-labelledby={labelId}
            aria-invalid={error ? 'true' : undefined}
            disabled={disabled}
            className={triggerCls}
            onClick={() => (open ? closeList() : openList())}
            onKeyDown={onTriggerKeyDown}
          >
            <span
              className={
                selectedLabel
                  ? 'truncate text-[#0a0a0a]'
                  : 'truncate text-[#0a0a0a]/40'
              }
            >
              {selectedLabel || placeholder || 'Selecione'}
            </span>
            <motion.span
              aria-hidden="true"
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 text-[#0a0a0a]/45"
            >
              <IconChevronDown width={16} height={16} />
            </motion.span>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="absolute z-50 mt-1.5 w-full rounded-xl border border-[#e5e5e5] bg-white p-1 shadow-[var(--shadow-lift)] ring-1 ring-black/5"
              >
                {onSearch && (
                  <input
                    ref={searchRef}
                    type="search"
                    value={term}
                    placeholder="Buscar…"
                    aria-label={`Buscar ${label.toLowerCase()}`}
                    aria-controls={listboxId}
                    className="mb-1 w-full rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-sm outline-none focus-visible:border-[#0a0a0a] focus-visible:ring-4 focus-visible:ring-[#0a0a0a]/10"
                    onChange={(e) => {
                      setTerm(e.target.value);
                      setActiveIndex(0);
                      onSearch(e.target.value);
                    }}
                    onKeyDown={onTriggerKeyDown}
                  />
                )}
                <ul
                  ref={listRef}
                  id={listboxId}
                  role="listbox"
                  aria-labelledby={labelId}
                  className="max-h-64 overflow-auto obsidian-scroll"
                >
                  {placeholder && (
                    <SelectOption
                      active={activeIndex === -1}
                      selected={value === ''}
                      muted
                      onSelect={() => {
                        commit('');
                        closeList();
                      }}
                      onHover={() => setActiveIndex(-1)}
                    >
                      {placeholder}
                    </SelectOption>
                  )}
                  {options.map((opt, i) => (
                    <SelectOption
                      key={opt.value}
                      active={i === activeIndex}
                      selected={String(opt.value) === value}
                      onSelect={() => {
                        commit(String(opt.value));
                        closeList();
                      }}
                      onHover={() => setActiveIndex(i)}
                    >
                      {opt.label}
                    </SelectOption>
                  ))}
                  {onSearch && options.length === 0 && (
                    <li className="px-3 py-2 text-sm text-[#0a0a0a]/45">
                      Nenhum resultado
                    </li>
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <FieldError message={error} />
      </div>
    );
  },
);

function SelectOption({
  active,
  selected,
  muted = false,
  onSelect,
  onHover,
  children,
}: {
  active: boolean;
  selected: boolean;
  muted?: boolean;
  onSelect: () => void;
  onHover: () => void;
  children: React.ReactNode;
}) {
  const cls = [
    'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
    selected
      ? 'neon-black font-semibold'
      : active
        ? 'bg-[#f0f0f0] text-[#0a0a0a]'
        : muted
          ? 'text-[#0a0a0a]/45'
          : 'text-[#0a0a0a]',
  ].join(' ');

  return (
    <li
      role="option"
      aria-selected={selected}
      className={cls}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onHover}
    >
      <span className="truncate">{children}</span>
      {selected && (
        <IconCheck
          width={15}
          height={15}
          aria-hidden="true"
          className="shrink-0"
        />
      )}
    </li>
  );
}
