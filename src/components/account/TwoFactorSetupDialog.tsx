import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { setUpTOTP, updateMFAPreference, verifyTOTPSetup } from 'aws-amplify/auth';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog } from '../catalyst/dialog';
import { Button } from '../catalyst/button';
import { ErrorMessage } from '../catalyst/fieldset';
import { Callout } from '../ui/Callout';
import { OtpInput, type OtpInputHandle } from '../ui/OtpInput';
import { WizardHeader } from '../ui/WizardHeader';
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
  const [code, setCode] = useState<string>('');
  const [verifyError, setVerifyError] = useState<string>('');
  const [setupError, setSetupError] = useState<string>('');

  const otpRef = useRef<OtpInputHandle>(null);

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
    setCode('');
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
      setCode('');
      otpRef.current?.focus();
    },
  });

  const codeReady = code.length === 6;

  const submitCode = () => {
    if (!codeReady || enableMutation.isPending) return;
    setVerifyError('');
    enableMutation.mutate(code);
  };

  // Step-pip indicator. 2 steps for now; expands when method picker +
  // recovery codes land.
  const totalSteps = 2;
  const stepIndex = step === 'qr' ? 1 : 2;

  return (
    <Dialog open={isOpen} onClose={onClose} size="md" padding="none">
      <div>
        <WizardHeader
          title={t('account.twoFactorSetup.title')}
          icon={<ShieldCheckIcon className="size-3" />}
          step={stepIndex}
          totalSteps={totalSteps}
        />

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

            <Callout
              kind="neutral"
              icon={null}
              className="mt-4"
              title={
                <span className="text-[10.5px] font-semibold tracking-wider text-fg-muted uppercase">
                  {t('account.twoFactorSetup.manualLabel')}
                </span>
              }
              action={
                <Button
                  outline
                  size="xs"
                  type="button"
                  onClick={() => secret && navigator.clipboard.writeText(secret).catch(() => {})}
                  disabled={!secret}
                >
                  {t('account.twoFactorSetup.copy')}
                </Button>
              }
            >
              <code className="block truncate font-mono text-[12px] tracking-wider text-fg-strong">
                {secret || '••••••••••••••••'}
              </code>
            </Callout>

            {setupError && (
              <ErrorMessage size="xs" className="mt-3">
                {setupError}
              </ErrorMessage>
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
              <OtpInput
                ref={otpRef}
                length={6}
                value={code}
                onChange={setCode}
                onComplete={(v) => {
                  if (!enableMutation.isPending) {
                    setVerifyError('');
                    enableMutation.mutate(v);
                  }
                }}
                autoFocus
                ariaLabel={t('account.twoFactorSetup.verifyTitle')}
              />
            </div>

            {verifyError && (
              <ErrorMessage size="xs" className="mt-4 text-center">
                {verifyError}
              </ErrorMessage>
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
