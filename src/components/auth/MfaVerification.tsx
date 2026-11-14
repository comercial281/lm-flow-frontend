import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Button,
  Input,
  Label,
  Alert,
  AlertDescription,
  Checkbox,
} from '@/components/ui/ds';
import { Shield, Smartphone, Mail, RefreshCw, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import { AppLogo } from '@/components/AppLogo';
import { pareceCodigoReserva } from '@/features/auth/mfaTrust';

interface MfaVerificationProps {
  email: string;
  method: 'totp' | 'email';
  tempToken: string;
  onVerificationSuccess: (code: string, trustDevice: boolean) => Promise<void>;
  onResendEmailCode?: () => Promise<void>;
  onBack?: () => void;
  isLoading?: boolean;
}

type ApiError = {
  response?: {
    status?: number;
    data?: { attempts_remaining?: number; error?: { message?: string } };
  };
};

// Segunda etapa do login (o servidor já aceitou a senha). O código é o do e-mail
// ou o do aplicativo; quem usa o aplicativo pode trocar por um código reserva.
const MfaVerification = ({
  email,
  method,
  onVerificationSuccess,
  onResendEmailCode,
  onBack,
  isLoading = false,
}: MfaVerificationProps) => {
  const { t } = useLanguage('auth');
  const [code, setCode] = useState('');
  const [usingBackup, setUsingBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = isLoading || submitting;
  // O e-mail sai na hora do login: o primeiro reenvio espera o mesmo minuto.
  const [resendCooldown, setResendCooldown] = useState(method === 'email' ? 60 : 0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const isTotpMethod = method === 'totp';
  const codeReady = usingBackup ? pareceCodigoReserva(code) : code.length === 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeReady) {
      toast.error(usingBackup ? t('auth.mfa.backup.complete') : t('auth.mfa.code.complete'));
      return;
    }

    setSubmitting(true);
    try {
      await onVerificationSuccess(code, trustDevice);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      const status = apiError.response?.status;
      const remaining = apiError.response?.data?.attempts_remaining;
      if (remaining !== undefined) setRemainingAttempts(remaining);

      if (status === 423) {
        setLocked(true);
        toast.error(t('auth.mfa.accountLocked'));
      } else if (remaining !== undefined) {
        toast.error(t('auth.mfa.code.invalid', { remaining }));
      } else {
        toast.error(apiError.response?.data?.error?.message || t('auth.mfa.sendError'));
      }
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!onResendEmailCode || resendCooldown > 0) return;

    try {
      await onResendEmailCode();
      setResendCooldown(60);
      toast.success(t('auth.mfa.email.codeSent'));
    } catch (error: unknown) {
      const apiError = error as ApiError;
      if (apiError.response?.status === 429) {
        toast.error(t('auth.mfa.email.waitBeforeResend'));
      } else {
        toast.error(apiError.response?.data?.error?.message || t('auth.mfa.sendError'));
      }
    }
  };

  const handleCodeChange = (value: string) => {
    if (usingBackup) {
      setCode(value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 9));
    } else {
      setCode(value.replace(/\D/g, '').slice(0, 6));
    }
  };

  const toggleBackup = () => {
    setUsingBackup((v) => !v);
    setCode('');
  };

  const description = usingBackup
    ? t('auth.mfa.backup.description')
    : isTotpMethod
      ? t('auth.mfa.totp.description')
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-t from-primary/20 via-background/95 to-background relative">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <AppLogo className="h-10 mx-auto" />
        </div>

        <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-6 shadow-lg">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
              {usingBackup ? (
                <KeyRound className="h-6 w-6 text-primary" />
              ) : isTotpMethod ? (
                <Smartphone className="h-6 w-6 text-primary" />
              ) : (
                <Mail className="h-6 w-6 text-primary" />
              )}
            </div>
            <h2 className="text-2xl font-bold">{t('auth.mfa.title')}</h2>
            <p className="text-muted-foreground mt-2">
              {description ?? (
                <>
                  {t('auth.mfa.email.description')} <strong>{email}</strong>
                </>
              )}
            </p>
          </div>

          <div className="space-y-6">
            {(locked || (remainingAttempts !== null && remainingAttempts <= 5)) && (
              <Alert variant="destructive">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  {locked
                    ? t('auth.mfa.accountLocked')
                    : t('auth.mfa.remainingAttempts', { count: remainingAttempts ?? 0 })}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="verification-code">
                  {usingBackup ? t('auth.mfa.backup.label') : t('auth.mfa.code.label')}
                </Label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode={usingBackup ? 'text' : 'numeric'}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder={usingBackup ? 'xxxx-xxxx' : t('auth.mfa.code.placeholder')}
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={usingBackup ? 9 : 6}
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  autoFocus
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={trustDevice}
                  onCheckedChange={(v) => setTrustDevice(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">{t('auth.mfa.trustDevice')}</span>
              </label>

              <Button type="submit" disabled={busy || locked || !codeReady} className="w-full" size="lg">
                {busy ? t('auth.mfa.verifying') : t('auth.mfa.verify')}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-1">
              {method === 'email' && !usingBackup && onResendEmailCode && (
                <Button
                  variant="link"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || busy}
                  className="text-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {resendCooldown > 0
                    ? t('auth.mfa.email.resendIn', { seconds: resendCooldown })
                    : t('auth.mfa.email.resendButton')}
                </Button>
              )}

              {isTotpMethod && (
                <Button variant="link" onClick={toggleBackup} disabled={busy} className="text-sm">
                  <KeyRound className="h-4 w-4 mr-2" />
                  {usingBackup ? t('auth.mfa.backup.useApp') : t('auth.mfa.backup.useBackup')}
                </Button>
              )}

              {onBack && (
                <Button variant="ghost" onClick={onBack} disabled={busy} className="text-sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('auth.mfa.backToLogin')}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {usingBackup ? t('auth.mfa.help.backup') : isTotpMethod ? t('auth.mfa.help.totp') : t('auth.mfa.help.email')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MfaVerification;
