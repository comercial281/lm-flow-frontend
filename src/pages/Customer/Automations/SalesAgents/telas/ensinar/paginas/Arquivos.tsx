// Ensinar · Arquivos (era a aba Base de conhecimento): aviso de uma frase, Subir
// arquivo / Escrever texto, área de soltar de duas medidas e os cartões em 2 colunas
// com selos e a linha "Manda …" (ou a pendência "Falta dizer quando mandar").
// Upload, validação e "Ver como chega" são os mesmos de antes; a releitura de 4 s
// com arquivo em processamento mora no useArquivos.
import { useId, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { AlignLeft, Film, FileText, ImageIcon, Info, MoreVertical, PenLine, RefreshCw, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import {
  Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { cn } from '@/lib/utils';
import { numero } from '@/lib/formato';
import { salesAgentsService, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import { processingLabel, processingWarning } from '@/features/salesAgents/documentStatus';
import { DOC_ACCEPT, docUploadError } from '../../../docUpload';
import JanelaDoArquivo, { JanelaDeTexto } from './JanelaDoArquivo';
import type { PropsDaPaginaDoEnsinar } from './tipos';

const TEXTO_DA_AREA = 'Arraste arquivos pra cá · PDF, Word, planilha, imagem ou vídeo, até 25 MB';
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

/** "Quando o lead pedir" → "quando o lead pedir", pra caber depois de "Manda". Sigla fica como está. */
function depoisDeManda(texto: string): string {
  return /^\p{Lu}\p{Ll}/u.test(texto) ? texto[0].toLowerCase() + texto.slice(1) : texto;
}

export default function Arquivos({ agent, arquivos: A, confirmar }: PropsDaPaginaDoEnsinar) {
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
      const doc = await salesAgentsService.uploadFileDocument(agent.id, file, undefined, setProgress);
      toast.success('Arquivo enviado. Diga agora como ela deve usar ele.');
      await A.aoCriar();
      // Abre a janela na sequência: subir sem responder "quando mandar" deixa o
      // arquivo mudo, e ninguém volta depois pra preencher.
      setAberto(doc);
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
    if (!(await confirmar({ titulo: 'Apagar arquivo', descricao: d.title, rotuloDaAcao: 'Apagar', destrutivo: true }))) return;
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
      <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          <b>Os imóveis já estão conectados:</b> preço e características vêm do cadastro, sempre atualizados. Aqui vai o
          resto: condições de pagamento, documentação, perguntas frequentes. Evite tabela de preço, ela envelhece e
          contradiz o cadastro.
        </p>
      </div>

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
            vazio ? 'flex-col items-center gap-2 px-6 py-12 text-center' : 'items-center justify-center gap-2 px-4 py-3 text-sm',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
        >
          {vazio ? (
            <>
              <Upload className="h-5 w-5" aria-hidden />
              <span className="text-base font-semibold text-foreground">Nenhum arquivo ainda</span>
              <span className="text-sm">{TEXTO_DA_AREA}</span>
            </>
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
        <div role="status" aria-label="Carregando os arquivos" className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : A.docs.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {A.docs.map((d) => {
            const espera = d.status === 'pending' ? processingLabel(d.created_at) : null;
            const aviso = d.status === 'pending' ? processingWarning(d.created_at) : null;
            const quando = (d.send_when ?? '').trim();
            return (
              <li key={d.id}>
                <Card className="h-full flex-row items-start gap-2 p-4">
                  <button type="button" onClick={() => setAberto(d)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <IconeDoArquivo doc={d} />
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="sr-only">Como ela usa: </span>
                      <span className="block truncate text-[15px] font-semibold">{d.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.size_label ?? `${numero(d.char_count)} caracteres`}
                        {/* "Processando…" do primeiro minuto já é o selo; depois diz HÁ QUANTO TEMPO. */}
                        {espera && espera !== processingLabel(null) && <> · <span>{espera}</span></>}
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {d.learnable && d.status === 'ready' && <span className={cn(SELO, 'bg-primary/10 text-primary')}>Aprende</span>}
                        {d.sendable && <span className={cn(SELO, 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300')}>Manda pro lead</span>}
                        {d.send_mode === 'link' && <span className={cn(SELO, 'bg-amber-500/15 text-amber-800 dark:text-amber-300')}>Vai como link</span>}
                        {d.send_mode === 'blocked' && <span className={cn(SELO, 'bg-red-500/10 text-red-700 dark:text-red-400')}>Grande demais</span>}
                        {d.status === 'pending' && <span className={cn(SELO, 'bg-muted text-muted-foreground')}>Lendo o arquivo…</span>}
                        {/* Arquivo íntegro, só sem texto: o envio funciona. Pintar de
                            vermelho aqui fazia o dono apagar e subir de novo. */}
                        {d.status === 'no_text' && <span className={cn(SELO, 'bg-amber-500/15 text-amber-800 dark:text-amber-300')}>Sem texto pra aprender</span>}
                        {d.status === 'failed' && <span className={cn(SELO, 'bg-red-500/10 text-red-700 dark:text-red-400')}>Falhou: {d.error_message}</span>}
                      </span>
                      {/* Espera que passou do normal DIZ isso, em vez de continuar igual.
                          Sem esta linha, o único desfecho visível de um arquivo travado era
                          a pessoa concluir que o CRM quebrou. */}
                      {aviso && <span className="block text-xs text-amber-700 dark:text-amber-400">{aviso}</span>}
                      {d.sendable && (quando
                        ? <span className="block text-sm text-muted-foreground">Manda {depoisDeManda(quando)}</span>
                        : <span className="block text-sm font-semibold text-amber-700 dark:text-amber-400">Falta dizer quando mandar</span>)}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Ações do arquivo ${d.title}`} className="shrink-0 text-muted-foreground">
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setAberto(d)}>
                        <SlidersHorizontal className="h-4 w-4" aria-hidden /> Como ela usa
                      </DropdownMenuItem>
                      {/* Também em "Processando", não só em falha: um arquivo cujo
                          processamento se perdeu num deploy fica pendente sem nenhuma
                          alavanca — era preciso apagar e subir de novo pra destravar. */}
                      {(d.status === 'failed' || d.status === 'pending') && (
                        <DropdownMenuItem onSelect={() => tentarDeNovo(d)}>
                          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar de novo
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => void apagar(d)}>
                        <Trash2 className="h-4 w-4" aria-hidden /> Apagar
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
