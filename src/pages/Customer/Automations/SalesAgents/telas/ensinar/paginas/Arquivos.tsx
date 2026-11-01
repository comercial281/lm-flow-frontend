// Ensinar · Arquivos e prova social (Tarefa 75): o que ela CONSULTA pra responder. Aviso de uma frase, Subir
// arquivo / Escrever texto, área de soltar de duas medidas e os cartões em 2 colunas com selos. O que ela MANDA
// pro lead foi pra Materiais (quando mandar, mensagem junto, uma vez só); aqui o arquivo pode ser ligado a
// imóveis (`property_codes`). Embaixo, a Prova social: um caso por linha no mesmo campo `social_proof`.
// Upload e validação são os mesmos de antes; a releitura de 4 s com arquivo em processamento mora no useArquivos.
import { useId, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { AlignLeft, Film, FileText, ImageIcon, PenLine, Pencil, Plus, Quote, RefreshCw, SlidersHorizontal, Star, Trash2, Upload } from 'lucide-react';
import {
  Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import EmptyState from '@/components/base/EmptyState';
import Aviso from '@/components/base/Aviso';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import Carregando from '@/components/base/Carregando';
import { cn } from '@/lib/utils';
import { numero } from '@/lib/formato';
import { salesAgentsService, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import { processingLabel, processingWarning } from '@/features/salesAgents/documentStatus';
import { DOC_ACCEPT, DOC_MAX_BYTES, VIDEO_MAX_BYTES, docUploadError } from '../../../docUpload';
import { LIMITE_DO_TEXTO, casosDe, textoDosCasos } from '../paginas';
import JanelaDoArquivo, { JanelaDeTexto } from './JanelaDoArquivo';
import type { PropsDaPaginaDoEnsinar } from './tipos';

// Os limites saem do docUpload (o mesmo que barra o arquivo): vídeo tem teto menor (WhatsApp).
const MB = 1024 * 1024;
const TEXTO_DA_AREA = `Arraste arquivos pra cá · PDF, Word, planilha, texto, imagem ou vídeo MP4, até ${DOC_MAX_BYTES / MB} MB (vídeo até ${VIDEO_MAX_BYTES / MB} MB)`;
const SELO = 'rounded-full px-2.5 py-0.5 text-xs font-semibold';

function IconeDoArquivo({ doc }: { doc: SalesAgentDocument }) {
  const [Icone, cor] = doc.media_kind === 'image' ? [ImageIcon, 'bg-sky-500/10 text-sky-600 dark:text-sky-400']
    : doc.media_kind === 'video' ? [Film, 'bg-amber-500/10 text-amber-600 dark:text-amber-400']
    : doc.source_type === 'text' ? [AlignLeft, 'bg-primary/10 text-primary']
    : [FileText, 'bg-red-500/10 text-red-600 dark:text-red-400'];
  return (
    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', cor)}>
      <Icone className="h-5 w-5" aria-hidden />
    </span>
  );
}

export default function Arquivos(props: PropsDaPaginaDoEnsinar) {
  return (
    <div className="space-y-8">
      <ArquivosDaIa {...props} />
      <ProvaSocial {...props} />
    </div>
  );
}

function ArquivosDaIa({ agent, arquivos: A, confirmar }: PropsDaPaginaDoEnsinar) {
  const idDoSeletor = useId();
  const seletor = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Arquivo aberto na janela "Como ela usa este arquivo".
  const [aberto, setAberto] = useState<SalesAgentDocument | null>(null);
  const [escrevendo, setEscrevendo] = useState(false);

  const upload = async (file: File) => {
    if (busy) return;
    const erro = docUploadError(file);
    if (erro) {
      toast.error(erro);
      return;
    }
    setBusy(true); setProgress(0);
    try {
      await salesAgentsService.uploadFileDocument(agent.id, file, undefined, setProgress);
      toast.success('Arquivo enviado. Pra ela mandar ao lead, ligue em Materiais.');
      await A.aoCriar();
    } catch {
      toast.error('Não deu pra subir o arquivo. Tente de novo.');
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void upload(f);
  };

  const apagar = async (d: SalesAgentDocument) => {
    if (!(await confirmar({ titulo: 'Excluir arquivo', descricao: d.title, rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    await A.apagar(d);
  };

  const tentarDeNovo = (d: SalesAgentDocument) => {
    A.reprocessar(d).catch(() => toast.error('Não deu pra tentar de novo agora.'));
  };

  const vazio = A.estado === 'pronto' && A.docs.length === 0;

  return (
    <div className="space-y-5">
      {/* O texto antigo mandava "suba a tabela de imóveis" e dizia que a IA
          respondia SÓ com base nisto. Deixou de ser verdade quando a busca no
          catálogo entrou: ela consulta os imóveis cadastrados a cada mensagem.
          Pior que desatualizado, o conselho era ruim — uma tabela colada aqui
          envelhece e passa a contradizer o preço real do cadastro. */}
      <Aviso tom="info" titulo="Os imóveis já estão conectados:">
        preço e características vêm do cadastro, sempre atualizados. Aqui vai o resto: condições de pagamento,
        documentação, perguntas frequentes. Evite tabela de preço, ela envelhece e contradiz o cadastro. O que ela
        manda pro lead (quando mandar, mensagem junto) fica em Materiais.
      </Aviso>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => seletor.current?.click()} disabled={busy}>
          <Upload className="mr-1 h-4 w-4" aria-hidden /> Subir arquivo
        </Button>
        <Button type="button" variant="outline" onClick={() => setEscrevendo(true)} disabled={busy}>
          <PenLine className="mr-1 h-4 w-4" aria-hidden /> Escrever texto
        </Button>
        <input
          ref={seletor} id={idDoSeletor} type="file" className="hidden" accept={DOC_ACCEPT} aria-label="Escolher arquivo"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}
        />
      </div>

      {(A.estado === 'pronto' || busy) && (
        <label
          htmlFor={idDoSeletor}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn('flex cursor-pointer rounded-xl border-2 border-dashed text-muted-foreground transition-colors',
            vazio ? 'flex-col' : 'items-center justify-center gap-2 px-4 py-3 text-sm',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
        >
          {/* Sem arquivo nenhum, a área de soltar É o vazio da página (medida grande). */}
          {vazio ? (
            <EmptyState icon={Upload} title="Nenhum arquivo ainda" description={TEXTO_DA_AREA} className="py-12" />
          ) : (
            <>
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
              <span>{TEXTO_DA_AREA}</span>
            </>
          )}
        </label>
      )}
      {progress !== null && (
        <div role="progressbar" aria-label="Subindo o arquivo" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {A.estado === 'erro' ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void A.carregar()} />
      ) : A.estado === 'carregando' ? (
        <Carregando variante="cartoes" linhas={2} rotulo="Carregando os arquivos" />
      ) : A.docs.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {A.docs.map((d) => {
            const aviso = d.status === 'pending' ? processingWarning(d.created_at) : null;
            return (
              <li key={d.id}>
                <Card className="h-full flex-row items-start gap-2 p-4">
                  <button type="button" onClick={() => setAberto(d)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <IconeDoArquivo doc={d} />
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="sr-only">Como ela usa: </span>
                      <span className="block truncate text-[15px] font-semibold">{d.title}</span>
                      {/* Caracteres só do arquivo lido: pendente ou que falhou ainda não tem texto contado. */}
                      {(d.size_label || d.status === 'ready') && (
                        <span className="block text-xs text-muted-foreground">
                          {d.size_label ?? `${numero(d.char_count)} caracteres`}
                        </span>
                      )}
                      <span className="flex flex-wrap gap-1.5">
                        {d.learnable && d.status === 'ready' && <span className={cn(SELO, 'bg-primary/10 text-primary')}>Aprende</span>}
                        {(d.property_codes ?? []).length > 0 && <span className={cn(SELO, 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300')}>{`Ligado a ${d.property_codes.join(', ')}`}</span>}
                        {/* Uma fala só pro pendente: "Lendo o arquivo…" e, passado o primeiro minuto, HÁ QUANTO TEMPO. */}
                        {d.status === 'pending' && <span className={cn(SELO, 'bg-muted text-muted-foreground')}>{processingLabel(d.created_at)}</span>}
                        {/* Arquivo íntegro, só sem texto: o envio funciona. Pintar de
                            vermelho aqui fazia o dono apagar e subir de novo. */}
                        {d.status === 'no_text' && <span className={cn(SELO, 'bg-amber-500/15 text-amber-800 dark:text-amber-300')}>Sem texto pra aprender</span>}
                        {d.status === 'failed' && <span className={cn(SELO, 'bg-red-500/10 text-red-700 dark:text-red-400')}>{d.error_message ? `Falhou: ${d.error_message}` : 'Falhou'}</span>}
                      </span>
                      {/* Espera que passou do normal DIZ isso, em vez de continuar igual.
                          Sem esta linha, o único desfecho visível de um arquivo travado era
                          a pessoa concluir que o CRM quebrou. */}
                      {aviso && <span className="block text-xs text-amber-700 dark:text-amber-400">{aviso}</span>}
                    </span>
                  </button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <BotaoMaisAcoes aria-label={`Ações do arquivo ${d.title}`} className="shrink-0 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setAberto(d)}>
                        <SlidersHorizontal className="h-4 w-4" aria-hidden /> Como ela usa
                      </DropdownMenuItem>
                      {/* Também em "Lendo o arquivo…", não só em falha: um arquivo cujo
                          processamento se perdeu num deploy fica pendente sem nenhuma
                          alavanca — era preciso apagar e subir de novo pra destravar. */}
                      {(d.status === 'failed' || d.status === 'pending') && (
                        <DropdownMenuItem onSelect={() => tentarDeNovo(d)}>
                          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => void apagar(d)}>
                        <Trash2 className="h-4 w-4" aria-hidden /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {aberto && (
        <JanelaDoArquivo
          agentId={agent.id}
          doc={aberto}
          aoFechar={() => setAberto(null)}
          aoSalvar={() => { setAberto(null); void A.carregar(); }}
        />
      )}
      {escrevendo && (
        <JanelaDeTexto
          agentId={agent.id}
          aoFechar={() => setEscrevendo(false)}
          aoCriado={() => { setEscrevendo(false); void A.aoCriar(); }}
        />
      )}
    </div>
  );
}

/** Prova social: lista de casos, um por linha no MESMO texto `social_proof` (decisão 4 do spec). Grava na hora; excluir confirma. */
function ProvaSocial({ agent, gravar, confirmar }: PropsDaPaginaDoEnsinar) {
  const casos = casosDe(agent.social_proof);
  const [novo, setNovo] = useState('');
  const [gravando, setGravando] = useState(false);
  const [editando, setEditando] = useState<{ i: number; texto: string } | null>(null);

  const gravarCasos = async (lista: string[]) => {
    setGravando(true);
    try { return await gravar({ social_proof: textoDosCasos(lista) }); } finally { setGravando(false); }
  };
  const adicionar = async () => {
    const t = novo.trim();
    if (!t || gravando) return;
    if (await gravarCasos([...casos, t])) setNovo('');
  };
  const apagar = async (i: number) => {
    if (gravando) return;
    if (!(await confirmar({ titulo: 'Excluir caso', descricao: casos[i], rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    // A edição aberta aponta pro caso pela POSIÇÃO, que anda quando um sai: fecha
    // pra o "Pronto" não gravar o texto em cima do caso errado.
    setEditando(null);
    await gravarCasos(casos.filter((_, j) => j !== i));
  };
  const salvarEdicao = async () => {
    if (!editando || !editando.texto.trim()) return;
    if (await gravarCasos(casos.map((c, j) => (j === editando.i ? editando.texto : c)))) setEditando(null);
  };

  return (
    <Secoes>
      <Secao titulo="Prova social" descricao="Casos reais que ela pode citar pra gerar confiança. Ela usa um caso por vez, só quando encaixa, e nunca inventa número fora desta lista.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <CampoTexto id="en-novo-caso" rotulo="Novo caso" maxLength={LIMITE_DO_TEXTO} className="flex-1" valor={novo} aoMudar={setNovo}
            placeholder="Ex.: Mais de 300 famílias já pegaram a chave com a gente."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }} />
          <Button type="button" onClick={() => void adicionar()} disabled={!novo.trim() || gravando}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar
          </Button>
        </div>
        {casos.length === 0 ? (
          <EmptyState icon={Star} tamanho="compacto" title="Nenhum caso ainda" description="Sem caso aqui, ela não cita número nem história de cliente." />
        ) : (
          <ul className="divide-y divide-border">
            {casos.map((c, i) => (
              <li key={`${i}-${c}`} className="flex items-start gap-3 py-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Quote className="h-4 w-4" aria-hidden /></span>
                {editando?.i === i ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <CampoTexto id={`en-caso-${i}`} rotulo="Editar caso" maxLength={LIMITE_DO_TEXTO} valor={editando.texto} aoMudar={(t) => setEditando({ i, texto: t })} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void salvarEdicao()} disabled={gravando}>Pronto</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : <p className="flex-1 pt-1 text-[15px] leading-snug">{c}</p>}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <BotaoMaisAcoes aria-label={`Ações do caso ${i + 1}`} className="shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditando({ i, texto: c })}>
                      <Pencil className="h-4 w-4" aria-hidden /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => void apagar(i)}>
                      <Trash2 className="h-4 w-4" aria-hidden /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </Secoes>
  );
}
