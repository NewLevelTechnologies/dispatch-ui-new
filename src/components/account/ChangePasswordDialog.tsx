import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { updatePassword } from 'aws-amplify/auth';
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from '../catalyst/dialog';
import { Button } from '../catalyst/button';
import { Field, FieldGroup, Label } from '../catalyst/fieldset';
import { Input } from '../catalyst/input';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordDialog({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirm('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await updatePassword({ oldPassword, newPassword });
    },
    onSuccess: () => {
      reset();
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || t('account.changePasswordDialog.errorGeneric'));
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError(t('account.changePasswordDialog.tooShort'));
      return;
    }
    if (newPassword !== confirm) {
      setError(t('account.changePasswordDialog.mismatch'));
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} size="md">
      <DialogTitle>{t('account.changePasswordDialog.title')}</DialogTitle>
      <DialogDescription>{t('account.changePasswordDialog.description')}</DialogDescription>
      <form onSubmit={submit}>
        <DialogBody>
          <FieldGroup>
            <Field>
              <Label>{t('account.changePasswordDialog.currentPassword')}</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Label>{t('account.changePasswordDialog.newPassword')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Label>{t('account.changePasswordDialog.confirmPassword')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          {error && (
            <div className="mt-3 rounded-md border border-danger-500/30 bg-danger-500/8 px-3 py-2 text-[12px] text-danger-500">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain type="button" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('account.changePasswordDialog.submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
