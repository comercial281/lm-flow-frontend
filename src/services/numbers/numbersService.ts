import api from '@/services/core/api';
import apiAuth from '@/services/core/apiAuth';
import { extractData } from '@/utils/apiHelpers';
import type { MyNumbers, NumberCardData, OwnedNumber } from '@/features/numbers/types';

/**
 * DONO DO NÚMERO (fase 2b.1) — o número "com cara" em Canais e os "Números de
 * atendimento" de uma pessoa (Perfil e Equipe).
 *
 * Backend: GET /inboxes/:id/number_card (inboxes.read), GET /profile/numbers,
 * PATCH /profile/primary_number, PATCH /users/:id/primary_number (users.update).
 * Quem decide dono e principal é o servidor; a tela só mostra e pede a troca.
 */
function myNumbersFrom(data: Partial<MyNumbers> | null | undefined): MyNumbers {
  return {
    number_owner_rule: typeof data?.number_owner_rule === 'boolean' ? data.number_owner_rule : null,
    numbers: Array.isArray(data?.numbers) ? data!.numbers : [],
  };
}

const numbersService = {
  async numberCard(inboxId: string): Promise<NumberCardData> {
    const res = await api.get(`/inboxes/${inboxId}/number_card`);
    return extractData<NumberCardData>(res);
  },

  async myNumbers(): Promise<MyNumbers> {
    const res = await apiAuth.get('/profile/numbers');
    return myNumbersFrom(extractData<MyNumbers>(res));
  },

  async setMyPrimary(inboxId: string): Promise<MyNumbers> {
    const res = await apiAuth.patch('/profile/primary_number', { inbox_id: inboxId });
    return myNumbersFrom(extractData<MyNumbers>(res));
  },

  async setUserPrimary(userId: string, inboxId: string): Promise<OwnedNumber[]> {
    const res = await apiAuth.patch(`/users/${userId}/primary_number`, { inbox_id: inboxId });
    const data = extractData<{ numbers?: OwnedNumber[] }>(res);
    return Array.isArray(data?.numbers) ? data.numbers : [];
  },
};

export default numbersService;
