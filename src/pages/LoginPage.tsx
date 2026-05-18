import { Authenticator } from '@aws-amplify/ui-react';
import { signIn, type SignInInput } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';

// Forward the browser User-Agent to Cognito via ClientMetadata so the
// backend's sign-in activity tracking can attribute the event to a
// device. Without this hook the prebuilt Authenticator never sets
// ClientMetadata and UA arrives at the backend as null.
const services = {
  async handleSignIn(input: SignInInput) {
    return signIn({
      ...input,
      options: {
        ...input.options,
        clientMetadata: {
          ...input.options?.clientMetadata,
          userAgent: navigator.userAgent,
        },
      },
    });
  },
};

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t('app.name')}</h1>
          <p className="mt-2 text-gray-600">{t('auth.signInPrompt')}</p>
        </div>
        <Authenticator services={services} />
      </div>
    </div>
  );
}
