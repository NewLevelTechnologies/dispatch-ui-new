import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../test/utils';
import TwoFactorSetupDialog from './TwoFactorSetupDialog';
import { setUpTOTP, updateMFAPreference, verifyTOTPSetup } from 'aws-amplify/auth';

vi.mock('aws-amplify/auth', () => ({
  setUpTOTP: vi.fn(),
  updateMFAPreference: vi.fn(),
  verifyTOTPSetup: vi.fn(),
}));

// qrcode.react reads canvas APIs jsdom doesn't ship — render a placeholder.
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr-svg" data-value={value} />
  ),
}));

// The global react-i18next mock in src/test/setup.ts hands back a brand-new
// `t` function on every render, which makes any useEffect that lists `t` in
// its dependency array re-run forever. TwoFactorSetupDialog resets `step` in
// such an effect, so without a stable `t` the wizard snaps back to step 1
// after every state change. Override the mock with a stable `t` here.
vi.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    let out = key;
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }
    return out;
  };
  return {
    useTranslation: () => ({
      t,
      i18n: { changeLanguage: () => new Promise(() => {}) },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});

function makeSetupResult(secret = 'JBSWY3DPEHPK3PXP') {
  return {
    sharedSecret: secret,
    getSetupUri: vi.fn(() => new URL(`otpauth://totp/Dispatch:test@example.com?secret=${secret}`)),
  };
}

describe('TwoFactorSetupDialog', () => {
  const onClose = vi.fn();
  const onEnabled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the TOTP setup URI on open and renders the QR code', async () => {
    vi.mocked(setUpTOTP).mockResolvedValue(makeSetupResult() as never);

    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={true}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );

    await waitFor(() => {
      expect(setUpTOTP).toHaveBeenCalled();
    });
    expect(await screen.findByTestId('qr-svg')).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
  });

  it('shows an error message when the TOTP setup call fails', async () => {
    vi.mocked(setUpTOTP).mockRejectedValue(new Error('boom'));

    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={true}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );

    const matches = await screen.findAllByText('boom');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('copies the secret to the clipboard when the copy button is clicked', async () => {
    vi.mocked(setUpTOTP).mockResolvedValue(makeSetupResult() as never);

    // userEvent.setup() installs its own clipboard mock — override it after.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={true}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );

    await screen.findByTestId('qr-svg');
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
  });

  it('advances to the verify step when continue is clicked, then back returns to qr', async () => {
    vi.mocked(setUpTOTP).mockResolvedValue(makeSetupResult() as never);

    const user = userEvent.setup();
    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={true}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );

    await screen.findByTestId('qr-svg');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('group', { name: /verifyTitle/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(await screen.findByTestId('qr-svg')).toBeInTheDocument();
  });

  it('verifies the code, enables MFA, and notifies the parent on success', async () => {
    vi.mocked(setUpTOTP).mockResolvedValue(makeSetupResult() as never);
    vi.mocked(verifyTOTPSetup).mockResolvedValue(undefined);
    vi.mocked(updateMFAPreference).mockResolvedValue(undefined as never);

    const user = userEvent.setup();
    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={true}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );

    await screen.findByTestId('qr-svg');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // OtpInput emits onComplete when the 6 digits land — paste fills all boxes.
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    await user.click(inputs[0]);
    await user.paste('123456');

    await waitFor(() => {
      expect(verifyTOTPSetup).toHaveBeenCalledWith({ code: '123456' });
    });
    await waitFor(() => {
      expect(updateMFAPreference).toHaveBeenCalledWith({ totp: 'PREFERRED' });
    });
    expect(onEnabled).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a verify error and keeps the dialog open when the code is wrong', async () => {
    vi.mocked(setUpTOTP).mockResolvedValue(makeSetupResult() as never);
    vi.mocked(verifyTOTPSetup).mockRejectedValue(new Error('Invalid code'));

    const user = userEvent.setup();
    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={true}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );

    await screen.findByTestId('qr-svg');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    await user.click(inputs[0]);
    await user.paste('000000');

    expect(await screen.findByText('Invalid code')).toBeInTheDocument();
    expect(onEnabled).not.toHaveBeenCalled();
    expect(updateMFAPreference).not.toHaveBeenCalled();
  });

  it('cancels from the qr step via the cancel button', async () => {
    vi.mocked(setUpTOTP).mockResolvedValue(makeSetupResult() as never);

    const user = userEvent.setup();
    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={true}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );

    await screen.findByTestId('qr-svg');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does nothing when isOpen is false', () => {
    renderWithProviders(
      <TwoFactorSetupDialog
        isOpen={false}
        onClose={onClose}
        onEnabled={onEnabled}
        email="test@example.com"
      />,
    );
    expect(setUpTOTP).not.toHaveBeenCalled();
  });
});
