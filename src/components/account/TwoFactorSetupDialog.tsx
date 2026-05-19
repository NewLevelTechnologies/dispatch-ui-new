import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { setUpTOTP, updateMFAPreference, verifyTOTPSetup } from 'aws-amplify/auth';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog } from '../catalyst/dialog';
import { Button } from '../catalyst/button';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

// Phase 1: TOTP-only wizard, Amplify-direct. When backend ships
// /auth/2fa/* endpoints, we add a step 1 method picker (TOTP/SMS/Email)
// in front of this, plus a step 3 for server-issued recovery codes.

type Step = 'qr' | 'verify';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEnabled: () => void;
  email: string;
}

export default function TwoFactorSetupDialog({ isOpen, onClose, onEnabled, email }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('qr');
  const [setupUri, setSetupUri] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [verifyError, setVerifyError] = useState<string>('');
  const [setupError, setSetupError] = useState<string>('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Kick off Amplify TOTP setup when the dialog opens. setUpTOTP returns
  // a sharedSecret + a getSetupUri helper that produces the otpauth:// URI
  // the QR encodes. We keep both around — QR for scan, secret for manual.
  // The state resets here mirror the dialog's open/close lifecycle —
  // intentionally inside the effect so the wizard always starts at step 1
  // with a fresh secret when reopened.
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep('qr');
    setCode(['', '', '', '', '', '']);
    setVerifyError('');
    setSetupError('');
    setSetupUri('');
    setSecret('');

    let cancelled = false;
    (async () => {
      try {
        const details = await setUpTOTP();
        if (cancelled) return;
        setSecret(details.sharedSecret);
        // Cognito's issuer label defaults to "AWSCognito"; override so the
        // app name shows up in the user's authenticator.
        setSetupUri(details.getSetupUri('Dispatch', email).toString());
      } catch (err) {
        if (cancelled) return;
        setSetupError(err instanceof Error ? err.message : t('account.twoFactorSetup.errorStart'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, email, t]);

  const enableMutation = useMutation({
    mutationFn: async (totpCode: string) => {
      await verifyTOTPSetup({ code: totpCode });
      await updateMFAPreference({ totp: 'PREFERRED' });
    },
    onSuccess: () => {
      onEnabled();
      onClose();
    },
    onError: (err: Error) => {
      setVerifyError(err.message || t('account.twoFactorSetup.errorVerify'));
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    },
  });

  const handleDigit = (idx: number, value: string) => {
    // Paste of full code into first box: split it across the boxes.
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...code];
      for (let i = 0; i < 6; i++) next[i] = digits[i] ?? '';
      setCode(next);
      const lastFilled = Math.min(digits.length, 6) - 1;
      if (lastFilled >= 0 && lastFilled < 5) inputRefs.current[lastFilled + 1]?.focus();
      else inputRefs.current[5]?.blur();
      return;
    }
    const digit = value.replace(/\D/g, '').slice(0, 1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const fullCode = code.join('');
  const codeReady = fullCode.length === 6;

  const submitCode = () => {
    if (!codeReady || enableMutation.isPending) return;
    setVerifyError('');
    enableMutation.mutate(fullCode);
  };

  // Step-pip indicator. 2 steps for now; expands when method picker +
  // recovery codes land.
  const totalSteps = 2;
  const stepIndex = step === 'qr' ? 1 : 2;

  return (
    <Dialog open={isOpen} onClose={onClose} size="md" className="!p-0">
      <div className="overflow-hidden rounded-2xl">
        {/* Header with step pips */}
        <div className="flex items-center justify-between border-b border-border-soft bg-bg-elev-2 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-[22px] place-items-center rounded-[5px] bg-accent-500 text-white">
              <ShieldCheckIcon className="size-3" />
            </span>
            <span className="text-[12.5px] font-semibold text-fg-strong">
              {t('account.twoFactorSetup.title')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const pos = i + 1;
              const active = pos === stepIndex;
              const done = pos < stepIndex;
              return (
                <span
                  key={i}
                  className={`h-[6px] rounded-[3px] transition-[width] duration-200 ${
                    active || done ? 'bg-accent-500' : 'bg-bg-active'
                  }`}
                  style={{ width: active ? 18 : 6 }}
                />
              );
            })}
            <span className="ml-2 text-[10.5px] text-fg-dim">
              {stepIndex}/{totalSteps}
            </span>
          </div>
        </div>

        {/* Body */}
        {step === 'qr' ? (
          <div className="px-6 pt-5 pb-4">
            <h2 className="text-[15px] font-bold tracking-tight text-fg-strong">
              {t('account.twoFactorSetup.qrTitle')}
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">
              {t('account.twoFactorSetup.qrDescription')}
            </p>

            <div className="mt-4 flex justify-center">
              <div className="rounded-lg border border-border-soft bg-white p-3">
                {setupUri ? (
                  <QRCodeSVG value={setupUri} size={180} level="M" />
                ) : (
                  <div className="grid size-[180px] place-items-center text-[11px] text-fg-dim">
                    {setupError || t('account.twoFactorSetup.loading')}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-md border border-border-soft bg-bg-elev-2 px-3 py-2.5">
              <div className="mb-1 text-[10.5px] font-semibold text-fg-muted">
                {t('account.twoFactorSetup.manualLabel')}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-[12px] tracking-wider text-fg-strong">
                  {secret || '••••••••••••••••'}
                </code>
                <Button
                  outline
                  type="button"
                  onClick={() => secret && navigator.clipboard.writeText(secret).catch(() => {})}
                  disabled={!secret}
                >
                  {t('account.twoFactorSetup.copy')}
                </Button>
              </div>
            </div>

            {setupError && (
              <div className="mt-3 rounded-md border border-danger-500/30 bg-danger-500/8 px-3 py-2 text-[12px] text-danger-500">
                {setupError}
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 pt-5 pb-4">
            <h2 className="text-[15px] font-bold tracking-tight text-fg-strong">
              {t('account.twoFactorSetup.verifyTitle')}
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">
              {t('account.twoFactorSetup.verifyDescription')}
            </p>

            <div className="mt-5 flex justify-center">
              <div className="flex gap-1.5">
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={i === 0 ? 6 : 1}
                    value={d}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="h-[50px] w-[42px] rounded-md border-[1.5px] border-border bg-bg-elev text-center font-mono text-[22px] font-semibold text-fg-strong outline-none focus:border-accent-500 focus:ring-3 focus:ring-accent-500/20"
                  />
                ))}
              </div>
            </div>

            {verifyError && (
              <div className="mt-4 rounded-md border border-danger-500/30 bg-danger-500/8 px-3 py-2 text-center text-[12px] text-danger-500">
                {verifyError}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-soft px-5 py-3">
          {step === 'qr' ? (
            <>
              <Button plain type="button" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => setStep('verify')} disabled={!setupUri}>
                {t('account.twoFactorSetup.continue')}
              </Button>
            </>
          ) : (
            <>
              <Button plain type="button" onClick={() => setStep('qr')}>
                {t('account.twoFactorSetup.back')}
              </Button>
              <Button type="button" onClick={submitCode} disabled={!codeReady || enableMutation.isPending}>
                {enableMutation.isPending
                  ? t('account.twoFactorSetup.verifyPending')
                  : t('account.twoFactorSetup.verify')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
