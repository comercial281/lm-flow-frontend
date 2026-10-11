// Ensinar · Regras: lições `rule`. Nova regra em cima, medidor "N de 12 valendo"
// (o servidor diz quais valem: `in_use`), aviso quando alguma ligada ficou de fora,
// filtros e a lista com chave (pausar), selo de origem e ⋮ (Editar, Pausar, Excluir).
import { useMemo, useState } from 'react';
import { AlertTriangle, MoreVertical, Plus, SquareCheck } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import Chave from '@/components/base/Chave';
import Abas from '@/components/base/Abas';
import EmptyState from '@/components/base/EmptyState';
import { cn } from '@/lib/utils';
import type { SalesAgentLesson } from '@/services/salesAgents/salesAgentsService';
import { LIMITE_DO_TEXTO, regrasForaDoLimite } from '../paginas';
import { SeloDeOrigem, dataCurta } from './LinhaDaLicao';
import type { PropsDaPaginaDoEnsinar } from './tipos';

type Filtro = 'todas' | 'mao' | 'sugestoes' | 'pausadas';
const FILTROS: { chave: Filtro; rotulo: string; passa: (l: SalesAgentLesson) => boolean }[] = [
  { chave: 'todas', rotulo: 'Todas', passa: () => true },
  { chave: 'mao', rotulo: 'Escritas à mão', passa: (l) => l.origin === 'manual' },
  { chave: 'sugestoes', rotulo: 'Das sugestões', passa: (l) => l.origin === 'suggestion' },
  { chave: 'pausadas', rotulo: 'Pausadas', passa: (l) => !l.enabled },
];

export default function Regras({ licoes: L, confirmar }: PropsDaPaginaDoEnsinar) {
  const regras = useMemo(() => L.licoes.filter((l) => l.kind === 'rule'), [L.licoes]);
  const [nova, setNova] = useState('');
  const [gravando, setGravando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);

  const limite = L.limites.per_kind;
  const valendo = regras.filter((r) => r.in_use).length;
  const fora = regrasForaDoLimite(regras);
  const visiveis = regras.filter(FILTROS.find((f) => f.chave === filtro)!.passa);

  const adicionar = async () => {
    const t = nova.trim();
    if (!t || gravando) return;
    setGravando(true);
    try { if (await L.criar('rule', t)) { setNova(''); setFiltro('todas'); } } finally { setGravando(false); }
  };
  const apagar = async (r: SalesAgentLesson) => {
    if (!(await confirmar({ titulo: 'Excluir regra', descricao: r.content, rotuloDaAcao: 'Excluir', destrutivo: true }))) return;
    await L.apagar(r.id);
  };
  const salvarEdicao = async () => {
    if (!editando?.texto.trim()) return;
    if (await L.atualizar(editando.id, { content: editando.texto.trim() })) setEditando(null);
  };

  return (
    <div className="space-y-5">
      <Secoes>
        <Secao titulo="Nova regra" descricao={`Ela lê as ${limite} regras ligadas mais novas.`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <CampoTexto id="en-nova-regra" rotulo="Nova regra" maxLength={LIMITE_DO_TEXTO} className="flex-1" valor={nova} aoMudar={setNova}
              placeholder="Ex.: Não prometa aprovação de financiamento."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }} />
            <Button type="button" onClick={() => void adicionar()} disabled={!nova.trim() || gravando}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar
            </Button>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-2 max-w-[260px] flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', valendo >= limite ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.min(100, (valendo / limite) * 100)}%` }} />
            </div>
            <span><b className="text-foreground">{valendo} de {limite}</b> valendo</span>
          </div>
        </Secao>
      </Secoes>

      {fora > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p><b>{fora === 1 ? '1 regra não está valendo.' : `${fora} regras não estão valendo.`}</b> Ela só lê as {limite} regras ligadas mais novas. Pause uma que não faz mais sentido ou junte duas numa só.</p>
        </div>
      )}

      {L.estado === 'erro' ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void L.carregar()} />
      ) : L.estado === 'carregando' ? (
        <Secoes>
          <div role="status" aria-label="Carregando as regras" className="space-y-4 py-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
          </div>
        </Secoes>
      ) : regras.length === 0 ? (
        <EmptyState icon={SquareCheck} title="Nenhuma regra ainda" description="Escreva a primeira no campo acima. As sugestões que você aceitar no Painel também aparecem aqui." />
      ) : (
        <Secoes>
          <Abas rotulo="Filtrar regras" ativa={filtro} aoTrocar={(c) => setFiltro(c as Filtro)} className="pt-2"
            abas={FILTROS.map((f) => ({ chave: f.chave, rotulo: f.rotulo, contagem: regras.filter(f.passa).length }))} />
          {visiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma regra neste filtro.</p>
          ) : (
            <ul className="divide-y divide-border">
              {visiveis.map((r) => {
                const naoVale = r.enabled && !r.in_use;
                return (
                  <li key={r.id} className="flex items-start gap-4 py-4">
                    <Chave rotulo={r.content} semRotuloVisivel semAviso ligada={r.enabled} aoMudar={(v) => L.atualizar(r.id, { enabled: v })} genero="a" />
                    {editando?.id === r.id ? (
                      <div className="flex flex-1 flex-col gap-2">
                        <CampoTexto id={`en-regra-${r.id}`} rotulo="Editar regra" maxLength={LIMITE_DO_TEXTO} valor={editando.texto} aoMudar={(t) => setEditando({ id: r.id, texto: t })} />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => void salvarEdicao()}>Pronto</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[15px] leading-snug', !r.enabled && 'text-muted-foreground', naoVale && 'text-amber-900 dark:text-amber-300')}>{r.content}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <SeloDeOrigem licao={r} />
                          <span>{dataCurta(r.created_at)}</span>
                          {naoVale && <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-800 dark:text-amber-300">Não está valendo</span>}
                          {!r.enabled && <span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold">Pausada</span>}
                        </div>
                      </div>
                    )}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Ações da regra ${r.content}`} className="text-muted-foreground">
                          <MoreVertical className="h-4 w-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditando({ id: r.id, texto: r.content })}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void L.atualizar(r.id, { enabled: !r.enabled })}>{r.enabled ? 'Pausar' : 'Ligar'}</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onSelect={() => void apagar(r)}>Excluir</DropdownMenuItem>
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
