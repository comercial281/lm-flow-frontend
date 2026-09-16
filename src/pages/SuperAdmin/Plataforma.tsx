import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Landmark, Loader2, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { platformBanksService, type PlatformBank } from '@/services/superAdmin/platformBanksService';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';

/**
 * Configuração que vale para TODAS as imobiliárias de uma vez.
 *
 * Hoje só os logos dos bancos da página *Simule seu financiamento*: subidos uma
 * vez aqui, toda imobiliária os mostra — inclusive as que ainda nem existem.
 * É a mesma doutrina de toda configuração da plataforma: o valor do cliente
 * vence, e onde ele está vazio vale o da Leal Mídia.
 *
 * Antes disto o logo era enviado no Site Builder de cada cliente: cinco arquivos
 * vezes trinta e uma imobiliárias, e a imobiliária nova nascia sem nenhum. Quem
 * tem arte própria de parceria continua trocando lá — ela ganha desta.
 */
export default function Plataforma() {
  const [banks, setBanks] = useState<PlatformBank[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<string | null>(null);

  // Os dois formatos de erro da API: o padrão traz `error.message`, e a recusa
  // por cargo traz `error` como TEXTO com a explicação em `message`. Ler só o
  // primeiro faz a recusa virar frase genérica e manda procurar o problema no
  // lugar errado.
  const motivo = (e: unknown, reserva: string) => {
    const r = (e as { response?: { data?: { error?: unknown; message?: string } } }).response?.data;
    return (
      (typeof r?.error === 'object' && (r.error as { message?: string })?.message) ||
      (typeof r?.error === 'string' ? r.error : null) ||
      r?.message ||
      reserva
    );
  };

  const load = useCallback(async () => {
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

  useEffect(() => { void load(); }, [load]);

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
    } catch (e) {
      toast.error(motivo(e, 'Falha no upload do logo.'));
    } finally {
      setUploading(null);
    }
  };

  const remove = async (key: string) => {
    if (!banks) return;
    await persist(banks.map(b => (b.key === key ? { ...b, logo_url: '' } : b)));
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Landmark className="h-5 w-5" /> Plataforma
        </h1>
        <p className="text-sm text-muted-foreground">
          O que vale para todas as imobiliárias de uma vez.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Logos dos bancos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Aparecem na página <em>Simule seu financiamento</em> do site de cada cliente que ligou essa
          página. Enviados aqui, valem para todas — inclusive para as imobiliárias novas. Quem tiver
          arte própria de parceria troca no Site Builder dela, e a dela ganha desta.
        </p>

        {loading && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        )}

        {erro && !loading && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
            {erro}
          </p>
        )}

        {banks && (
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
                    onClick={() => void remove(bank.key)}
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
  );
}
