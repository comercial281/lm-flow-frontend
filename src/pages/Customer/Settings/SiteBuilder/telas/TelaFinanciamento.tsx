import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { Button, Input, Label as UILabel, Switch } from '@/components/ui/ds';
import { AlertTriangle, Landmark, Loader2, Trash2, Upload } from 'lucide-react';
import { siteBuilderService, type SiteFinancingPage } from '@/services/siteBuilder/siteBuilderService';
import { bankLogoSource, financingWarning } from '@/features/siteBuilder/portalPages';

interface Props {
  financingPage: SiteFinancingPage;
  setFinancingPage: Dispatch<SetStateAction<SiteFinancingPage>>;
  marcarAlterado: () => void;
}

export default function TelaFinanciamento({ financingPage, setFinancingPage, marcarAlterado }: Props) {
  // Qual logo de banco está subindo agora (chave do banco), para o botão daquela
  // linha girar sem travar as outras quatro.
  const [bankLogoUploading, setBankLogoUploading] = useState<string | null>(null);
  const bankLogoInputRef = useRef<HTMLInputElement>(null);
  const bankLogoTargetRef = useRef<string | null>(null);

  // Sobe o logo de um banco da página de financiamento. Vai para o armazenamento
  // do próprio CRM — logo apontado para o site do banco quebra no dia em que ele
  // troca o endereço da imagem, e o site do cliente fica com o círculo vazio.
  const handleBankLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = bankLogoTargetRef.current;
    if (bankLogoInputRef.current) bankLogoInputRef.current.value = '';
    bankLogoTargetRef.current = null;
    if (!file || !key) return;
    if (!file.type.startsWith('image/')) { toast.error('Envie um arquivo de imagem (PNG, JPG, WebP ou SVG).'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagem muito grande (máx 2MB).'); return; }

    setBankLogoUploading(key);
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      setFinancingPage(prev => ({
        ...prev,
        banks: prev.banks.map(b => (b.key === key ? { ...b, logo_url: url } : b)),
      }));
      marcarAlterado();
      toast.success('Logo no ar. Clique em Salvar para valer no site.');
    } catch {
      toast.error('Falha no upload do logo.');
    } finally {
      setBankLogoUploading(null);
    }
  };

  return (
    <>
      {/* Financiamento e bancos — a segunda pergunta de todo lead de imóvel,
          que até aqui só era respondida no WhatsApp. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Landmark className="h-4 w-4 text-muted-foreground" /> Financiamento e bancos
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Uma página no site com os bancos parceiros. O visitante clica no banco
              e cai direto no simulador dele.
            </p>
          </div>
          <Switch
            checked={financingPage.enabled}
            onCheckedChange={enabled => { setFinancingPage(p => ({ ...p, enabled })); marcarAlterado(); }}
          />
        </div>

        {financingPage.enabled && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <UILabel>Título da página</UILabel>
                <Input
                  value={financingPage.title}
                  onChange={e => { setFinancingPage(p => ({ ...p, title: e.target.value })); marcarAlterado(); }}
                />
              </div>
              <div>
                <UILabel>Chamada acima dos bancos</UILabel>
                <Input
                  value={financingPage.intro}
                  onChange={e => { setFinancingPage(p => ({ ...p, intro: e.target.value })); marcarAlterado(); }}
                />
              </div>
            </div>
            <div>
              <UILabel>Texto abaixo dos bancos</UILabel>
              <Input
                value={financingPage.footer}
                onChange={e => { setFinancingPage(p => ({ ...p, footer: e.target.value })); marcarAlterado(); }}
              />
              <p className="mt-1 text-xs text-muted-foreground">Deixe em branco para voltar ao texto padrão.</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Os cinco já vêm com o <strong>simulador oficial</strong> de cada banco — a página
                funciona assim que você liga a chave acima. Trocar o link só é preciso se você tiver
                um endereço de parceria; apagando o campo, ele volta ao oficial.
                Para <strong>tirar um banco da página, desligue a chave dele</strong>.
              </p>
              <input
                ref={bankLogoInputRef} type="file" accept="image/*" className="hidden"
                onChange={handleBankLogoFile}
              />
              {financingPage.banks.map((bank, i) => (
                <div key={bank.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full text-[9px] font-bold leading-none"
                      style={{ background: bank.color, color: bank.ink || '#fff' }}
                    >
                      {bank.logo_url
                        ? <img src={bank.logo_url} alt="" className="h-full w-full object-contain p-1" />
                        : bank.name.slice(0, 3).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 text-sm font-medium">{bank.name}</div>
                    <Switch
                      checked={bank.enabled !== false}
                      onCheckedChange={enabled => {
                        setFinancingPage(p => {
                          const banks = [...p.banks];
                          banks[i] = { ...banks[i], enabled };
                          return { ...p, banks };
                        });
                        marcarAlterado();
                      }}
                    />
                  </div>
                  {bank.enabled !== false && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Link de simulação (https://...)"
                          value={bank.url ?? ''}
                          onChange={e => {
                            setFinancingPage(p => {
                              const banks = [...p.banks];
                              banks[i] = { ...banks[i], url: e.target.value };
                              return { ...p, banks };
                            });
                            marcarAlterado();
                          }}
                        />
                        {bank.default_url && bank.url !== bank.default_url && (
                          <Button
                            type="button" variant="ghost" size="sm" className="flex-none whitespace-nowrap"
                            onClick={() => {
                              setFinancingPage(p => {
                                const banks = [...p.banks];
                                banks[i] = { ...banks[i], url: bank.default_url ?? '' };
                                return { ...p, banks };
                              });
                              marcarAlterado();
                            }}
                          >
                            Voltar ao oficial
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button" variant="outline" size="sm"
                          disabled={bankLogoUploading === bank.key}
                          onClick={() => {
                            bankLogoTargetRef.current = bank.key;
                            bankLogoInputRef.current?.click();
                          }}
                        >
                          {bankLogoUploading === bank.key
                            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                          {bank.logo_url ? 'Trocar logo' : 'Enviar logo'}
                        </Button>
                        {/* A lixeira VOLTA A HERDAR quando existe logo da Leal
                            Mídia — nunca "ficar sem logo". Sem essa distinção
                            o gestor não entende o que o botão faz. */}
                        {bankLogoSource(bank) === 'own' && (
                          <Button
                            type="button" variant="ghost" size="icon"
                            title={bank.default_logo_url ? 'Voltar ao logo da Leal Mídia' : 'Remover logo'}
                            className="flex-none text-destructive hover:text-destructive"
                            onClick={() => {
                              setFinancingPage(p => {
                                const banks = [...p.banks];
                                banks[i] = { ...banks[i], logo_url: bank.default_logo_url ?? '' };
                                return { ...p, banks };
                              });
                              marcarAlterado();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {bankLogoSource(bank) === 'inherited'
                            ? 'Logo herdado da Leal Mídia. Envie um para usar arte própria.'
                            : bank.logo_url
                              ? 'Sai com o logo no site.'
                              : 'Sem logo, o círculo sai na cor do banco com o nome escrito.'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {financingWarning(financingPage) && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                {financingWarning(financingPage)}
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
