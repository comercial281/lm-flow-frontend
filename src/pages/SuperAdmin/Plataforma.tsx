import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Globe, Loader2, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { ESQUELETO, PAGINA, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import { platformBanksService, type PlatformBank } from '@/services/superAdmin/platformBanksService';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';

/**
 * Plataforma → Site: o que vale no site de TODAS as imobiliárias de uma vez.
 *
 * Hoje é um bloco só: os logos dos bancos da página *Simule seu financiamento*.
 * Subidos uma vez aqui, toda imobiliária os mostra — inclusive as que ainda nem
 * existem. É a doutrina de toda configuração da plataforma: o valor do cliente
 * vence, e onde ele está vazio vale o da Leal Mídia.
 *
 * Antes disto o logo era enviado no Site Builder de cada cliente: cinco arquivos
 * vezes trinta e uma imobiliárias, e a imobiliária nova nascia sem nenhum. Quem
 * tem arte própria de parceria continua trocando lá — ela ganha desta.
 *
 * "Tirar" atinge o site de todas as imobiliárias: confirma antes (06/10). A cor
 * de marca do banco vai em `style` porque é dado, não tema.
 */

// Os dois formatos de erro da API: o padrão traz `error.message`, e a recusa por
// cargo traz `error` como TEXTO com a explicação em `message`. Ler só o primeiro
// faz a recusa virar frase genérica e manda procurar o problema no lugar errado.
const motivo = (e: unknown, reserva: string) => {
  const r = (e as { response?: { data?: { error?: unknown; message?: string } } }).response?.data;
  return (
    (typeof r?.error === 'object' && (r.error as { message?: string })?.message) ||
    (typeof r?.error === 'string' ? r.error : null) ||
    r?.message ||
    reserva
  );
};

export default function Plataforma() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [banks, setBanks] = useState<PlatformBank[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBanks(await platformBanksService.list());
      setErro(null);
    } catch (e) {
      setErro(motivo(e, 'Não consegui carregar os logos agora.'));
      setBanks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Grava o mapa INTEIRO: a lista da tela é a verdade depois de cada ação, e
  // gravar banco a banco deixaria a tela e o servidor discordando se a rede
  // caísse no meio.
  const persist = async (next: PlatformBank[]) => {
    setSaving(true);
    try {
      const logos = Object.fromEntries(next.map(b => [b.key, (b.logo_url ?? '').trim()]));
      setBanks(await platformBanksService.save(logos));
      toast.success('Logos salvos — valem em todas as imobiliárias.');
    } catch (e) {
      toast.error(motivo(e, 'Não consegui salvar os logos.'));
      void load();
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = targetRef.current;
    if (inputRef.current) inputRef.current.value = '';
    targetRef.current = null;
    if (!file || !key || !banks) return;
    if (!file.type.startsWith('image/')) { toast.error('Envie um arquivo de imagem (PNG, JPG, WebP ou SVG).'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagem muito grande (máx 2MB).'); return; }

    setUploading(key);
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      await persist(banks.map(b => (b.key === key ? { ...b, logo_url: url } : b)));
    } catch (err) {
      toast.error(motivo(err, 'Falha no upload do logo.'));
    } finally {
      setUploading(null);
    }
  };

  const remove = async (bank: PlatformBank) => {
    if (!banks) return;
    if (!(await confirmar({
      titulo: `Tirar o logo do ${bank.name} dos sites de todas as imobiliárias?`,
      descricao: 'Sem logo, o círculo sai na cor do banco com o nome escrito. Quem tem arte própria no Site Builder continua com a dela.',
      rotuloDaAcao: 'Tirar',
      destrutivo: true,
    }))) return;
    await persist(banks.map(b => (b.key === bank.key ? { ...b, logo_url: '' } : b)));
  };

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className={PAGINA}>
        <header className="space-y-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Globe className="h-5 w-5" /> Site
          </h2>
          <p className="text-sm text-muted-foreground">O que vale no site de todas as imobiliárias de uma vez.</p>
        </header>

        <section aria-labelledby="site-logos" className={SECAO}>
          <h3 id="site-logos" className={TITULO_SECAO}>Logos dos bancos</h3>
          <p className={SUBTITULO_SECAO}>
            Aparecem na página <em>Simule seu financiamento</em> do site de cada cliente que ligou essa
            página. Enviados aqui, valem para todas — inclusive para as imobiliárias novas. Quem tiver
            arte própria de parceria troca no Site Builder dela, e a dela ganha desta.
          </p>

          {loading && <div className={`${ESQUELETO} mt-4 h-40`} />}

          {erro && !loading && (
            <EmptyState tipo="erro" description={erro} aoTentarDeNovo={() => void load()} className="py-8" />
          )}

          {banks && !loading && (
            <div className="mt-4 space-y-2">
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              {banks.map(bank => (
                <div key={bank.key} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span
                    className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full text-[9px] font-bold leading-none"
                    style={{ background: bank.color, color: bank.ink || '#fff' }}
                  >
                    {bank.logo_url
                      ? <img src={bank.logo_url} alt="" className="h-full w-full object-contain p-1" />
                      : bank.name.slice(0, 3).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{bank.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {bank.logo_url
                        ? 'Todas as imobiliárias mostram este logo.'
                        : 'Sem logo, o círculo sai na cor do banco com o nome escrito.'}
                    </div>
                  </div>
                  <Button
                    type="button" variant="outline" size="sm"
                    disabled={uploading === bank.key || saving}
                    onClick={() => { targetRef.current = bank.key; inputRef.current?.click(); }}
                  >
                    {uploading === bank.key
                      ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    {bank.logo_url ? 'Trocar' : 'Enviar logo'}
                  </Button>
                  {bank.logo_url && (
                    <Button
                      type="button" variant="ghost" size="sm"
                      disabled={saving}
                      title="Tira o logo de todas as imobiliárias"
                      onClick={() => void remove(bank)}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Tirar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {dialogoDeConfirmacao}
    </div>
  );
}
