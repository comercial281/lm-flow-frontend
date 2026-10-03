import type { Site, SiteFormData } from '@/services/siteBuilder/siteBuilderService';

// O que toda tela do formulário do site recebe do pai. O estado do formulário
// mora no SiteBuilder porque o Salvar é um só (BarraSalvar).
export interface FormProps {
  site: Site | null;
  siteForm: SiteFormData;
  setF: (field: Partial<SiteFormData>) => void;
}
