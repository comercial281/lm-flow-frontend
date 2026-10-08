// src/features/cardDoLead/historico/HistoricoDoLead.tsx
//
// Histórico do lead (E5 do funil, spec 2026-10-07 §6). O servidor manda cada
// linha PRONTA (título, detalhe, quem, quando, tom); a tela só desenha.
//
// Dois modos:
//   compacto — janela do card: Histórico e Observações continuam SEPARADOS
//              (decisão de 02/10). Sem filtro Observações e sem linha de nota:
//              a nota está na caixa Observações, ao lado.
//   completo — página do card: caixa de escrever observação no topo e
//              Observações como mais um filtro (o modelo "Comentários" do Praedium).
//
// Os filtros são botões (EtiquetasDeEscolha), não abas: a regra da casa é um
// nível de abas por tela, e a página já tem as dela. EtiquetasDeEscolha é de
// várias escolhas; aqui vira escolha única no aoMudar (clicar no ligado volta
// pro Tudo).
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Loader2, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Textarea } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import EtiquetasDeEscolha from '@/components/base/EtiquetasDeEscolha';
import { quandoAcontece } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { notesService } from '@/services/notes/notesService';
import {
  leadTimelineService,
  type LeadTimelineCategory,
  type LeadTimelineEvent,
  type LeadTimelineTone,
} from '@/services/contacts/leadTimelineService';

const FILTROS: { valor: LeadTimelineCategory; rotulo: string }[] = [
  { valor: 'resumo', rotulo: 'Tudo' },
  { valor: 'atividade', rotulo: 'Atividades' },
  { valor: 'observacao', rotulo: 'Observações' },
  { valor: 'rodizio', rotulo: 'Rodízios' },
  { valor: 'alteracao', rotulo: 'Alterações' },
];

const VAZIO_POR_FILTRO: Record<LeadTimelineCategory, string> = {
  resumo: 'Nada registrado ainda',
  atividade: 'Nenhuma tarefa ou visita ainda',
  observacao: 'Nenhuma observação ainda',
  rodizio: 'Este lead não passou pela roleta',
  alteracao: 'Nenhuma alteração registrada',
};

// Só tokens do tema: vermelho = destructive, verde = lm-success, aviso = lm-star.
const TOM: Record<LeadTimelineTone, { ponto: string; titulo: string }> = {
  neutral: { ponto: 'bg-primary', titulo: 'text-foreground' },
  success: { ponto: 'bg-lm-success', titulo: 'text-lm-success' },
  danger: { ponto: 'bg-destructive', titulo: 'text-destructive' },
  warning: { ponto: 'bg-lm-star', titulo: 'text-foreground' },
};

export interface HistoricoDoLeadProps {
  contactId: string | null;
  modo: 'compacto' | 'completo';
  /** Funil do card aberto: evento de OUTRO funil do mesmo lead mostra o nome do funil dele. */
  funilAtual?: string | null;
  /** Muda quando o card muda (ver useVersaoDoHistorico): recarrega do começo. */
  versao?: string | number;
  /** Só no completo: caixa de escrever e filtro Observações (chave `card_notes` do cliente). */
  comObservacoes?: boolean;
}

type Estado = 'carregando' | 'pronto' | 'erro';

// Compacto: se a página só trouxe observações (que aqui não aparecem), busca a
// próxima sozinho — no máximo estas vezes por carga, depois fica o "Carregar mais".
const MAX_PULOS_SO_DE_NOTAS = 3;

