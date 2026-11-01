// Ensinar · Lições (`kind = rule`): cada uma é um cartão "Quando" (context) / "Ela" (content), com chave,
// tema e origem. Contador do servidor ("N valendo de M · cabem até 40"), filtro por tema e por origem.
// Lição nova pelos dois campos. O servidor diz quais valem (`in_use`) e quantas ficaram fora por tamanho:
// não existe mais lição que sai calada (spec da fase 6, §6).
import { useMemo, useState } from 'react';
import { BookOpen, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import Chave from '@/components/base/Chave';
import Abas from '@/components/base/Abas';
import { Seletor } from '@/components/base/Seletor';
import EmptyState from '@/components/base/EmptyState';
import Aviso from '@/components/base/Aviso';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import Carregando from '@/components/base/Carregando';
import { cn } from '@/lib/utils';
import type { OrigemDaLicao, SalesAgentLesson, TemaDaLicao } from '@/services/salesAgents/salesAgentsService';
import { LIMITE_DO_TEXTO, ROTULO_DA_ORIGEM, TEMAS } from '../paginas';
import { SeloDeOrigem, dataCurta } from './LinhaDaLicao';
import type { PropsDaPaginaDoEnsinar } from './tipos';

type FiltroDeTema = 'todas' | TemaDaLicao;
type FiltroDeOrigem = 'todas' | OrigemDaLicao | 'pausadas';
const TEMAS_EM_ORDEM = Object.keys(TEMAS) as TemaDaLicao[];

function EscolhaDeTema() {
  return (
    <>
      <option value="">Sem tema</option>
      {TEMAS_EM_ORDEM.map((t) => <option key={t} value={t}>{TEMAS[t]}</option>)}
    </>
  );
}

export default function Licoes({ licoes: L, confirmar }: PropsDaPaginaDoEnsinar) {
  const regras = useMemo(() => L.licoes.filter((l) => l.kind === 'rule'), [L.licoes]);
  const [quando, setQuando] = useState('');
  const [ela, setEla] = useState('');
  const [tema, setTema] = useState('');
  const [gravando, setGravando] = useState(false);
  const [filtroDeTema, setFiltroDeTema] = useState<FiltroDeTema>('todas');
  const [filtroDeOrigem, setFiltroDeOrigem] = useState<FiltroDeOrigem>('todas');
  const [editando, setEditando] = useState<{ id: string; quando: string; ela: string; tema: string } | null>(null);

  const c = L.contadores.regras;
  const total = c.valendo + c.pausadas + c.fora_por_tamanho;
  const visiveis = regras.filter((r) => (filtroDeTema === 'todas' || r.topic === filtroDeTema)
    && (filtroDeOrigem === 'todas' || (filtroDeOrigem === 'pausadas' ? !r.enabled : r.origin === filtroDeOrigem)));
  const filtrando = filtroDeTema !== 'todas' || filtroDeOrigem !== 'todas';

  const adicionar = async () => {
    const q = quando.trim();
    const e = ela.trim();
    if (!q || !e || gravando) return;
    setGravando(true);
    try {
      if (await L.criar('rule', e, q, tema ? { topic: tema as TemaDaLicao } : {})) {
        setQuando(''); setEla(''); setTema(''); setFiltroDeTema('todas'); setFiltroDeOrigem('todas');
      }
    } finally { setGravando(false); }
  };
  const apagar = async (r: SalesAgentLesson) => {
    if (!(await confirmar({ titulo: 'Excluir lição', descricao: r.content, rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    await L.apagar(r.id);
  };
  const salvarEdicao = async () => {
    if (!editando || !editando.ela.trim() || !editando.quando.trim()) return;
    const tema_ = (editando.tema || null) as TemaDaLicao | null;
    if (await L.atualizar(editando.id, { content: editando.ela.trim(), context: editando.quando.trim(), topic: tema_ })) setEditando(null);
  };
  const limpar = () => { setFiltroDeTema('todas'); setFiltroDeOrigem('todas'); };

  return (
    <div className="space-y-5">
      <Secoes>
        <Secao titulo="Nova lição" descricao="Diga quando acontece e o que ela faz. Ela lê as lições ligadas mais novas que couberem.">
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto id="en-licao-quando" rotulo="Quando" maxLength={LIMITE_DO_TEXTO} valor={quando} aoMudar={setQuando}
              placeholder="Ex.: o lead pergunta o valor logo no começo" />
            <CampoTexto id="en-licao-ela" rotulo="Ela" maxLength={LIMITE_DO_TEXTO} valor={ela} aoMudar={setEla}
              placeholder="Ex.: fala da entrada e da parcela antes do valor total"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Campo id="en-licao-tema" rotulo="Tema" className="w-48">
              <Seletor id="en-licao-tema" value={tema} onChange={(e) => setTema(e.target.value)}><EscolhaDeTema /></Seletor>
            </Campo>
            <Button type="button" onClick={() => void adicionar()} disabled={!quando.trim() || !ela.trim() || gravando}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar lição
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={cn('h-full rounded-full', c.valendo >= c.cabem ? 'bg-amber-500' : 'bg-primary')}
                style={{ width: `${Math.min(100, c.cabem ? (c.valendo / c.cabem) * 100 : 0)}%` }} />
            </div>
            <span className="font-semibold text-foreground">{`${c.valendo} valendo de ${total} · cabem até ${c.cabem}`}</span>
            {c.pausadas > 0 && <span>{c.pausadas} pausadas</span>}
          </div>
        </Secao>
      </Secoes>

      {c.fora_por_tamanho > 0 && (
        <Aviso tom="atencao" titulo={`${c.fora_por_tamanho} fora por tamanho.`}>
          Ela só lê o que cabe no texto das lições. Pause as que não fazem mais sentido ou junte duas numa só.
        </Aviso>
      )}

      {L.estado === 'erro' ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void L.carregar()} />
      ) : L.estado === 'carregando' ? (
        <Secoes>
          <Carregando linhas={3} rotulo="Carregando as lições" />
        </Secoes>
      ) : regras.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhuma lição ainda" description="Escreva a primeira acima. As sugestões e correções que você aceitar no Painel também aparecem aqui." />
      ) : (
        <Secoes>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Abas rotulo="Filtrar por tema" ativa={filtroDeTema} aoTrocar={(k) => setFiltroDeTema(k as FiltroDeTema)}
              abas={[
                { chave: 'todas', rotulo: 'Todas', contagem: regras.length },
                ...TEMAS_EM_ORDEM.map((t) => ({ chave: t, rotulo: TEMAS[t], contagem: regras.filter((r) => r.topic === t).length })),
              ]} />
            <Campo id="en-licao-origem" rotulo="Origem" className="w-52">
              <Seletor id="en-licao-origem" value={filtroDeOrigem} onChange={(e) => setFiltroDeOrigem(e.target.value as FiltroDeOrigem)}>
                <option value="todas">Todas</option>
                <option value="equipe">{ROTULO_DA_ORIGEM.equipe}</option>
                <option value="sugestao">{ROTULO_DA_ORIGEM.sugestao}</option>
                <option value="correcao">{ROTULO_DA_ORIGEM.correcao}</option>
                <option value="pausadas">Pausadas</option>
              </Seletor>
            </Campo>
          </div>
          {visiveis.length === 0 ? (
            <EmptyState tipo="semResultado" tamanho="compacto" className="my-4" title="Nenhuma lição neste filtro."
              aoLimparFiltros={filtrando ? limpar : undefined} />
          ) : (
            <ul className="divide-y divide-border">
              {visiveis.map((r) => {
                const naoVale = r.enabled && !r.in_use;
                return (
                  <li key={r.id} className="flex items-start gap-4 py-4">
                    <Chave rotulo={r.content} semRotuloVisivel semAviso ligada={r.enabled} aoMudar={(v) => L.atualizar(r.id, { enabled: v })} genero="a" />
                    {editando?.id === r.id ? (
                      <div className="flex flex-1 flex-col gap-2">
                        <CampoTexto id={`en-licao-q-${r.id}`} rotulo="Editar quando" maxLength={LIMITE_DO_TEXTO} valor={editando.quando} aoMudar={(t) => setEditando({ ...editando, quando: t })} />
                        <CampoTextoLongo id={`en-licao-e-${r.id}`} rotulo="Editar o que ela faz" rows={2} maxLength={LIMITE_DO_TEXTO} valor={editando.ela} aoMudar={(t) => setEditando({ ...editando, ela: t })} />
                        <Campo id={`en-licao-t-${r.id}`} rotulo="Tema da lição" className="w-48">
                          <Seletor id={`en-licao-t-${r.id}`} value={editando.tema} onChange={(e) => setEditando({ ...editando, tema: e.target.value })}><EscolhaDeTema /></Seletor>
                        </Campo>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => void salvarEdicao()} disabled={!editando.quando.trim() || !editando.ela.trim()}>Pronto</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className={cn('text-[15px] leading-snug', !r.enabled && 'text-muted-foreground')}>
                          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quando</span>
                          {r.context ? <span>{r.context}</span> : <span className="text-muted-foreground">sem situação definida</span>}
                        </p>
                        <p className={cn('text-[15px] leading-snug', !r.enabled && 'text-muted-foreground', naoVale && 'text-amber-900 dark:text-amber-300')}>
                          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ela</span>
                          <span>{r.content}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {r.topic && <span className="rounded-full border border-border px-2.5 py-0.5 font-semibold">{TEMAS[r.topic]}</span>}
                          <SeloDeOrigem licao={r} />
                          <span>{dataCurta(r.created_at)}</span>
                          {naoVale && <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-800 dark:text-amber-300">Não está valendo</span>}
                          {!r.enabled && <span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold">Pausada</span>}
                        </div>
                      </div>
                    )}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <BotaoMaisAcoes aria-label={`Ações da lição ${r.content}`} className="shrink-0 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditando({ id: r.id, quando: r.context ?? '', ela: r.content, tema: r.topic ?? '' })}>
                          <Pencil className="h-4 w-4" aria-hidden /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void L.atualizar(r.id, { enabled: !r.enabled })}>
                          {r.enabled ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />} {r.enabled ? 'Pausar' : 'Ligar'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => void apagar(r)}>
                          <Trash2 className="h-4 w-4" aria-hidden /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </Secoes>
      )}
    </div>
  );
}
