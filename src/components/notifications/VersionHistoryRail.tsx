/* eslint-disable i18next/no-literal-string -- dense visual form; primary copy stays inline. Translation pass lives in a follow-up. */
// Slide-in right-anchored rail showing the template's version timeline.
// Triggered by the "History" button in the editor header.
//
// Restore fires the server-side POST /rollback/{versionId} (already exists)
// and replays the resulting template into form state via `onApply`. The
// edit page treats that as a fresh original — `dirty` resets, the user can
// tweak from there or just navigate away (the rollback is already
// persisted server-side).

import { Fragment, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  notificationTemplateApi,
  type NotificationTemplate,
  type TemplateVersion,
} from '../../api';
import { extractApiError, showError, showSuccess } from '../../lib/toast';
import { summarizeVersionDiff } from '../../lib/templateEditor';

import { Pill } from '../ui/Pill';
import { Text } from '../catalyst/text';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';
import { Button } from '../catalyst/button';
import ConfirmDialog from '../ConfirmDialog';

type Props = {
  open: boolean;
  onClose: () => void;
  template: NotificationTemplate;
  onApply: (next: NotificationTemplate) => void;
};

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function VersionHistoryRail({
  open,
  onClose,
  template,
  onApply,
}: Props) {
  const queryClient = useQueryClient();
  const [pendingRestore, setPendingRestore] = useState<TemplateVersion | null>(
    null
  );

  const {
    data: history,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notification-template-history', template.id],
    queryFn: () => notificationTemplateApi.getVersionHistory(template.id),
    enabled: open,
  });

  const versions = useMemo<TemplateVersion[]>(() => {
    const list = history?.versions ?? [];
    // Newest first — server may already do this, but enforce so the
    // "current" highlight + diff block land predictably.
    return [...list].sort((a, b) => b.version - a.version);
  }, [history]);

  const rollback = useMutation({
    mutationFn: (versionId: string) =>
      notificationTemplateApi.rollback(template.id, versionId),
    onSuccess: (fresh) => {
      onApply(fresh);
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      queryClient.invalidateQueries({
        queryKey: ['notification-template-history', template.id],
      });
      showSuccess(`Restored v${pendingRestore?.version ?? ''}`);
      setPendingRestore(null);
      onClose();
    },
    onError: (err) =>
      showError("Couldn't restore version", extractApiError(err)),
  });

  return (
    <>
      <Transition show={open} as={Fragment}>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-full max-sm:w-full sm:w-[380px]">
          <TransitionChild
            as={Fragment}
            enter="transition transform duration-200 ease-out"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transition transform duration-150 ease-in"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <aside
              className={clsx(
                'pointer-events-auto flex h-full flex-col overflow-hidden border-l border-border bg-bg-elev',
                'sm:shadow-[-12px_0_32px_-16px_rgba(0,0,0,0.2)]'
              )}
            >
              <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <ClockIcon className="size-3.5 text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-fg-strong">
                    Version history
                  </div>
                  <Text size="xs" tone="muted" className="truncate">
                    {template.displayName} · {versions.length} version
                    {versions.length === 1 ? '' : 's'}
                  </Text>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close history"
                  className="rounded p-0.5 text-fg-muted hover:bg-bg-hover hover:text-fg-strong"
                >
                  <XMarkIcon className="size-4" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto py-2">
                {isLoading ? (
                  <div className="p-6">
                    <LoadingState />
                  </div>
                ) : error ? (
                  <div className="p-6">
                    <ErrorState
                      title="Couldn't load history"
                      description={extractApiError(error)}
                      action={
                        <Button outline size="xs" onClick={() => refetch()}>
                          Try again
                        </Button>
                      }
                    />
                  </div>
                ) : versions.length === 0 ? (
                  <Text
                    as="div"
                    size="sm"
                    tone="muted"
                    className="px-4 py-6 text-center"
                  >
                    No versions yet.
                  </Text>
                ) : (
                  versions.map((v, i) => {
                    const prev = versions[i + 1] ?? null;
                    const summary = summarizeVersionDiff(prev, v);
                    const current = v.isActive;
                    const label = `v${v.version}`;
                    return (
                      <article
                        key={v.id}
                        className={clsx(
                          'border-b border-border-soft px-4 py-3',
                          current && 'border-l-2 border-l-accent-500 bg-accent-500/5'
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[12px] font-bold text-fg-strong">
                            {label}
                          </span>
                          {current && <Pill tone="accent">Current</Pill>}
                          {v.version === 1 && !current && (
                            <Pill tone="neutral">Original</Pill>
                          )}
                          <span className="flex-1" />
                          {!current && (
                            <button
                              type="button"
                              onClick={() => setPendingRestore(v)}
                              className="bg-transparent p-0 text-[11.5px] font-semibold text-fg-accent hover:underline"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                        <Text as="div" size="sm" tone="strong" className="mt-1">
                          {summary}
                        </Text>
                        <Text as="div" size="xs" tone="dim" className="mt-0.5">
                          {v.updatedByName ?? 'Unknown'} · {fmtTs(v.updatedAt)}
                        </Text>
                      </article>
                    );
                  })
                )}
              </div>
            </aside>
          </TransitionChild>
        </div>
      </Transition>

      <ConfirmDialog
        isOpen={!!pendingRestore}
        onClose={() => {
          if (!rollback.isPending) setPendingRestore(null);
        }}
        onConfirm={() =>
          pendingRestore && rollback.mutate(pendingRestore.id)
        }
        title={
          pendingRestore
            ? `Restore v${pendingRestore.version} as the current version?`
            : 'Restore version?'
        }
        message="The current draft is replaced with this version's content. You can tweak before navigating away — the restore is already saved."
        confirmLabel={rollback.isPending ? 'Restoring…' : 'Restore'}
        isPending={rollback.isPending}
      />
    </>
  );
}
