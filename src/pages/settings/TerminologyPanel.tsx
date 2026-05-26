import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import {
  glossaryApi,
  tenantSettingsApi,
  type Glossary,
  type EntityInfo,
} from '../../api';
import { useGlossary } from '../../contexts/GlossaryContext';
import { useHasCapability } from '../../hooks/useCurrentUser';
import { showError, showSuccess, extractApiError } from '../../lib/toast';
import {
  PRESETS,
  pluralize,
  ENTITY_GROUP,
  GROUP_ORDER,
  type GroupId,
  type Preset,
  type PresetId,
} from '../../lib/terminologyPresets';
import { Card as CatalystCard } from '../../components/catalyst/card';
import { Card as ListCard, CardBody } from '../../components/ui/Card';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '../../components/catalyst/dialog';
import { Button } from '../../components/catalyst/button';
import { Input } from '../../components/catalyst/input';
import { Text } from '../../components/catalyst/text';
import { Callout } from '../../components/ui/Callout';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHead } from '../../components/ui/PageHead';
import ConfirmDialog from '../../components/ConfirmDialog';

// One entity-row's editable state. The form holds *every* known entity
// keyed by code, so the renderer can iterate the catalog and read state
// in O(1). On save we strip rows where both fields are blank (i.e. "use
// the system default"). That matches the wire convention: key-absence =
// default, NOT null on the fields.
type FormState = Record<string, { singular: string; plural: string }>;

// Glossary serialization. Map any entries with at least one non-blank
// field into the wire-format glossary; everything else is treated as
// "use default" and omitted from the payload.
function serialize(form: FormState): Glossary {
  const out: Glossary = {};
  for (const [code, v] of Object.entries(form)) {
    const s = v.singular.trim();
    const p = v.plural.trim();
    if (s || p) out[code] = { singular: s, plural: p };
  }
  return out;
}

function hydrate(entities: EntityInfo[], glossary: Glossary | undefined): FormState {
  const out: FormState = {};
  for (const e of entities) {
    const c = glossary?.[e.code];
    out[e.code] = {
      singular: c?.singular ?? '',
      plural: c?.plural ?? '',
    };
  }
  return out;
}

// Deep equality on FormState — used to compute `dirty` against the
// last-loaded server state without serializing both sides every render.
function sameForm(a: FormState, b: FormState): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = a[k] ?? { singular: '', plural: '' };
    const bv = b[k] ?? { singular: '', plural: '' };
    if (av.singular !== bv.singular || av.plural !== bv.plural) return false;
  }
  return true;
}

function isRowCustomized(form: FormState, code: string): boolean {
  const v = form[code];
  return Boolean(v && (v.singular.trim() || v.plural.trim()));
}

function countCustomized(form: FormState): number {
  return Object.keys(form).filter((c) => isRowCustomized(form, c)).length;
}

// View-model for the apply-preset confirmation. Spelled out so the
// dialog can make the merge model visible in plain English:
//   · `definedLabels` — entities this preset has its own names for
//   · `keptLabels`    — entities currently customized that the preset
//                       does NOT touch (kept untouched on apply)
//   · `replaced`      — entities currently customized AND in the preset
//                       (the only fields that lose a value), with a
//                       before→after diff
interface PresetDialogData {
  preset: Preset;
  targetCount: number;
  definedLabels: string[];
  keptLabels: string[];
  replaced: { code: string; label: string; from: string; to: string }[];
}

function buildPresetDialogData(
  preset: Preset,
  form: FormState,
  labelFor: (code: string) => string,
): PresetDialogData {
  const targets = Object.keys(preset.overrides);
  const targetSet = new Set(targets);
  const replaced = targets
    .filter((code) => isRowCustomized(form, code))
    .map((code) => ({
      code,
      label: labelFor(code),
      from: form[code]?.singular.trim() || form[code]?.plural.trim() || '',
      to: preset.overrides[code].singular,
    }));
  const keptLabels = Object.keys(form)
    .filter((code) => !targetSet.has(code) && isRowCustomized(form, code))
    .map(labelFor);
  return {
    preset,
    targetCount: targets.length,
    definedLabels: targets.map(labelFor),
    keptLabels,
    replaced,
  };
}

