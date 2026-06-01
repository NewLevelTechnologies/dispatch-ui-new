import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { tagApi, type Tag } from '../api';
import { TagPill } from './ui/TagPill';
import { Input } from './catalyst/input';

interface Props {
  /** Tag ids already applied to the record — excluded from suggestions. */
  appliedTagIds: string[];
  /** An existing tag was chosen from the list. */
  onApply: (tag: Tag) => void;
  /** The "Create '{query}'" row was chosen. Parent creates + applies. */
  onCreate: (name: string) => void;
  /** Dismiss the picker (outside click / Escape / blur). */
  onClose: () => void;
  /**
   * Whether the user may create new tags inline. When false the create-row is
   * hidden and they can only pick from the existing library. (Tag creation is
   * gated by the same edit capability today; a dedicated MANAGE_TAGS gate can
   * be layered here if the backend adds one.)
   */
  canCreate: boolean;
  /** A mutation (apply/create) is in flight — disables commits. */
  busy?: boolean;
}

// A create-row sentinel so the highlight index can span existing options + the
// create affordance in one keyboard-navigable list.
const CREATE_INDEX = -2;

/**
 * Inline tag picker — manual Input + custom listbox, mirroring CustomerPicker
 * (Catalyst Combobox's internal query state can't surface a live "Create
 * '{text}'" row). The tenant tag library is small (<50, hard cap 200) so it's
 * loaded once and filtered client-side.
 */
export default function TagPicker({ appliedTagIds, onApply, onCreate, onClose, canCreate, busy }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
    staleTime: 60_000,
  });

  const applied = useMemo(() => new Set(appliedTagIds), [appliedTagIds]);
  const trimmed = query.trim();

  // Unapplied tags matching the query, by name (case-insensitive).
  const matches = useMemo(() => {
    const all = (tags ?? []).filter((tag) => !applied.has(tag.id));
    if (trimmed === '') return all;
    const q = trimmed.toLowerCase();
    return all.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, applied, trimmed]);

  // Offer create only when there's a query with no exact (ci) name collision —
  // typing "vip" when "VIP" exists should match the existing tag, not create a
  // duplicate (the backend enforces case-insensitive uniqueness too).
  const exactExists = useMemo(
    () => (tags ?? []).some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase()),
    [tags, trimmed]
  );
  const showCreate = canCreate && trimmed !== '' && !exactExists;

  // Normalize the stored highlight against the current candidate set (the set
  // shrinks/grows as the query changes), without a setState-in-effect. Falls
  // back to the first match, else the create-row, else 0.
  const active =
    highlight === CREATE_INDEX
      ? showCreate
        ? CREATE_INDEX
        : matches.length > 0
          ? 0
          : 0
      : highlight >= 0 && highlight < matches.length
        ? highlight
        : matches.length > 0
          ? 0
          : showCreate
            ? CREATE_INDEX
            : 0;

  // Autofocus on mount so "+ Add" lands the cursor straight in the field.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const commit = (index: number) => {
    if (busy) return;
    if (index === CREATE_INDEX) {
      if (showCreate) onCreate(trimmed);
      return;
    }
    const tag = matches[index];
    if (tag) onApply(tag);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    // Comma commits the highlighted option (don't let it type into the field).
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(active);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (active === CREATE_INDEX) return;
      const next = active + 1;
      if (next < matches.length) setHighlight(next);
      else if (showCreate) setHighlight(CREATE_INDEX);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (active === CREATE_INDEX) setHighlight(matches.length > 0 ? matches.length - 1 : CREATE_INDEX);
      else setHighlight(Math.max(0, active - 1));
    }
  };

  const hasOptions = matches.length > 0 || showCreate;

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={t('tags.searchPlaceholder')}
        aria-label={t('tags.searchPlaceholder')}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
      />
      <div
        className="absolute top-full left-0 z-50 mt-1 w-full overflow-y-auto rounded-md border border-border bg-bg-elev shadow-lg"
        style={{ maxHeight: 240 }}
      >
        {!hasOptions ? (
          <div className="px-3 py-2 text-[12px] text-fg-muted">
            {trimmed === '' ? t('tags.allApplied') : t('tags.noMatches')}
          </div>
        ) : (
          <ul role="listbox" className="py-1">
            {matches.map((tag, i) => (
              <li
                key={tag.id}
                role="option"
                aria-selected={active === i}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(i)}
                className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[12px] ${
                  active === i ? 'bg-bg-hover' : ''
                }`}
              >
                <TagPill color={tag.color} name={tag.name} />
              </li>
            ))}
            {showCreate && (
              <li
                role="option"
                aria-selected={active === CREATE_INDEX}
                onMouseEnter={() => setHighlight(CREATE_INDEX)}
                onClick={() => commit(CREATE_INDEX)}
                className={`flex cursor-pointer items-center gap-1.5 border-t border-border-soft px-2.5 py-1.5 text-[12px] text-fg ${
                  active === CREATE_INDEX ? 'bg-bg-hover' : ''
                }`}
              >
                <span className="text-fg-muted">+</span>
                {t('tags.createOption', { name: trimmed })}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
