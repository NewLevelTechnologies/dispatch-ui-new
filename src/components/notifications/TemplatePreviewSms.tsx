// SMS preview — phone-shaped frame with a single chat bubble. The bubble's
// asymmetric corner radius (sharp on the lower-left) reads as the incoming
// side of an iMessage / RCS conversation.

import { renderWithHighlights } from '../../lib/templateEditor';

type Props = {
  body: string;
  sample: Record<string, string>;
  fromLabel?: string;
};

export function TemplatePreviewSms({
  body,
  sample,
  fromLabel = 'Pinecrest HVAC',
}: Props) {
  return (
    <div className="flex justify-center rounded-lg bg-bg-elev-2 p-4">
      <div
        className="w-[290px] rounded-[28px] border border-border bg-bg-elev p-3.5"
        style={{ boxShadow: 'inset 0 0 0 1px var(--border-soft)' }}
      >
        <div className="flex justify-center pb-2 text-[10px] uppercase tracking-wider text-fg-dim">
          {fromLabel}
        </div>
        <div
          className="max-w-[80%] whitespace-pre-wrap break-words bg-info-500/14 px-3 py-2 text-[12.5px] leading-[1.5] text-fg"
          style={{ borderRadius: '14px 14px 14px 4px' }}
        >
          {renderWithHighlights(body, sample)}
        </div>
      </div>
    </div>
  );
}
