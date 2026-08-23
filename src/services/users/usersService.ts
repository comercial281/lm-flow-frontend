import apiAuth from '@/services/core/apiAuth';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import type {
  UsersResponse,
  UsersListParams,
  UserUpdateData,
  BulkInviteParams,
  BulkInviteResponse,
  UserFormData,
  User,
} from '@/types/users';

export interface WhatsappSendResult {
  sent: boolean;
  skipped?: string;
  http?: string | number;
  error?: string;
  instance?: string;
}

export interface SendAccessResult {
  user: User;
  whatsapp?: WhatsappSendResult;
}

class UsersService {
  // List users with pagination and filters
  async getUsers(params?: UsersListParams): Promise<UsersResponse> {
    const response = await apiAuth.get('/users', {
      params,
    });

    return extractResponse<User>(response) as UsersResponse;
  }

  // Get single user
  async getUser(userId: string): Promise<User> {
    const response = await apiAuth.get(`/users/${userId}`);
    return extractData<User>(response);
  }

  // Create user (with optional file upload)
  async createUser(userData: UserFormData): Promise<User> {
    const { avatar, ...data } = userData;

    if (avatar) {
      const formData = new FormData();

      // Add basic fields directly (not wrapped in 'user')
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      // Add avatar file
      formData.append('avatar', avatar);

      const response = await apiAuth.post('/users', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return extractData<User>(response);
    } else {
      const response = await apiAuth.post('/users', data);
      return extractData<User>(response);
    }
  }

  // Update user
  async updateUser(userId: string, userData: UserUpdateData): Promise<User> {
    const { avatar, ...data } = userData;

    if (avatar) {
      const formData = new FormData();

      // Add basic fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      // Add avatar file
      formData.append('avatar', avatar);

      const response = await apiAuth.patch(`/users/${userId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return extractData<User>(response);
    } else {
      const response = await apiAuth.patch(`/users/${userId}`, data);
      return extractData<User>(response);
    }
  }

  // Delete user
  async deleteUser(userId: string): Promise<{ message: string }> {
    const response = await apiAuth.delete(`/users/${userId}`);
    return extractData<{ message: string }>(response);
  }

  // Bulk invite users
  async bulkInvite(params: BulkInviteParams): Promise<BulkInviteResponse> {
    const response = await apiAuth.post('/users/bulk_create', params);
    return extractData<BulkInviteResponse>(response);
  }

  // Enviar o acesso (link+login+senha) no WhatsApp da pessoa (tela Equipe)
  async sendAccess(
    userId: string,
    payload: { whatsapp_number: string; password: string },
  ): Promise<SendAccessResult> {
    const response = await apiAuth.post(`/users/${userId}/send_access`, payload);
    const body = (response?.data ?? {}) as { data?: User; whatsapp?: WhatsappSendResult };
    return { user: body.data as User, whatsapp: body.whatsapp };
  }

  // Get assignable agents for inbox
  async getAssignableAgents(inboxId: string): Promise<UsersResponse> {
    const response = await apiAuth.get(`/inboxes/${inboxId}/assignable_agents`);
    return extractResponse<User>(response) as UsersResponse;
  }

  // Update user availability status
  async updateAvailability(userId: string, availability: string): Promise<User> {
    const response = await apiAuth.patch(`/users/${userId}`, {
      availability_status: availability,
    });
    return extractData<User>(response);
  }

  // Search users
  async searchUsers(query: string): Promise<UsersResponse> {
    const response = await apiAuth.get('/users', {
      params: { q: query },
    });
    return extractResponse<User>(response) as UsersResponse;
  }
}

export default new UsersService();
