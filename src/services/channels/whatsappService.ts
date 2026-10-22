import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type { WhatsappConfig, WhatsappChannel } from '@/types/channels/inbox';

class WhatsappService {
  async validateCredentials(config: WhatsappConfig): Promise<{ valid: boolean; message?: string }> {
    const response = await api.post(`/channels/whatsapp/validate`, config);
    return extractData<any>(response);
  }

  async createChannel(config: WhatsappConfig & { name: string }): Promise<WhatsappChannel> {
    const response = await api.post(`/channels/whatsapp`, config);
    return extractData<any>(response);
  }

  async getWebhookUrl(channelId: string): Promise<{ webhook_url: string }> {
    const response = await api.get(`/channels/${channelId}/webhook_url`);
    return extractData<any>(response);
  }

  async updateChannel(
    channelId: string,
    config: Partial<WhatsappConfig>,
  ): Promise<WhatsappChannel> {
    const response = await api.patch(`/channels/${channelId}`, config);
    return extractData<any>(response);
  }

  // API oficial: o servidor troca o código pelo acesso e cria o canal. O token nunca chega aqui.
  async connectCloud(payload: {
    code: string;
    phone_number_id: string;
    waba_id: string;
    business_id: string;
    mode: 'coexistence' | 'new_number';
    inbox_id?: string;
  }): Promise<{
    inbox_id: string;
    name: string;
    phone_number: string;
    verified_name: string;
    message?: string;
  }> {
    const response = await api.post(`/whatsapp/cloud_connections`, payload);
    return extractData<any>(response);
  }

  // Ainda usado por AuthorizationBanners (sai na F2).
  async createWhatsappCloudChannel(payload: {
    user_access_token: string;
    waba_id: string;
    phone_number_id: string;
  }) {
    const response = await api.post(`/whatsapp/cloud/setup`, payload);
    return extractData<any>(response);
  }
}

export default new WhatsappService();
