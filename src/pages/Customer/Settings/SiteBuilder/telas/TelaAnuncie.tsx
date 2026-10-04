import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { Button, Label as UILabel, Switch } from '@/components/ui/ds';
import { Loader2, Mail } from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { siteBuilderService, type Site, type SiteListingPage } from '@/services/siteBuilder/siteBuilderService';
import { listingWarning, parseEmails } from '@/features/siteBuilder/portalPages';
import { Secao, Secoes } from '../ui/Secao';
import { CampoTexto, CampoTextoLongo } from '../ui/Campo';

interface Props {
  site: Site | null;
  listingPage: SiteListingPage;
  setListingPage: Dispatch<SetStateAction<SiteListingPage>>;
  emailsText: string;
  setEmailsText: (texto: string) => void;
  // O teste de e-mail usa o que está gravado: com alteração pendente, ele espera.
  alterado: boolean;
  marcarAlterado: () => void;
}

export default function TelaAnuncie({
  site, listingPage, setListingPage, emailsText, setEmailsText, alterado, marcarAlterado,
}: Props) {
  const [testingEmail, setTestingEmail] = useState(false);

  const set = (parte: Partial<SiteListingPage>) => { setListingPage(p => ({ ...p, ...parte })); marcarAlterado(); };
  const aviso = listingWarning({ ...listingPage, emails: parseEmails(emailsText) });

  return (
    <Secoes>
      {/* Anuncie seu imóvel — o proprietário que quer VENDER. Antes, o link
          "Anuncie" do rodapé rolava para o formulário de quem COMPRA. */}
      <Secao
        titulo="Página Anuncie seu imóvel"
        descricao="Uma ficha no site para o proprietário oferecer o imóvel dele. Ela chega por e-mail e não cria contato nem card no CRM."
        acao={
          <div className="flex items-center gap-3">
            <Switch id="anuncie-ligado" checked={listingPage.enabled} onCheckedChange={enabled => set({ enabled })} />
            <UILabel htmlFor="anuncie-ligado" className="cursor-pointer text-base font-normal">Mostrar a página no site</UILabel>
          </div>
        }
      >
        {!listingPage.enabled && (
          <p className="text-sm text-muted-foreground">Ligue a chave para mostrar a página e escolher quem recebe as fichas.</p>
        )}
      </Secao>

      {listingPage.enabled && (
        <Secao
          titulo="Quem recebe"
          descricao="Os e-mails que recebem cada ficha preenchida. A ficha também fica guardada em Contatos do site."
        >
          <CampoTexto
            id="anuncie-emails"
            rotulo="Quem recebe a ficha por e-mail"
            placeholder="dono@imobiliaria.com, gerente@imobiliaria.com"
            ajuda="Separe por vírgula (até 5)."
            aviso={aviso ?? undefined}
            valor={emailsText}
            aoMudar={v => { setEmailsText(v); marcarAlterado(); }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button" variant="outline" size="sm"
              disabled={testingEmail || !site || alterado}
              onClick={async () => {
                if (!site) return;
                setTestingEmail(true);
                try {
                  const r = await siteBuilderService.testListingEmail(site.id);
                  toast.success(`Ficha de teste enviada para ${r.sent_to.join(', ')}.`);
                } catch (e) {
                  toast.error(apiErrorMessage(e, 'Não consegui enviar o teste.'));
                } finally {
                  setTestingEmail(false);
                }
              }}
            >
              {testingEmail ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
              Enviar um teste
            </Button>
            {alterado && (
              <span className="text-sm text-muted-foreground">Salve as alterações para testar.</span>
            )}
          </div>
        </Secao>
      )}

      {listingPage.enabled && (
        <Secao
          titulo="Textos da página"
          descricao="O que o proprietário lê na página, no botão de WhatsApp e na tela de obrigado depois de enviar a ficha."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <CampoTexto id="anuncie-titulo" rotulo="Título da página" valor={listingPage.title}
              aoMudar={title => set({ title })} />
            <CampoTexto id="anuncie-whatsapp" rotulo="Mensagem do botão de WhatsApp" valor={listingPage.whatsapp_text}
              aoMudar={whatsapp_text => set({ whatsapp_text })} />
            <CampoTextoLongo id="anuncie-chamada" rotulo="Chamada acima da ficha" rows={2} valor={listingPage.intro}
              aoMudar={intro => set({ intro })} className="md:col-span-2" />
            <CampoTexto id="anuncie-obrigado-titulo" rotulo="Título da tela de obrigado" valor={listingPage.thanks_title}
              aoMudar={thanks_title => set({ thanks_title })} />
            <CampoTexto id="anuncie-obrigado-texto" rotulo="Texto da tela de obrigado" valor={listingPage.thanks_text}
              aoMudar={thanks_text => set({ thanks_text })} />
          </div>

        </Secao>
      )}
    </Secoes>
  );
}
