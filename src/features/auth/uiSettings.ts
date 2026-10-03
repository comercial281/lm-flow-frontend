// ── GRAVAR ui_settings SEM APAGAR AS OUTRAS CHAVES ───────────────────────────
// O servidor TROCA o ui_settings inteiro a cada PUT /profile. Mandar só a
// chave que mudou apaga as outras (tamanho da fonte, tecla de envio, a data
// em que a pessoa viu as Novas captações...). Todo mundo grava por aqui: junta
// o que já está no usuário com a mudança e manda o objeto inteiro.
import { profileService } from '@/services/profile/profileService';
import { useAuthStore } from '@/store/authStore';
import type { UISettings } from '@/types/auth';

export async function salvarUISettings(mudanca: Partial<UISettings>): Promise<void> {
  const { currentUser, updateUISettings } = useAuthStore.getState();
  const inteiro = { ...(currentUser?.ui_settings ?? {}), ...mudanca };
  updateUISettings(mudanca);
  await profileService.updateUISettings(inteiro);
}
