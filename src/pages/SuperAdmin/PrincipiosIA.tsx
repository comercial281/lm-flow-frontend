import { useCallback, useEffect, useState } from 'react';
import { Button, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { playbookPrinciplesService, type PlaybookPrinciple } from '@/services/superAdmin/globalBrainService';

/**
 * Os PRINCÍPIOS do comando da IA Vendedora — as regras que valem em TODA
 * imobiliária: não recomeçar a conversa, não prometer material que não existe, o
 * jeito de escrever no WhatsApp, a triagem do contato.
 *
 * Editados aqui, valem em todos os clientes de uma vez. Imobiliária nenhuma
 * alcança este texto.
 *
 * O ROTEIRO de venda (o que perguntar, como ramificar, qual o próximo passo) NÃO
 * mora aqui: ele é de cada cliente e vive na tela da IA Vendedora dele. A
 * separação é estrutural — misturar as duas faria uma melhoria de método
 * sobrescrever a peculiaridade de uma imobiliária, e vice-versa.
 *
 * Antes desta tela, todo este texto era código: mudar uma vírgula exigia deploy,
 * e não havia como sequer LER o que a IA recebe.
 */
export default function PrincipiosIA() {
  const [blocks, setBlocks] = useState<PlaybookPrinciple[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBlocks(await playbookPrinciplesService.list());
      setErro(null);
    } catch (e) {
      // Os dois formatos de erro da API: o padrão traz `error.message`, e a recusa
      // por cargo traz `error` como TEXTO com a explicação em `message`. Ler só o
      // primeiro faz a recusa virar frase genérica e manda procurar o problema no
      // lugar errado.
      const r = (e as { response?: { data?: { error?: unknown; message?: string } } }).response?.data;
      const detalhe =
        (typeof r?.error === 'object' && (r.error as { message?: string })?.message) ||
        (typeof r?.error === 'string' ? r.error : null) ||
        r?.message ||
        'Não consegui carregar os princípios agora.';
      setErro(detalhe);
      setBlocks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (block: PlaybookPrinciple, text: string) => {
    const trimmed = text.trim();
    // Igual ao padrão da tela do cliente e ao resto da plataforma: vazio HERDA.
    const content = !trimmed || trimmed === block.factory_default.trim() ? '' : trimmed;
    if (content === (block.customized ? block.content : '')) return;

    setSavingKey(block.key);
    try {
      const updated = await playbookPrinciplesService.update(block.key, content);
      setBlocks((prev) => (prev ?? []).map((b) => (b.key === block.key ? updated : b)));
      setDraft((d) => { const c = { ...d }; delete c[block.key]; return c; });
      toast.success(content ? 'Princípio salvo — vale em todos os clientes.' : 'Voltou ao padrão da casa.');
    } catch {
      toast.error('Não consegui salvar esse princípio.');
    } finally {
      setSavingKey(null);
    }
  };

  const reset = (block: PlaybookPrinciple) => {
    setDraft((d) => ({ ...d, [block.key]: block.factory_default }));
    void save(block, '');
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...</p>;
  }

  if (erro) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {erro}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4" /> Valem em todos os clientes
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          São as regras que não mudam de imobiliária pra imobiliária. O roteiro de venda — o que
          perguntar, como conduzir, qual o próximo passo — é de cada cliente e fica na tela da IA
          Vendedora dele. Campo em branco volta ao padrão da casa.
        </p>
      </div>

      {(blocks ?? []).map((block) => {
        const value = draft[block.key] ?? block.content;

        return (
          <div key={block.key}>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`pr-${block.key}`} className="text-sm">
                {block.label}
                {block.customized && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    reescrito
                  </span>
                )}
              </Label>
              <div className="flex items-center gap-1">
                {savingKey === block.key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {block.customized && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => reset(block)}>
                    <RotateCcw className="h-3 w-3" /> Voltar ao padrão
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              id={`pr-${block.key}`}
              rows={8}
              className="mt-1 font-mono text-[11px] leading-relaxed"
              value={value}
              onChange={(e) => setDraft((d) => ({ ...d, [block.key]: e.target.value }))}
              onBlur={(e) => { void save(block, e.target.value); }}
            />
          </div>
        );
      })}

      <p className="text-[11px] text-muted-foreground">
        Os trechos entre chaves são preenchidos na hora da conversa. Apagá-los tira a informação
        do texto que a IA recebe.
      </p>
    </div>
  );
}
