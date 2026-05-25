/* eslint-disable i18next/no-literal-string -- dense visual form; primary copy stays inline. Translation pass lives in a follow-up. */
// Email channel editor: Subject card + Body card with Plain/HTML toggle.
// Variable strip lives under each editor field so the chips stay close
// to the cursor they'll insert into.

import { useMemo, useRef, useState } from 'react';
import { Card } from '../catalyst/card';
import { Field } from '../catalyst/fieldset';
import { Input } from '../catalyst/input';
import { Textarea } from '../catalyst/textarea';
import { ToggleGroup, ToggleGroupOption } from '../ui/ToggleGroup';
import { VariableStrip } from './VariableStrip';
import { insertAtCursor, variablesForScope } from '../../lib/templateEditor';
import type { NotificationTemplateVariable } from '../../api';

export type EmailEditorForm = {
  subject: string;
  bodyTemplate: string;
  htmlBodyTemplate: string;
};

type Props = {
  form: EmailEditorForm;
  onChange: (next: EmailEditorForm) => void;
  variables: NotificationTemplateVariable[] | undefined;
};

type BodyTab = 'plain' | 'html';

export function TemplateEditorEmail({ form, onChange, variables }: Props) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [bodyTab, setBodyTab] = useState<BodyTab>('plain');

  const subjectChips = useMemo(
    () => variablesForScope(variables, 'SUBJECT'),
    [variables]
  );
  const bodyChips = useMemo(
    () => variablesForScope(variables, 'BODY'),
    [variables]
  );

  const update = (patch: Partial<EmailEditorForm>) => {
    onChange({ ...form, ...patch });
  };

  return (
    <>
      <Card
        title="Subject"
        subtitle="Required. Shows in the recipient's inbox list."
        className="mb-3"
      >
        <Field size="xs">
          <Input
            size="xs"
            value={form.subject}
            onChange={(e) => update({ subject: e.target.value })}
            ref={subjectRef}
            aria-label="Subject"
          />
        </Field>
        <VariableStrip
          hint="Insert variable"
          chips={subjectChips}
          onInsert={(name) =>
            insertAtCursor(subjectRef, name, (next) =>
              update({ subject: next })
            )
          }
        />
      </Card>

      <Card
        title="Body"
        subtitle="Plain-text fallback below. Add an HTML version if you want richer formatting."
        action={
          <ToggleGroup
            value={bodyTab}
            onChange={setBodyTab}
            aria-label="Body format"
          >
            <ToggleGroupOption value="plain">Plain text</ToggleGroupOption>
            <ToggleGroupOption value="html">HTML</ToggleGroupOption>
          </ToggleGroup>
        }
        className="mb-3"
      >
        <Field size="xs">
          <Textarea
            ref={bodyRef}
            rows={12}
            className="font-mono text-[12px] leading-[1.55]"
            value={
              bodyTab === 'plain' ? form.bodyTemplate : form.htmlBodyTemplate
            }
            onChange={(e) =>
              update(
                bodyTab === 'plain'
                  ? { bodyTemplate: e.target.value }
                  : { htmlBodyTemplate: e.target.value }
              )
            }
            aria-label={bodyTab === 'plain' ? 'Plain-text body' : 'HTML body'}
          />
        </Field>
        <VariableStrip
          hint="Insert variable"
          chips={bodyChips}
          onInsert={(name) =>
            insertAtCursor(bodyRef, name, (next) =>
              update(
                bodyTab === 'plain'
                  ? { bodyTemplate: next }
                  : { htmlBodyTemplate: next }
              )
            )
          }
        />
      </Card>
    </>
  );
}