// Group display name resolved via i18n. Defined here (not as a literal
// map) so the eyebrow labels stay translatable.
function groupLabel(t: (k: string) => string, g: GroupId): string {
  switch (g) {
    case 'customer':
      return t('settings.terminology.groupCustomer');
    case 'work':
      return t('settings.terminology.groupWork');
    case 'people':
      return t('settings.terminology.groupPeople');
    case 'equipment':
      return t('settings.terminology.groupEquipment');
    case 'operations':
      return t('settings.terminology.groupOperations');
    case 'money':
      return t('settings.terminology.groupMoney');
  }
}

export default function TerminologyPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { updateGlossary } = useGlossary();
  const canEdit = useHasCapability('EDIT_SETTINGS');

  const settingsQuery = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => tenantSettingsApi.getSettings(),
  });

  const entitiesQuery = useQuery({
    queryKey: ['glossary', 'available'],
    queryFn: () => glossaryApi.getAvailableEntities(),
  });

  // Form state seeded from server. We hydrate every known entity so the
  // renderer doesn't have to guard on missing keys.
  const [form, setForm] = useState<FormState>({});
  // Baseline = last server-loaded form. `dirty = !sameForm(form, baseline)`.
  const [baseline, setBaseline] = useState<FormState>({});
  // Last-applied preset (visual-only, session-scoped). NOT persisted.
  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  // Confirm states.
  const [pendingPreset, setPendingPreset] = useState<Preset | null>(null);
  const [resetAllOpen, setResetAllOpen] = useState(false);
  // Defense-in-depth: if the server rejects a save with unknown keys, we
  // surface a danger callout above the editor. Users won't normally hit
  // this — registry drift between FE + BE is the only realistic source.
  const [unknownKeys, setUnknownKeys] = useState<string[] | null>(null);

  // Seed form on load, and any time the server data changes (e.g. after
  // a successful save invalidates the query).
  useEffect(() => {
    if (!entitiesQuery.data || !settingsQuery.data) return;
    const seeded = hydrate(entitiesQuery.data, settingsQuery.data.glossary);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: hydrate form state from server-loaded query data; same pattern as UserFormPage
    setForm(seeded);
    setBaseline(seeded);
  }, [entitiesQuery.data, settingsQuery.data]);

  const dirty = useMemo(() => !sameForm(form, baseline), [form, baseline]);
  const customCount = useMemo(() => countCustomized(form), [form]);

  // Built when a preset chip is clicked. Memoized so the dialog's
  // captured copy stays a stable reference through its close animation
  // (the modal blocks edits, so `form` can't change while it's open).
  const presetDialogData = useMemo(() => {
    if (!pendingPreset || !entitiesQuery.data) return null;
    const labelFor = (code: string) =>
      entitiesQuery.data.find((e) => e.code === code)?.defaultSingular ?? code;
    return buildPresetDialogData(pendingPreset, form, labelFor);
  }, [pendingPreset, form, entitiesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (glossary: Glossary) => tenantSettingsApi.updateSettings({ glossary }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      if (updated.glossary) updateGlossary(updated.glossary);
      setUnknownKeys(null);
      showSuccess(t('settings.terminology.saveSuccess'));
    },
    onError: (err: unknown) => {
      // Surface the spec'd 400 { error, unknownKeys: [...] } shape inline.
      const r =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { unknownKeys?: string[] } } }).response
          : undefined;
      const keys = r?.data?.unknownKeys;
      if (Array.isArray(keys) && keys.length > 0) {
        setUnknownKeys(keys);
        return;
      }
      showError(t('settings.terminology.saveError'), extractApiError(err));
    },
  });

  const handleChange = (code: string, field: 'singular' | 'plural', value: string) => {
    setForm((prev) => ({
      ...prev,
      [code]: {
        singular: field === 'singular' ? value : prev[code]?.singular ?? '',
        plural: field === 'plural' ? value : prev[code]?.plural ?? '',
      },
    }));
    setActivePreset(null);
  };

  const handleRowReset = (code: string) => {
    setForm((prev) => ({ ...prev, [code]: { singular: '', plural: '' } }));
    setActivePreset(null);
  };

  const handleCancelEdits = () => {
    setForm(baseline);
    setActivePreset(null);
    setUnknownKeys(null);
  };

  const handleResetAll = () => {
    // Clear every row. Save will send `"glossary": {}`.
    setForm((prev) => {
      const cleared: FormState = {};
      for (const code of Object.keys(prev)) cleared[code] = { singular: '', plural: '' };
      return cleared;
    });
    setActivePreset(null);
  };

  const handleSave = () => {
    saveMutation.mutate(serialize(form));
  };

  const handlePresetChipClick = (preset: Preset) => {
    if (!canEdit) return;
    setPendingPreset(preset);
  };

  const handleApplyPreset = (preset: Preset) => {
    setForm((prev) => {
      const next: FormState = { ...prev };
      for (const [code, ov] of Object.entries(preset.overrides)) {
        next[code] = { singular: ov.singular, plural: ov.plural };
      }
      return next;
    });
    setActivePreset(preset.id);
    setPendingPreset(null);
  };

  // ─────────────────────────────────────────────────────────────────
  // Loading / error gates
  // ─────────────────────────────────────────────────────────────────
  if (settingsQuery.isLoading || entitiesQuery.isLoading) {
    return (
      <div className="py-8">
        <LoadingState label={t('tenantSettings.messages.loadingSettings')} />
      </div>
    );
  }
  if (settingsQuery.error || !entitiesQuery.data) {
    return (
      <div className="py-8">
        <ErrorState
          title={t('tenantSettings.messages.errorLoadingSettings')}
          description={extractApiError(settingsQuery.error) ?? undefined}
        />
      </div>
    );
  }

  const entities = entitiesQuery.data;
  // Bucket entities by group so we can render six grouped cards.
  const byGroup: Record<GroupId, EntityInfo[]> = {
    customer: [],
    work: [],
    people: [],
    equipment: [],
    operations: [],
    money: [],
  };
  for (const e of entities) {
    const g = ENTITY_GROUP[e.code];
    if (g) byGroup[g].push(e);
  }

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-52px)] min-h-0 flex-col max-lg:-mx-4 max-lg:-my-4">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-7 pb-6 pt-5 max-lg:px-4">
        <div className="mx-auto max-w-[920px]">
          <PageHead
            title={t('settings.terminology.title')}
            sub={t('settings.terminology.description')}
          />

          {unknownKeys && (
            <div className="mb-3">
              <Callout kind="danger">
                {t('settings.terminology.unknownKeysError', {
                  keys: [...unknownKeys].sort().join(', '),
                })}
              </Callout>
            </div>
          )}

          {/* Industry preset card — Catalyst Card (titled header) */}
          <CatalystCard
            title={t('settings.terminology.presetCardTitle')}
            subtitle={t('settings.terminology.presetCardSubtitle')}
            className="mb-5"
          >
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <PresetChip
                  key={p.id}
                  preset={p}
                  selected={activePreset === p.id}
                  disabled={!canEdit}
                  onClick={() => handlePresetChipClick(p)}
                />
              ))}
            </div>
          </CatalystCard>

          {/* Grouped entity cards */}
          <div className="space-y-4">
            {GROUP_ORDER.map((g) => {
              const items = byGroup[g];
              if (items.length === 0) return null;
              return (
                <div key={g}>
                  <div className="mb-2 pl-0.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-fg-muted">
                    {groupLabel(t, g)}
                  </div>
                  <ListCard>
                    <CardBody flush>
                      {/* Desktop column header — hidden on mobile where each row
                          carries its own per-field eyebrow */}
                      <div
                        className="hidden grid-cols-[1fr_220px_220px_28px] gap-x-3 border-b border-border-soft bg-bg-elev-2 px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-fg-muted sm:grid"
                      >
                        <div>{t('tenantSettings.glossary.entity')}</div>
                        <div>{t('tenantSettings.glossary.singularForm')}</div>
                        <div>{t('tenantSettings.glossary.pluralForm')}</div>
                        <div aria-hidden />
                      </div>
                      <div className="divide-y divide-border-soft">
                        {items.map((entity) => (
                          <EntityRow
                            key={entity.code}
                            entity={entity}
                            value={form[entity.code] ?? { singular: '', plural: '' }}
                            customized={isRowCustomized(form, entity.code)}
                            disabled={!canEdit}
                            onChange={(field, value) =>
                              handleChange(entity.code, field, value)
                            }
                            onReset={() => handleRowReset(entity.code)}
                          />
                        ))}
                      </div>
                    </CardBody>
                  </ListCard>
                </div>
              );
            })}
          </div>

          {/* Footer note — the single biggest admin worry, addressed inline */}
          <div className="mt-5 rounded-md border border-border-soft bg-bg-elev-2 px-3.5 py-2.5 text-[11.5px] leading-[1.55] text-fg-muted">
            <strong className="text-fg">{t('settings.terminology.footerNoteLead')}</strong>{' '}
            {t('settings.terminology.footerNote')}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      {canEdit && (
        <div
          className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-border bg-bg-elev px-7 py-3 max-lg:px-4"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <Button
            plain
            size="xs"
            type="button"
            onClick={() => setResetAllOpen(true)}
            disabled={customCount === 0 || saveMutation.isPending}
          >
            {t('settings.terminology.resetAllLabel')}
          </Button>
          <span className="flex-1" />
          <Text size="xs" tone={dirty ? 'default' : 'dim'} className="max-sm:basis-full">
            {dirty
              ? t('settings.terminology.dirtyHint')
              : t('settings.terminology.noChanges')}
          </Text>
          <Button
            plain
            size="xs"
            type="button"
            onClick={handleCancelEdits}
            disabled={!dirty || saveMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            color="accent"
            size="xs"
            type="button"
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending
              ? t('common.saving')
              : t('settings.terminology.saveChanges')}
          </Button>
        </div>
      )}

      {/* Apply-preset confirmation */}
      <ApplyPresetDialog
        data={presetDialogData}
        onCancel={() => setPendingPreset(null)}
        onConfirm={(p) => handleApplyPreset(p)}
      />

      {/* Reset-all confirmation */}
      <ConfirmDialog
        isOpen={resetAllOpen}
        onClose={() => setResetAllOpen(false)}
        onConfirm={handleResetAll}
        title={t('settings.terminology.resetAllConfirmTitle')}
        message={t('settings.terminology.resetAllConfirmMessage')}
        confirmLabel={t('settings.terminology.resetAllLabel')}
        isDestructive
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PresetChip — clickable trade-icon chip. Selected state is purely a
// visual marker of "the last preset applied in this edit session" —
// not persisted. See terminology-redesign.md Step 3.
// ─────────────────────────────────────────────────────────────────
function PresetChip({
  preset,
  selected,
  disabled,
  onClick,
}: {
  preset: Preset;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = preset.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-accent-500/35 bg-accent-500/10 text-fg-accent'
          : 'border-border bg-bg-elev text-fg-strong hover:bg-bg-hover',
      ].join(' ')}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{preset.label}</span>
      {selected && <CheckIcon className="ml-0.5 size-3.5" aria-hidden="true" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// EntityRow — one editable entity inside a grouped card.
// Desktop: 4-column grid (name+description, singular, plural, ↺).
// Mobile (<sm): single-column reflow. Per-field eyebrows take over the
// column-naming job (top table header is hidden on mobile), and ↺ sits
// inline with the singular field.
// ─────────────────────────────────────────────────────────────────
function EntityRow({
  entity,
  value,
  customized,
  disabled,
  onChange,
  onReset,
}: {
  entity: EntityInfo;
  value: { singular: string; plural: string };
  customized: boolean;
  disabled: boolean;
  onChange: (field: 'singular' | 'plural', value: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  // When the admin has typed a singular but left plural blank, the
  // plural input shows a live pluralization hint *as the placeholder*.
  // Their explicit input always wins.
  const pluralHint = value.singular.trim() && !value.plural
    ? pluralize(value.singular.trim())
    : entity.defaultPlural;
  return (
    <div
      className={[
        'grid grid-cols-1 items-start gap-x-3 gap-y-2 px-3.5 py-2.5 transition-colors sm:grid-cols-[1fr_220px_220px_28px] sm:items-center',
        customized ? 'bg-accent-500/3' : '',
      ].join(' ')}
    >
      {/* Entity column */}
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-fg-strong">
          {entity.defaultSingular}
        </div>
        {entity.description && (
          <div className="mt-0.5 text-[11px] leading-snug text-fg-muted">
            {entity.description}
          </div>
        )}
      </div>

      {/* Singular */}
      <div>
        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-fg-muted sm:hidden">
          {t('tenantSettings.glossary.singularForm')}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            size="xs"
            name={`glossary-${entity.code}-singular`}
            aria-label={`${entity.defaultSingular} singular`}
            value={value.singular}
            placeholder={entity.defaultSingular}
            disabled={disabled}
            onChange={(e) => onChange('singular', e.target.value)}
          />
          {/* Mobile: ↺ rides with the singular field so it stays reachable
              and the visible plural row doesn't need a fourth column. */}
          {customized && !disabled && (
            <button
              type="button"
              onClick={onReset}
              aria-label={t('tenantSettings.glossary.resetToDefault')}
              title={t('tenantSettings.glossary.resetToDefault')}
              className="inline-flex size-6 flex-shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-elev-2 hover:text-fg-strong sm:hidden"
            >
              <ArrowPathIcon className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Plural */}
      <div>
        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-fg-muted sm:hidden">
          {t('tenantSettings.glossary.pluralForm')}
        </div>
        <Input
          size="xs"
          name={`glossary-${entity.code}-plural`}
          aria-label={`${entity.defaultSingular} plural`}
          value={value.plural}
          placeholder={pluralHint}
          disabled={disabled}
          onChange={(e) => onChange('plural', e.target.value)}
        />
      </div>

      {/* Desktop-only ↺. On mobile the icon lives next to the singular
          field — see above. */}
      <div className="hidden justify-end sm:flex">
        {customized && !disabled && (
          <button
            type="button"
            onClick={onReset}
            aria-label={t('tenantSettings.glossary.resetToDefault')}
            title={t('tenantSettings.glossary.resetToDefault')}
            className="inline-flex size-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-elev-2 hover:text-fg-strong"
          >
            <ArrowPathIcon className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ApplyPresetDialog — confirms a preset before merging into form state.
// Makes the merge model visible in plain English: what the preset
// defines, what stays untouched, and a before→after diff for the
// fields that actually change.
// ─────────────────────────────────────────────────────────────────
function ApplyPresetDialog({
  data,
  onCancel,
  onConfirm,
}: {
  data: PresetDialogData | null;
  onCancel: () => void;
  onConfirm: (p: Preset) => void;
}) {
  const { t } = useTranslation();
  const open = data !== null;
  // The dialog stays mounted across opens so the body can read `data`
  // through the close animation. The captured value is the
  // most-recently-non-null data — without this, the content vanishes
  // mid-fade when the parent resets `data` to `null` on confirm/cancel.
  const [captured, setCaptured] = useState<PresetDialogData | null>(data);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: capture the most-recent non-null data for stable rendering during the dialog's close animation
    if (data) setCaptured(data);
  }, [data]);
  const d = captured;

  return (
    <Dialog open={open} onClose={onCancel} size="md">
      {d && (
        <>
          <DialogTitle>
            {t('settings.terminology.applyPresetConfirmTitle', { name: d.preset.label })}
          </DialogTitle>
          <DialogDescription>
            {t('settings.terminology.applyPresetSubline')}
          </DialogDescription>
          <DialogBody>
            {d.targetCount === 0 ? (
              // HVAC (and any future no-op preset) — applying changes
              // nothing. Point the admin at Reset to defaults instead.
              <Text size="sm" tone="muted">
                {t('settings.terminology.presetMatchesDefaults', { name: d.preset.label })}
              </Text>
            ) : (
              <div className="space-y-2.5">
                <Text size="sm" tone="muted">
                  {t('settings.terminology.presetDefines', {
                    name: d.preset.label,
                    entities: d.definedLabels.join(', '),
                  })}
                </Text>
                <Text size="sm" tone="muted">
                  {d.keptLabels.length > 0
                    ? t('settings.terminology.presetKept', {
                        entities: d.keptLabels.join(', '),
                      })
                    : t('settings.terminology.presetKeptGeneric')}
                </Text>

                {d.replaced.length > 0 ? (
                  <Callout kind="warning">
                    <div className="font-medium text-fg-strong">
                      {/* Manual count→key pick: the i18n test mock doesn't
                          run i18next's plural resolution, so choose the
                          singular/plural key explicitly. */}
                      {d.replaced.length === 1
                        ? t('settings.terminology.presetReplaceIntro_one', {
                            count: d.replaced.length,
                            total: d.targetCount,
                          })
                        : t('settings.terminology.presetReplaceIntro', {
                            count: d.replaced.length,
                            total: d.targetCount,
                          })}
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {d.replaced.map((r) => (
                        <li
                          key={r.code}
                          className="flex flex-wrap items-center gap-x-1.5 text-[11.5px]"
                        >
                          <span className="font-semibold text-fg-strong">{r.label}</span>
                          <span className="text-fg-muted">
                            {t('settings.terminology.presetWas', { value: r.from })}
                          </span>
                          <ArrowRightIcon className="size-3 text-fg-muted" aria-hidden="true" />
                          <span className="font-semibold text-fg-accent">{r.to}</span>
                        </li>
                      ))}
                    </ul>
                  </Callout>
                ) : (
                  <Text size="sm" tone="muted">
                    {t('settings.terminology.presetNothingCustomized')}
                  </Text>
                )}
              </div>
            )}
          </DialogBody>
          <DialogActions>
            <Button plain size="xs" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button color="accent" size="xs" onClick={() => onConfirm(d.preset)}>
              {t('settings.terminology.applyPreset')}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