export default function HistoricoDoLead({
  contactId,
  modo,
  funilAtual = null,
  versao = 0,
  comObservacoes = true,
}: HistoricoDoLeadProps) {
  const completo = modo === 'completo';
  const escreve = completo && comObservacoes;
  const filtros = FILTROS.filter(f => f.valor !== 'observacao' || escreve);

  const [categoria, setCategoria] = useState<LeadTimelineCategory>('resumo');
  const [eventos, setEventos] = useState<LeadTimelineEvent[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>('carregando');
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [falhouMais, setFalhouMais] = useState(false);
  const [texto, setTexto] = useState('');
  const [postando, setPostando] = useState(false);
  // Resposta velha (trocou de filtro no meio) não pinta por cima da nova.
  const pedido = useRef(0);
  const pulos = useRef(0);

  const carregar = useCallback(async () => {
    if (!contactId) return;
    const meu = ++pedido.current;
    pulos.current = 0;
    setEstado('carregando');
    setFalhouMais(false);
    // Um "Carregar mais" atropelado por esta carga não desliga sozinho (o finally
    // dele ignora resposta velha): sem isto o botão da lista nova nasce travado.
    setCarregandoMais(false);
    try {
      const pagina = await leadTimelineService.list(contactId, { category: categoria });
      if (meu !== pedido.current) return;
      setEventos(pagina.events);
      setProximo(pagina.next_before);
      setEstado('pronto');
    } catch {
      if (meu !== pedido.current) return;
      setEventos([]);
      setProximo(null);
      setEstado('erro');
    }
  }, [contactId, categoria]);

  useEffect(() => {
    void carregar();
  }, [carregar, versao]);

  const carregarMais = useCallback(async () => {
    if (!contactId || !proximo) return;
    const meu = pedido.current;
    setCarregandoMais(true);
    setFalhouMais(false);
    try {
      const pagina = await leadTimelineService.list(contactId, { category: categoria, before: proximo });
      if (meu !== pedido.current) return;
      setEventos(atuais => {
        const vistos = new Set(atuais.map(e => e.id));
        return [...atuais, ...pagina.events.filter(e => !vistos.has(e.id))];
      });
      setProximo(pagina.next_before);
    } catch {
      if (meu === pedido.current) setFalhouMais(true);
    } finally {
      if (meu === pedido.current) setCarregandoMais(false);
    }
  }, [contactId, categoria, proximo]);

  // Na janela a nota mora na caixa Observações, ao lado: aqui ela sairia em dobro.
  const visiveis = completo ? eventos : eventos.filter(e => e.kind !== 'note_added');
  const paginaSoDeNotas = !completo && visiveis.length === 0;

  useEffect(() => {
    if (!paginaSoDeNotas || estado !== 'pronto' || !proximo || carregandoMais || falhouMais) return;
    if (pulos.current >= MAX_PULOS_SO_DE_NOTAS) return;
    pulos.current += 1;
    void carregarMais();
  }, [paginaSoDeNotas, estado, proximo, carregandoMais, falhouMais, carregarMais]);

  const postar = useCallback(async () => {
    const conteudo = texto.trim();
    // O Ctrl+Enter não passa pelo botão desabilitado: sem isto, duas teclas = duas notas.
    if (!conteudo || !contactId || postando) return;
    setPostando(true);
    try {
      await notesService.create(contactId, { content: conteudo });
      setTexto('');
      void carregar();
    } catch {
      toast.error('Não consegui salvar a observação');
    } finally {
      setPostando(false);
    }
  }, [texto, contactId, postando, carregar]);

  if (!contactId) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sem contato vinculado para mostrar o histórico.
      </p>
    );
  }

  return (
    <section aria-label="Histórico do lead" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          Histórico
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => void carregar()}
          disabled={estado === 'carregando'}
          aria-label="Atualizar histórico"
          title="Atualizar histórico"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', estado === 'carregando' && 'animate-spin')} />
        </Button>
      </div>

      <div className="shrink-0">
        <EtiquetasDeEscolha
          rotulo="Filtrar o histórico"
          opcoes={filtros}
          escolhidas={[categoria]}
          aoMudar={escolhidas =>
            setCategoria((escolhidas.find(v => v !== categoria) as LeadTimelineCategory | undefined) ?? 'resumo')
          }
        />
      </div>

      {escreve && (
        <div className="shrink-0 space-y-2">
          <Textarea
            aria-label="Escrever observação"
            placeholder="Escreva uma observação para a equipe..."
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void postar();
              }
            }}
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ctrl + Enter para postar</span>
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void postar()} disabled={postando || !texto.trim()}>
              {postando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Postar
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {estado === 'carregando' ? (
          <div role="status" aria-label="Carregando o histórico" className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : estado === 'erro' ? (
          <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} className="py-8" />
        ) : visiveis.length === 0 && !proximo ? (
          <EmptyState
            title={VAZIO_POR_FILTRO[categoria]}
            description="Quando algo acontecer com este lead, aparece aqui."
            className="py-8"
          />
        ) : (
          <>
            <ul className="space-y-3">
              {visiveis.map(evento => (
                <LinhaDoHistorico key={evento.id} evento={evento} funilAtual={funilAtual} />
              ))}
            </ul>
            {proximo && (
              <div className="flex flex-col items-center gap-1 pt-3">
                {falhouMais && <p className="text-xs text-destructive">Não deu pra carregar mais.</p>}
                <Button variant="outline" size="sm" onClick={() => void carregarMais()} disabled={carregandoMais}>
                  {carregandoMais && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function LinhaDoHistorico({ evento, funilAtual }: { evento: LeadTimelineEvent; funilAtual: string | null }) {
  const tom = TOM[evento.tone] ?? TOM.neutral;
  const outroFunil =
    evento.pipeline_name && evento.pipeline_name !== funilAtual ? `funil ${evento.pipeline_name}` : null;
  const rodape = [evento.actor ? `por ${evento.actor}` : null, quandoAcontece(evento.occurred_at), outroFunil]
    .filter(Boolean)
    .join(' · ');

  return (
    <li data-tom={evento.tone} className="flex gap-2.5 text-sm">
      <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', tom.ponto)} />
      <div className="min-w-0 flex-1">
        <p className={cn('break-words font-medium', tom.titulo)}>{evento.title}</p>
        {/* Quebra em vez de cortar: o texto do servidor é a única explicação de
            eventos como os da roleta. */}
        {evento.detail && (
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{evento.detail}</p>
        )}
        <p className="text-xs text-muted-foreground">{rodape}</p>
      </div>
    </li>
  );
}
