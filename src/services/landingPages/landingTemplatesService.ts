import api from '@/services/core/api';
import type { BlockInstance, LandingTheme } from '@/features/landing/blocks';

export interface LandingTemplateDTO {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  scope: 'tenant' | 'global';
  content_blocks: unknown[];
  theme?: Partial<LandingTheme> | null;
  created_at: string;
}

function unwrap<T>(res: { data: unknown }): T {
  return (res.data as { data: T }).data;
}

/** Biblioteca de templates de landing do tenant (Fatia 3). */
export const landingTemplatesService = {
  async list(): Promise<LandingTemplateDTO[]> {
    const res = await api.get('/landing_templates');
    return unwrap<LandingTemplateDTO[]>(res);
  },

  /** Salva uma landing existente como template (copia blocos + tema).
   *  scope 'global' (todos os clientes) só o super-admin pode; senão 'tenant'. */
  async createFromPage(pageId: string, name: string, scope: 'tenant' | 'global' = 'tenant'): Promise<LandingTemplateDTO> {
    const res = await api.post('/landing_templates', { page_id: pageId, name, scope });
    return unwrap<LandingTemplateDTO>(res);
  },

  /** Cria a partir de blocos/tema crus. */
  async create(name: string, blocks: BlockInstance[], theme?: Partial<LandingTheme>): Promise<LandingTemplateDTO> {
    const res = await api.post('/landing_templates', { name, content_blocks: blocks, theme: theme ?? {} });
    return unwrap<LandingTemplateDTO>(res);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/landing_templates/${id}`);
  },
};
