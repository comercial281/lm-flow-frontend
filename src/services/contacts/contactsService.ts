import api from '@/services/core/api';
import { extractData, extractResponse } from '@/utils/apiHelpers';
import type {
  Contact,
  ContactsResponse,
  ContactNotesResponse,
  ContactConversationsResponse,
  ContactsListParams,
  ContactsSearchParams,
  ContactsFilterParams,
  ContactsBulkQuery,
  ContactsBulkResult,
  ContactUpdateData,
  ContactFormData,
  ContactMergeParams,
  ContactExportParams,
  ContactExportColumn,
  ContactExportResult,
  ContactImportResponse,
  ContactNote,
  ContactConversation,
  ContactableInboxes,
  CreditCheckResult,
} from '@/types/contacts';

/** Lê o conteúdo de um Blob com `FileReader`, nunca com `blob.text()`.
 *  O segundo não existe em todo ambiente (nem no que roda os testes), e a falha
 *  dele é indistinguível de "arquivo corrompido" — mesma cicatriz do importador
 *  de funil de follow-up. */
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Erro cujo corpo veio como Blob (acontece em toda chamada com
 *  `responseType: 'blob'`) volta a ter `error.response.data` legível — é o que
 *  permite mostrar o motivo em português que o servidor mandou, inclusive a
 *  recusa por cargo, que vem em outro formato. */
async function reviveBlobError(error: unknown): Promise<unknown> {
  const response = (error as { response?: { data?: unknown } })?.response;
  const data = response?.data;
  if (!(data instanceof Blob)) return error;

  try {
    const text = await readBlobText(data);
    (response as { data?: unknown }).data = JSON.parse(text);
  } catch {
    // Corpo que não é JSON não ajuda ninguém: deixa como estava e a tela cai no
    // texto de reserva dela.
  }
  return error;
}

class ContactsService {
  // List contacts with pagination and filters
  async getContacts(params?: ContactsListParams): Promise<ContactsResponse> {
    const response = await api.get(`/contacts`, {
      params,
    });
    return extractResponse<Contact>(response) as ContactsResponse;
  }

  async getAllContacts(): Promise<ContactsResponse> {
    const response = await api.get(`/contacts/all`);
    return extractResponse<Contact>(response) as ContactsResponse;
  }

  // Search contacts
  async searchContacts(params: ContactsSearchParams): Promise<ContactsResponse> {
    const response = await api.get(`/contacts/search`, {
      params,
    });
    return extractResponse<Contact>(response) as ContactsResponse;
  }

  // Get active contacts
  async getActiveContacts(params?: { page?: number; sort?: string }): Promise<ContactsResponse> {
    const response = await api.get(`/contacts/active`, {
      params,
    });
    return extractResponse<Contact>(response) as ContactsResponse;
  }

  // Get companies list
  async getCompaniesList(): Promise<Array<{ id: string; name: string }>> {
    const response = await api.get(`/contacts/companies_list`);
    return extractData<Array<{ id: string; name: string }>>(response);
  }

  // Filter contacts with advanced queries
  async filterContacts(params: ContactsFilterParams): Promise<ContactsResponse> {
    const response = await api.post(`/contacts/filter`, params);
    return extractResponse<Contact>(response) as ContactsResponse;
  }

  // Get single contact
  async getContact(contactId: string, includeContactInboxes = true): Promise<Contact> {
    const response = await api.get(`/contacts/${contactId}`, {
      params: {
        include_contact_inboxes: includeContactInboxes,
      },
    });
    return extractData<Contact>(response);
  }

