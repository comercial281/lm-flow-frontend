import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { Button, Input, Label as UILabel, Switch, Textarea } from '@/components/ui/ds';
import { AlertTriangle, Loader2, Mail, Signpost } from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { siteBuilderService, type Site, type SiteListingPage } from '@/services/siteBuilder/siteBuilderService';
import { listingWarning, parseEmails } from '@/features/siteBuilder/portalPages';

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

  return (
    <>
      {/* Anuncie seu imóvel — o proprietário que quer VENDER. Antes, o link
          "Anuncie" do rodapé rolava para o formulário de quem COMPRA. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Signpost className="h-4 w-4 text-muted-foreground" /> Anuncie seu imóvel
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Uma ficha no site para o proprietário oferecer o imóvel dele. Ela chega
              por e-mail — não cria contato nem card no CRM.
            </p>
          </div>
          <Switch
            checked={listingPage.enabled}
            onCheckedChange={enabled => { setListingPage(p => ({ ...p, enabled })); marcarAlterado(); }}
          />
        </div>

        {listingPage.enabled && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div>
              <UILabel>Quem recebe a ficha por e-mail</UILabel>
              <Input
                placeholder="dono@imobiliaria.com, gerente@imobiliaria.com"
                value={emailsText}
                onChange={e => { setEmailsText(e.target.value); marcarAlterado(); }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Separe por vírgula (até 5). A ficha também fica guardada em Contatos do site.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  <span className="text-xs text-muted-foreground">Salve as alterações para testar.</span>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <UILabel>Título da página</UILabel>
                <Input
                  value={listingPage.title}
                  onChange={e => { setListingPage(p => ({ ...p, title: e.target.value })); marcarAlterado(); }}
                />
              </div>
              <div>
                <UILabel>Mensagem do botão de WhatsApp</UILabel>
                <Input
                  value={listingPage.whatsapp_text}
                  onChange={e => { setListingPage(p => ({ ...p, whatsapp_text: e.target.value })); marcarAlterado(); }}
                />
              </div>
            </div>

            <div>
              <UILabel>Chamada acima da ficha</UILabel>
              <Textarea
                rows={2}
                value={listingPage.intro}
                onChange={e => { setListingPage(p => ({ ...p, intro: e.target.value })); marcarAlterado(); }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <UILabel>Título da tela de obrigado</UILabel>
                <Input
                  value={listingPage.thanks_title}
                  onChange={e => { setListingPage(p => ({ ...p, thanks_title: e.target.value })); marcarAlterado(); }}
                />
              </div>
              <div>
                <UILabel>Texto da tela de obrigado</UILabel>
                <Input
                  value={listingPage.thanks_text}
                  onChange={e => { setListingPage(p => ({ ...p, thanks_text: e.target.value })); marcarAlterado(); }}
                />
              </div>
            </div>

            {listingWarning({ ...listingPage, emails: parseEmails(emailsText) }) && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                {listingWarning({ ...listingPage, emails: parseEmails(emailsText) })}
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
