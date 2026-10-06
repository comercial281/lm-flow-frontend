import { useCallback, useEffect, useState } from 'react';
import { Button, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { playbookPrinciplesService, type PlaybookPrinciple } from '@/services/superAdmin/globalBrainService';
import { ESQUELETO, SELO } from '@/pages/Admin/Area/estilo';

/**
 * O COMANDO da IA Vendedora, editável pela Leal Mídia — os TREZE blocos.
 *
 * Desde 2026-09-04 entram aqui também os blocos de ROTEIRO (o método de venda, a
 * condução, as objeções, a doutrina de visita): o alicerce é ativo da casa. O que
 * é de cada imobiliária são os PONTOS-CHAVE — as perguntas dela, as objeções dela,
 * o tipo de venda — que preenchem os encaixes do texto ({situacao},
 * {lista_objecoes}, {lead_pronto}...). Esses moram na tela da IA Vendedora de
 * cada cliente. Editado aqui, vale em todos os clientes de uma vez.
 *
 * A separação que ficou: a Leal Mídia manda no TEXTO, a imobiliária manda no
 * RECHEIO. Por isso os encaixes ficam à mostra aqui — são o que precisa ser
 * preservado ao reescrever; apagar um encaixe tira o ponto-chave de TODO cliente.
 *
 * 06/10/2026: salvar (e voltar ao padrão) CONFIRMA, porque vale para as IAs de
 * todos os clientes. Por isso o bloco não grava mais ao sair do campo: grava no
 * botão Salvar, que só aparece quando o texto mudou.
 */

// Os dois formatos de erro da API: o padrão traz `error.message`, e a recusa por
// cargo traz `error` como TEXTO com a explicação em `message`. Ler só o primeiro
// faz a recusa virar frase genérica e manda procurar o problema no lugar errado.
function motivo(e: unknown): string | null {
  const r = (e as { response?: { data?: { error?: unknown; message?: string } } }).response?.data;
  return (
    (typeof r?.error === 'object' && (r.error as { message?: string })?.message) ||
    (typeof r?.error === 'string' ? r.error : null) ||
    r?.message ||
    null
  );
}

// Vazio ou igual ao de fábrica = volta ao padrão (vazio HERDA, nunca desliga).
function conteudoParaSalvar(block: PlaybookPrinciple, text: string): string {
  const trimmed = text.trim();
  return !trimmed || trimmed === block.factory_default.trim() ? '' : trimmed;
}

export default function PrincipiosIA() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [blocks, setBlocks] = useState<PlaybookPrinciple[] | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEstado('carregando');
    try {
      setBlocks(await playbookPrinciplesService.list());
      setErro(null);
      setEstado('pronto');
    } catch (e) {
      setErro(motivo(e));
      setBlocks(null);
      setEstado('erro');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const atual = (block: PlaybookPrinciple) => (block.customized ? block.content : '');
  const mudou = (block: PlaybookPrinciple) =>
    draft[block.key] !== undefined && conteudoParaSalvar(block, draft[block.key]) !== atual(block);

  const descartar = (key: string) => setDraft((d) => { const c = { ...d }; delete c[key]; return c; });

  const save = async (block: PlaybookPrinciple, text: string) => {
    const content = conteudoParaSalvar(block, text);
    if (content === atual(block)) return;
    if (
      !(await confirmar({
        titulo: content ? `Salvar "${block.label}"?` : `Voltar "${block.label}" ao padrão?`,
        descricao: 'Vale para as IAs de todos os clientes.',
        rotuloDaAcao: content ? 'Salvar para todos' : 'Voltar ao padrão',
      }))
    )
      return;

    setSavingKey(block.key);
    try {
      const updated = await playbookPrinciplesService.update(block.key, content);
      setBlocks((prev) => (prev ?? []).map((b) => (b.key === block.key ? updated : b)));
      descartar(block.key);
      toast.success(content ? 'Princípio salvo — vale em todos os clientes.' : 'Voltou ao padrão da casa.');
    } catch (e) {
      const detalhe = motivo(e);
      toast.error(detalhe ? `Não salvou: ${detalhe}` : 'Não consegui salvar esse bloco.');
    } finally {
      setSavingKey(null);
    }
  };

  if (estado === 'carregando') return <div aria-busy="true" className={`h-40 ${ESQUELETO}`} />;

  if (estado === 'erro') {
    return (
      <EmptyState
        tipo="erro"
        title="Não deu pra carregar os princípios"
        description={erro ?? undefined}
        aoTentarDeNovo={() => void load()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Valem em todos os clientes
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          O alicerce da venda e as regras da casa. Os trechos entre chaves são os encaixes
          que cada imobiliária preenche na tela da IA Vendedora dela (as perguntas dela, as
          objeções dela, o tipo de venda) — apagar um encaixe tira o ponto-chave de TODO
          cliente. Campo em branco volta ao padrão da casa.
        </p>
      </div>

      {(['flow', 'principle'] as const).map((kind) => (
        <div key={kind} className="flex flex-col gap-4">
          <p className="text-sm font-semibold">{kind === 'flow' ? 'O alicerce da venda' : 'Regras da casa'}</p>
          {(blocks ?? []).filter((b) => (b.kind ?? 'principle') === kind).map((block) => {
            const value = draft[block.key] ?? block.content;
            return (
              <div key={block.key}>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`pr-${block.key}`} className="text-sm">
                    {block.label}
                    {block.customized && <span className={`ml-2 ${SELO} border-primary/30 font-normal text-primary`}>reescrito</span>}
                  </Label>
                  <div className="flex items-center gap-1">
                    {savingKey === block.key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />}
                    {block.customized && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={savingKey === block.key} onClick={() => void save(block, '')}>
                        <RotateCcw className="h-3 w-3" aria-hidden="true" /> Voltar ao padrão
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
                />
                {mudou(block) && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" disabled={savingKey === block.key} onClick={() => void save(block, value)}>Salvar</Button>
                    <Button size="sm" variant="ghost" disabled={savingKey === block.key} onClick={() => descartar(block.key)}>Descartar</Button>
                    <span className="text-[11px] text-muted-foreground">alterações não salvas</span>
                  </div>
                )}
                {(block.allowed_markers ?? []).length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Este bloco aceita:{' '}
                    {block.allowed_markers.map((m) => (
                      <code key={m} className="mr-1 rounded bg-muted px-1 py-0.5 text-[10px]">{`{${m}}`}</code>
                    ))}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground">
        Os trechos entre chaves são preenchidos na hora da conversa — pelos pontos-chave da
        imobiliária ou pelo exemplo de fábrica. Marcador que o bloco não aceita é recusado ao
        salvar, porque iria como texto literal para a IA.
      </p>
      {dialogoDeConfirmacao}
    </div>
  );
}