  // Create contact (with optional file upload)
  async createContact(contactData: ContactFormData): Promise<Contact> {
    const { avatar, ...data } = contactData;

    if (avatar) {
      const formData = new FormData();

      // Add basic fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            // Handle custom_attributes and additional_attributes
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (subValue !== undefined && subValue !== null) {
                formData.append(`${key}[${subKey}]`, String(subValue));
              }
            });
          } else if (Array.isArray(value)) {
            // Handle labels array
            value.forEach(item => formData.append(`${key}[]`, String(item)));
          } else {
            formData.append(key, String(value));
          }
        }
      });

      // Add avatar file
      formData.append('avatar', avatar);

      const response = await api.post(`/contacts`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return extractData<Contact>(response);
    } else {
      const response = await api.post(`/contacts`, data);
      return extractData<Contact>(response);
    }
  }

  // Update contact
  async updateContact(contactId: string, contactData: ContactUpdateData): Promise<Contact> {
    const { avatar, ...data } = contactData;

    if (avatar) {
      const formData = new FormData();

      // Add basic fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            // Handle nested objects like additional_attributes
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (subValue !== undefined && subValue !== null) {
                if (typeof subValue === 'object' && !Array.isArray(subValue)) {
                  // Handle deeply nested objects like location
                  Object.entries(subValue).forEach(([deepKey, deepValue]) => {
                    if (deepValue !== undefined && deepValue !== null) {
                      formData.append(`${key}[${subKey}][${deepKey}]`, String(deepValue));
                    }
                  });
                } else {
                  formData.append(`${key}[${subKey}]`, String(subValue));
                }
              }
            });
          } else if (Array.isArray(value)) {
            // Handle arrays like labels
            // Lista vazia precisa de uma entrada em branco: sem nenhuma entrada o
            // campo simplesmente não vai no envio, e o backend entende "não mexi
            // nas tags" em vez de "tirei todas". Era assim que a última tag
            // sempre voltava quando a ficha era salva junto com uma foto nova.
            if (value.length === 0) {
              if (key === 'labels') formData.append(`${key}[]`, '');
            } else {
              value.forEach(item => formData.append(`${key}[]`, String(item)));
            }
          } else {
            formData.append(key, String(value));
          }
        }
      });

      // Add avatar file
      formData.append('avatar', avatar);

      const response = await api.patch(`/contacts/${contactId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return extractData<Contact>(response);
    } else {
      const response = await api.patch(`/contacts/${contactId}`, contactData);
      return extractData<Contact>(response);
    }
  }

  // Update contact with file upload
  async updateContactWithAvatar(contactId: string, avatar: File): Promise<Contact> {
    const formData = new FormData();
    formData.append('avatar', avatar);

    const response = await api.patch(`/contacts/${contactId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return extractData<Contact>(response);
  }

  // Delete contact
  async deleteContact(contactId: string): Promise<{ message: string }> {
    const response = await api.delete(`/contacts/${contactId}`);
    return extractData<{ message: string }>(response);
  }

  // Remove contact avatar
  async removeContactAvatar(contactId: string): Promise<Contact> {
    const response = await api.delete(`/contacts/${contactId}/avatar`);
    return extractData<Contact>(response);
  }

  // Get contactable inboxes for a contact
  async getContactableInboxes(contactId: string): Promise<ContactableInboxes[]> {
    const response = await api.get(`/contacts/${contactId}/contactable_inboxes`);
    return extractData<ContactableInboxes[]>(response);
  }

  // Contact Labels
  async getContactLabels(contactId: string): Promise<{ data: string[] }> {
    const response = await api.get(`/contacts/${contactId}/labels`);
    return extractData<{ data: string[] }>(response);
  }

  async updateContactLabels(contactId: string, labels: string[]): Promise<Contact> {
    const response = await api.post(`/contacts/${contactId}/labels`, {
      labels,
    });
    return extractData<Contact>(response);
  }

  // Consulta de CPF/crédito (BigDataCorp) sob demanda
  async checkContactCredit(contactId: string): Promise<{ credit_check: CreditCheckResult }> {
    const response = await api.post(`/contacts/${contactId}/credit_check`);
    return extractData<{ credit_check: CreditCheckResult }>(response);
  }

  // Contact Notes
  async getContactNotes(contactId: string): Promise<ContactNotesResponse> {
    const response = await api.get(`/contacts/${contactId}/notes`);
    return extractResponse<ContactNote>(response) as ContactNotesResponse;
  }

  async createContactNote(contactId: string, content: string): Promise<ContactNote> {
    const response = await api.post(`/contacts/${contactId}/notes`, {
      content,
    });
    return extractData<ContactNote>(response);
  }

  async updateContactNote(
    contactId: string,
    noteId: string,
    content: string,
  ): Promise<ContactNote> {
    const response = await api.patch(`/contacts/${contactId}/notes/${noteId}`, {
      content,
    });
    return extractData<ContactNote>(response);
  }

  async deleteContactNote(contactId: string, noteId: string): Promise<{ message: string }> {
    const response = await api.delete(`/contacts/${contactId}/notes/${noteId}`);
    return extractData<{ message: string }>(response);
  }

  // Contact Conversations
  async getContactConversations(
    contactId: string,
    params?: { page?: number; status?: string; inbox_id?: string },
  ): Promise<ContactConversationsResponse> {
    const response = await api.get(`/contacts/${contactId}/conversations`, {
      params,
    });
    return extractResponse<ContactConversation>(response) as ContactConversationsResponse;
  }

  // Contact Pipelines
  async getContactPipelines(contactId: string): Promise<Array<{
      pipeline: {
        id: string;
        name: string;
        pipeline_type: string;
      };
      stage: {
        id: string;
        name: string;
        color: string;
        position: number;
        stage_type: number;
      };
      item: {
        id: string;
        item_id: string;
        type: string;
        entered_at: number;
        notes: string | null;
      };
    }>> {
    const response = await api.get(`/contacts/${contactId}/pipelines`);
    return extractData<Array<{
        pipeline: {
          id: string;
          name: string;
          pipeline_type: string;
        };
        stage: {
          id: string;
          name: string;
          color: string;
          position: number;
          stage_type: number;
        };
        item: {
          id: string;
          item_id: string;
          type: string;
          entered_at: number;
          notes: string | null;
        };
    }>>(response);
  }

  // Custom Attributes
  async destroyCustomAttributes(contactId: string, customAttributes: string[]): Promise<Contact> {
    const response = await api.post(`/contacts/${contactId}/destroy_custom_attributes`, {
      custom_attributes: customAttributes,
    });
    return extractData<Contact>(response);
  }

  // Bulk Actions
  async bulkDelete(contactIds: string[]): Promise<ContactsBulkResult> {
    const response = await api.post(`/bulk_actions`, {
      type: 'Contact',
      ids: contactIds,
      fields: {
        action: 'delete',
      },
    });
    return extractData<ContactsBulkResult>(response);
  }

  /**
   * Deleta TODOS os contatos que casam com a consulta atual, não só os ids da
   * página. O backend resolve o conjunto com o mesmo escopo da listagem e joga
   * o lote na fila — por isso a resposta vem com `async: true`.
   */
  async bulkDeleteAll(query: ContactsBulkQuery): Promise<ContactsBulkResult> {
    const response = await api.post(`/bulk_actions`, {
      type: 'Contact',
      select_all: true,
      query,
      fields: {
        action: 'delete',
      },
    });
    return extractData<ContactsBulkResult>(response);
  }

  async bulkUpdateLabels(
    contactIds: string[],
    labels: string[],
    action: 'add_labels' | 'remove_labels',
  ): Promise<{ message: string; affected_count?: number }> {
    const response = await api.post(`/bulk_actions`, {
      type: 'Contact',
      ids: contactIds,
      fields: {
        action,
        labels,
      },
    });
    return extractData<{ message: string; affected_count?: number }>(response);
  }

  async bulkUpdateCustomAttributes(
    contactIds: string[],
    customAttributes: Record<string, unknown>,
  ): Promise<{ message: string; affected_count?: number }> {
    const response = await api.post(`/bulk_actions`, {
      type: 'Contact',
      ids: contactIds,
      fields: {
        action: 'update_custom_attributes',
        custom_attributes: customAttributes,
      },
    });
    return extractData<{ message: string; affected_count?: number }>(response);
  }

  // Import/Export
  async importContacts(file: File): Promise<ContactImportResponse> {
    const formData = new FormData();
    formData.append('import_file', file);

    const response = await api.post(`/contacts/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return extractData<ContactImportResponse>(response);
  }

  /** As colunas que a janela de exportação oferece vêm do SERVIDOR, nunca de uma
   *  lista escrita aqui: era a divergência entre as duas (a tela mandava os
   *  campos com um nome, o servidor lia outro) que fazia o gestor marcar campo e
   *  o arquivo sair sempre com as mesmas quatro colunas. */
  async getExportColumns(): Promise<ContactExportColumn[]> {
    const response = await api.get(`/contacts/export_columns`);
    const data = extractData<{ columns?: ContactExportColumn[] }>(response);
    return data?.columns ?? [];
  }

  /** Baixa a planilha aqui mesmo, no navegador. Base gigante não cabe numa
   *  requisição: nesse caso o servidor responde JSON com `queued` e o arquivo
   *  vai por e-mail — a tela avisa em vez de baixar um arquivo quebrado. */
  async exportContacts(params: ContactExportParams): Promise<ContactExportResult> {
    let response;
    try {
      response = await api.post(`/contacts/export`, params, { responseType: 'blob' });
    } catch (error) {
      // Com `responseType: 'blob'` o CORPO do erro também chega como Blob, então
      // o motivo em português que o servidor mandou fica ilegível para quem lê
      // `error.response.data.message`. Reabrir como texto é o que faz a recusa
      // por cargo aparecer como recusa por cargo.
      throw await reviveBlobError(error);
    }

    const blob = response.data as Blob;
    // O tipo vem do cabeçalho e, na falta dele, do próprio arquivo.
    const contentType = String(response.headers?.['content-type'] ?? blob.type ?? '');

    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(await readBlobText(blob)) as {
        data?: { queued?: boolean; count?: number };
        message?: string;
      };
      return {
        queued: true,
        count: parsed?.data?.count,
        message: parsed?.message,
      };
    }

    // O servidor manda o nome no cabeçalho; quando o navegador não o expõe
    // (CORS sem expose-headers), o nome derivado aqui é o mesmo.
    const header = String(response.headers?.['content-disposition'] ?? '');
    const fromHeader = /filename="?([^";]+)"?/.exec(header)?.[1];
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = fromHeader || `contatos-${stamp}.${params.format === 'xlsx' ? 'xlsx' : 'csv'}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    return { queued: false, filename };
  }

  // Merge Contacts
  async mergeContacts(params: ContactMergeParams): Promise<Contact> {
    const response = await api.post(`/actions/contact_merge`, params);
    return extractData<Contact>(response);
  }

  // Search for duplicates
  async searchDuplicates(query: string): Promise<ContactsResponse> {
    const response = await api.get(`/contacts/search`, {
      params: {
        q: query,
        duplicate_check: true,
      },
    });
    return extractResponse<Contact>(response) as ContactsResponse;
  }
}

export const contactsService = new ContactsService();
