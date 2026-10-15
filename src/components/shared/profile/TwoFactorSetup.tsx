import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Alert,
  AlertDescription,
  Badge,
} from '@/components/ui/ds';
import { Shield, AlertTriangle, Check, Copy, RefreshCw } from 'lucide-react';
import Aviso from '@/components/base/Aviso';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { toast } from 'sonner';
import { twoFactorService } from '@/services/profile/twoFactorService';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/contexts/AuthContext';

interface TwoFactorSetupProps {
  onUpdate?: () => void;
}

const TwoFactorSetup = ({ onUpdate }: TwoFactorSetupProps) => {
  const { t } = useLanguage('profile');
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const mfaEnabled = user?.mfa_enabled ?? false;

  // Setup state
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'email'>('totp');
  const [setupStep, setSetupStep] = useState<'method' | 'configure' | 'verify' | 'backup'>('method');

  // TOTP setup
  const [qrCode, setQrCode] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Verification
  const [verificationCode, setVerificationCode] = useState('');

  // Disable dialog
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  const handleEnableMfa = async () => {
    setIsLoading(true);
    try {
      const response = await twoFactorService.enable(selectedMethod);

      if (selectedMethod === 'totp') {
        setQrCode(response.qr_code || '');
        setSecretKey(response.secret || '');
        setBackupCodes(response.backup_codes || []);
        setSetupStep('configure');
      } else {
        setSetupStep('verify');
        toast.success(t('twoFactor.notifications.emailCodeSent'));
      }
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 401) {
        toast.error(t('twoFactor.notifications.passwordIncorrect'));
      } else {
        toast.error(t('twoFactor.notifications.enableError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      toast.error(t('twoFactor.verify.errors.invalidCode'));
      return;
    }

    setIsLoading(true);
    try {
      await twoFactorService.verify(verificationCode, selectedMethod, true);

      if (selectedMethod === 'totp' && backupCodes.length > 0) {
        setSetupStep('backup');
      } else {
        toast.success(t('twoFactor.notifications.enabled'));
        setSetupDialogOpen(false);
        resetSetupState();
        onUpdate?.();
      }
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { attempts_remaining?: number } } };
      const attemptsRemaining = apiError.response?.data?.attempts_remaining;
      if (attemptsRemaining !== undefined) {
        toast.error(t('twoFactor.verify.errors.attemptsRemaining', { attempts: attemptsRemaining }));
      } else {
        toast.error(t('twoFactor.verify.errors.invalidCode'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    setIsLoading(true);
    try {
      await twoFactorService.disable();
      toast.success(t('twoFactor.notifications.disabled'));
      setDisableDialogOpen(false);
      onUpdate?.();
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 401) {
        toast.error(t('twoFactor.notifications.passwordIncorrect'));
      } else {
        toast.error(t('twoFactor.notifications.disableError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setIsLoading(true);
    try {
      const response = await twoFactorService.regenerateBackupCodes();
      setBackupCodes(response.backup_codes);
      setSetupStep('backup');
      setSetupDialogOpen(true);
      toast.success(t('twoFactor.backupCodes.regenerated'));
    } catch {
      toast.error(t('twoFactor.notifications.backupCodesError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmailCode = async () => {
    setIsLoading(true);
    try {
      await twoFactorService.sendEmailCode();
      toast.success(t('twoFactor.notifications.emailCodeResent'));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 429) {
        toast.error(t('twoFactor.notifications.emailCodeRateLimit'));
      } else {
        toast.error(t('twoFactor.notifications.emailCodeError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('accessToken.notifications.copied'));
    } catch {
      toast.error(t('accessToken.notifications.copyError'));
    }
  };

  const copyAllBackupCodes = async () => {
    const codesText = backupCodes.join('\n');
    await copyToClipboard(codesText);
  };

  const resetSetupState = () => {
    setSetupStep('method');
    setVerificationCode('');
    setQrCode('');
    setSecretKey('');
    setBackupCodes([]);
    setSelectedMethod('totp');
  };

  const renderSetupDialog = () => {
    switch (setupStep) {
      case 'method':
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t('twoFactor.setup.title')}</DialogTitle>
              <DialogDescription>
                {t('twoFactor.setup.description')}
              </DialogDescription>
            </DialogHeader>
            <GrupoDaJanela titulo={t('twoFactor.groups.method')} className="py-4">
              <CartoesDeEscolha<'totp' | 'email'>
                rotulo={t('twoFactor.setup.methodSelection')}
                valor={selectedMethod}
                aoEscolher={setSelectedMethod}
                colunas={2}
                opcoes={[
                  { valor: 'totp', rotulo: t('twoFactor.setup.totp.title'), descricao: t('twoFactor.setup.totp.description') },
                  { valor: 'email', rotulo: t('twoFactor.setup.email.title'), descricao: t('twoFactor.setup.email.description') },
                ]}
              />
            </GrupoDaJanela>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSetupDialogOpen(false);
                resetSetupState();
              }}>
                {t('twoFactor.setup.actions.cancel')}
              </Button>
              <Button onClick={handleEnableMfa} disabled={isLoading}>
                {isLoading ? t('twoFactor.setup.actions.processing') : t('twoFactor.setup.actions.continue')}
              </Button>
            </DialogFooter>
          </>
        );

      case 'configure':
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t('twoFactor.configure.title')}</DialogTitle>
              <DialogDescription>
                {t('twoFactor.configure.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <GrupoDaJanela titulo={t('twoFactor.groups.qr')}>
                {qrCode ? (
                  <div className="flex justify-center rounded-lg border bg-white p-4">
                    <div
                      dangerouslySetInnerHTML={{ __html: qrCode }}
                      className="flex justify-center items-center"
                      style={{ minHeight: '200px', minWidth: '200px' }}
                    />
                  </div>
                ) : (
                  <Aviso tom="info" titulo={t('twoFactor.configure.qrCodeLoading')}>
                    {t('twoFactor.configure.qrCodeError')}
                  </Aviso>
                )}
              </GrupoDaJanela>

              <GrupoDaJanela titulo={t('twoFactor.groups.manual')}>
                <CampoDaJanela
                  rotulo={t('twoFactor.configure.manualKey')}
                  htmlFor="chave-manual"
                  ajuda={t('twoFactor.configure.manualKeyDescription')}
                >
                  <div className="flex gap-2">
                    <Input
                      id="chave-manual"
                      value={secretKey || ''}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(secretKey)}
                      aria-label="Copiar chave"
                      title="Copiar chave"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CampoDaJanela>
              </GrupoDaJanela>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSetupDialogOpen(false);
                resetSetupState();
              }              }>
                {t('twoFactor.setup.actions.cancel')}
              </Button>
              <Button onClick={() => setSetupStep('verify')}>
                {t('twoFactor.configure.actions.configured')}
              </Button>
            </DialogFooter>
          </>
        );

      case 'verify':
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t('twoFactor.verify.title')}</DialogTitle>
              <DialogDescription>
                {selectedMethod === 'totp'
                  ? t('twoFactor.verify.descriptionTotp')
                  : t('twoFactor.verify.descriptionEmail')}
              </DialogDescription>
            </DialogHeader>
            <GrupoDaJanela titulo={t('twoFactor.groups.verify')} className="py-4">
              <CampoDaJanela rotulo={t('twoFactor.verify.codeLabel')} htmlFor="verification-code">
                <Input
                  id="verification-code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-widest"
                />
              </CampoDaJanela>

              {selectedMethod === 'email' && (
                <Button
                  variant="link"
                  onClick={handleResendEmailCode}
                  disabled={isLoading}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('twoFactor.verify.resendEmail')}
                </Button>
              )}
            </GrupoDaJanela>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetupStep(selectedMethod === 'totp' ? 'configure' : 'method')}>
                {t('twoFactor.verify.actions.back')}
              </Button>
              <Button onClick={handleVerifyCode} disabled={isLoading || verificationCode.length !== 6}>
                {isLoading ? t('twoFactor.verify.actions.verifying') : t('twoFactor.verify.actions.verify')}
              </Button>
            </DialogFooter>
          </>
        );

      case 'backup':
        return (
          <>
            <DialogHeader>
              <DialogTitle>{t('twoFactor.backupCodes.title')}</DialogTitle>
              <DialogDescription>
                {t('twoFactor.backupCodes.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <Aviso tom="atencao">{t('twoFactor.backupCodes.warning')}</Aviso>

              <GrupoDaJanela titulo={t('twoFactor.groups.backup')}>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3.5">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="font-mono text-sm flex items-center gap-2">
                      <span className="text-muted-foreground">{index + 1}.</span>
                      <span>{code}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={copyAllBackupCodes}
                  className="w-full"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t('twoFactor.backupCodes.copyAll')}
                </Button>
              </GrupoDaJanela>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                setSetupDialogOpen(false);
                resetSetupState();
                onUpdate?.();
                toast.success(t('twoFactor.notifications.enabled'));
              }}>
                <Check className="h-4 w-4 mr-2" />
                {t('twoFactor.backupCodes.complete')}
              </Button>
            </DialogFooter>
          </>
        );
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>{t('twoFactor.title')}</CardTitle>
            </div>
            {mfaEnabled && (
              <Badge variant="default">
                {t('twoFactor.status.enabled')}
              </Badge>
            )}
          </div>
          <CardDescription>
            {t('twoFactor.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!mfaEnabled ? (
            <>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  {t('twoFactor.info')}
                </AlertDescription>
              </Alert>
              <Button onClick={() => setSetupDialogOpen(true)}>
                <Shield className="h-4 w-4 mr-2" />
                {t('twoFactor.actions.enable')}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('twoFactor.status.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('twoFactor.status.configured')}
                  </p>
                </div>
                <Badge variant="success">
                  <Check className="h-3 w-3 mr-1" />
                  {t('twoFactor.status.enabled')}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t('twoFactor.backupCodes.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('twoFactor.backupCodes.regenerateDescription')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerateBackupCodes}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('twoFactor.backupCodes.regenerate')}
                </Button>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setDisableDialogOpen(true)}
                >
                  {t('twoFactor.actions.disable')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={(open) => {
        if (!open) resetSetupState();
        setSetupDialogOpen(open);
      }}>
        <DialogContent className="max-w-md">
          {renderSetupDialog()}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('twoFactor.disable.title')}</DialogTitle>
            <DialogDescription>
              {t('twoFactor.disable.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('twoFactor.disable.warning')}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
              {t('twoFactor.disable.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableMfa}
              disabled={isLoading}
            >
              {isLoading ? t('twoFactor.disable.actions.disabling') : t('twoFactor.disable.actions.disable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TwoFactorSetup;
