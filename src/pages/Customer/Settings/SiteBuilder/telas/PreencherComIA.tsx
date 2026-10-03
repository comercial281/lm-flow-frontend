import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Textarea } from '@/components/ui/ds';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { siteBuilderService, type Site, type SiteFormData } from '@/services/siteBuilder/siteBuilderService';

// "Preencher com IA": proposta da IA que cai no formulário do pai (setF) — o
// usuário revisa e salva. Mora no Painel enquanto o TelaPainel não existe; o
// TelaPainel vai embutir este componente.
interface Props {
  site: Site | null;
  setF: (field: Partial<SiteFormData>) => void;
}

export default function PreencherComIA({ site, setF }: Props) {
  // Preencher com IA (proposta — o usuário revisa e salva)
  const [aiText, setAiText] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiAboutHtml, setAiAboutHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // IA lê o material colado e devolve os campos NOS LUGARES CERTOS do form.
  // Nada é salvo sozinho: o form fica sujo e o usuário revisa + salva.
  const handleAiSetup = async () => {
    if (!site) { toast.error('Crie o site primeiro (aba Configurações).'); return; }
    if (aiText.trim().length < 40) { toast.error('Cole um material com mais contexto (mín. 40 caracteres).'); return; }
    setAiRunning(true);
    try {
      const p = await siteBuilderService.aiSetup(site.id, aiText.trim());
      const patch: Partial<SiteFormData> = {};
      if (p.name) patch.name = p.name;
      if (p.seo_title) patch.seo_title = p.seo_title;
      if (p.seo_description) patch.seo_description = p.seo_description;
      if (p.contact_phone) patch.contact_phone = p.contact_phone;
      if (p.contact_whatsapp) patch.contact_whatsapp = p.contact_whatsapp;
      if (p.contact_email) patch.contact_email = p.contact_email;
      if (p.contact_address) patch.contact_address = p.contact_address;
      const filled = Object.keys(patch).length;
      if (filled === 0 && !p.about_html) {
        toast.error('A IA não achou dados utilizáveis nesse material.');
        return;
      }
      setF(patch);
      setAiAboutHtml(p.about_html ?? null);
      toast.success(`${filled} campo${filled !== 1 ? 's' : ''} preenchido${filled !== 1 ? 's' : ''}. Revise e clique em Salvar.`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'IA falhou ao interpretar o material.'));
    } finally {
      setAiRunning(false);
    }
  };

  // Cria a página "Sobre nós" com o HTML proposto pela IA (clique explícito).
  const handleCreateAboutPage = async () => {
    if (!site || !aiAboutHtml) return;
    setSaving(true);
    try {
      await siteBuilderService.createPage(site.id, {
        title: 'Sobre nós',
        slug: 'sobre-nos',
        content: aiAboutHtml,
        active: true,
        in_menu: true,
        menu_position: 99,
      });
      toast.success('Página "Sobre nós" criada (aba Páginas).');
      setAiAboutHtml(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Falha ao criar a página.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Preencher com IA
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Cole a apresentação da imobiliária (texto do Instagram, sobre-nós, documento institucional).
        A IA distribui as informações nos campos certos abaixo — nome, SEO, contato e página Sobre.
        Nada é salvo sozinho: você revisa e clica em Salvar.
      </p>
      <Textarea
        value={aiText}
        onChange={e => setAiText(e.target.value)}
        rows={4}
        placeholder="Ex: A Imobiliária XYZ atua há 15 anos em Campinas com foco em lançamentos... Fale com a gente no (19) 99999-9999 ou contato@xyz.com.br"
        className="resize-none bg-background"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button onClick={handleAiSetup} disabled={aiRunning || !site}>
          {aiRunning
            ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Interpretando...</>
            : <><Sparkles className="mr-1.5 h-4 w-4" /> Preencher campos</>}
        </Button>
        {aiAboutHtml && (
          <Button variant="outline" onClick={handleCreateAboutPage} disabled={saving}>
            <FileText className="mr-1.5 h-4 w-4" /> Criar página "Sobre nós" com o texto gerado
          </Button>
        )}
        {!site && (
          <span className="text-xs text-muted-foreground">Crie o site primeiro (preencha o nome e salve).</span>
        )}
      </div>
    </section>
  );
}
