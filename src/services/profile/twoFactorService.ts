import authApi from '@/services/core/apiAuth';
import { extractData } from '@/utils/apiHelpers';
import type {
  EnableTwoFactorResponse,
  VerifyResponse,
  BackupCodesResponse,
} from '@/types/users';

class TwoFactorService {
  async enable(method: 'totp' | 'email'): Promise<EnableTwoFactorResponse> {
    const endpoint = method === 'totp' ? '/mfa/setup_totp' : '/mfa/setup_email_otp';
    const response = await authApi.post(endpoint);
    const data = extractData<any>(response);

    // Aplicativo: o servidor manda o segredo e o endereço `otpauth://`; o QR Code é
    // desenhado na tela (nunca HTML vindo do servidor).
    return data;
  }

  /** Zera a verificação de outra pessoa (perdeu o celular). Só admin; o servidor confere. */
  async resetForUser(userId: string): Promise<void> {
    await authApi.post(`/users/${userId}/reset_mfa`);
  }

  async verify(code: string, method: 'totp' | 'email', setup?: boolean): Promise<VerifyResponse> {
    const endpoint = method === 'totp' ? '/mfa/verify_totp' : '/mfa/verify_email_otp';
    const response = await authApi.post(endpoint, { code, setup });
    return extractData<any>(response);
  }

  async disable(): Promise<{ success: boolean; message: string }> {
    const response = await authApi.post('/mfa/disable');
    return extractData<any>(response);
  }

  async regenerateBackupCodes(): Promise<BackupCodesResponse> {
    const response = await authApi.post('/mfa/regenerate_backup_codes');
    return extractData<any>(response);
  }

  async sendEmailCode(): Promise<{ success: boolean; message: string }> {
    const response = await authApi.post('/mfa/setup_email_otp');
    return extractData<any>(response);
  }
}

export const twoFactorService = new TwoFactorService();
