import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Chave from '@/components/base/Chave';
import { Campo } from '@/components/base/Campo';
import IconActionButton from '@/components/base/IconActionButton';
import { Seletor } from '@/components/base/Seletor';
import { cn } from '@/lib/utils';
import usersService from '@/services/users/usersService';
import type { User } from '@/types/users';
import {
  mensagemDoServidor,
  roletaConfigService,
  type RoletaConfig,
  type RoletaConfigPayload,
  type RoletaMember,
  type RoletaNextUp,
} from '@/services/roletaConfig/roletaConfigService';
import { moveMember } from '@/pages/Customer/Settings/RoletaConfig/roletaQueueOrder';
import { numeroDoCorretor, posicaoTexto, PRAZOS_EM_MINUTOS, prazoTexto } from '../roletaNovaTextos';

// ── FILA (roleta nova, D4/D5) ───────────────────────────────────────────────
//
// Fila é o único modo: cada lead é oferecido ao próximo da lista, e a vez anda
// a cada oferta. Quem participa é sempre o USUÁRIO (D4); a roleta não tem
// número (D6), então a linha mostra o número próprio do corretor, se houver.
//
// Tudo aqui vale na hora (é lista, não formulário): reordenar, pausar, tirar,
// adicionar e o prazo. Salva com o PATCH de sempre (`members` com `position`);
// a posição gravada é o índice no array (armadilha 1 do modo Fila, 23/09).
//
// Reordenar: arrastar pela alça (mouse, dedo ou teclado: espaço pega, setas
// movem) ou as setas ↑↓ da linha, que são o caminho mais simples no celular.

/** A linha como a tela precisa: o nome resolvido (servidor novo manda `name`). */
type Linha = RoletaMember & { nome: string };

const nomeDoMembro = (m: RoletaMember) => m.name?.trim() || m.user_name?.trim() || 'Corretor';

function linhasDa(roleta: RoletaConfig): Linha[] {
  return [...(roleta.members ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(m => ({ ...m, nome: nomeDoMembro(m) }));
}

/** O que vai no PATCH: a ordem da tela vira `position`, o resto como estava. */
function membrosParaGravar(linhas: Linha[]): RoletaConfigPayload['members'] {
  return linhas.map((m, i) => ({
    user_id: m.user_id,
    weight: m.weight ?? 10,
    is_active: m.is_active,
    position: i,
    personal_whatsapp_number: m.personal_whatsapp_number?.trim() || null,
    ...(m.inbox_id ? { inbox_id: m.inbox_id } : {}),
  }));
}

function Inicial({ nome, foto }: { nome: string; foto?: string | null }) {
  if (foto) return <img src={foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {nome.charAt(0).toUpperCase()}
    </span>
  );
}

interface LinhaProps {
  linha: Linha;
  indice: number;
  total: number;
  ocupado: boolean;
  aoMover: (delta: -1 | 1) => void;
  aoPausar: (ativo: boolean) => Promise<boolean | void>;
  aoTirar: () => void;
  proximo: boolean;
}

function LinhaDaFila({ linha, indice, total, ocupado, aoMover, aoPausar, aoTirar, proximo }: LinhaProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: linha.user_id, disabled: ocupado });
  const estilo = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={estilo}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:flex-nowrap',
        isDragging && 'relative z-10 shadow-lg',
        !linha.is_active && 'bg-muted/40',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${linha.nome} na fila`}
        title={`Arrastar ${linha.nome} na fila`}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-7 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{posicaoTexto(indice)}</span>
      <Inicial nome={linha.nome} foto={linha.user_avatar} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          <span className={cn(!linha.is_active && 'text-muted-foreground line-through')}>{linha.nome}</span>
          {proximo && linha.is_active && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">próximo</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {linha.is_active ? numeroDoCorretor(linha.phone_display, linha.phone_status) : 'Pausado: é pulado na fila'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconActionButton label={`Subir ${linha.nome} na fila`} variant="ghost" disabled={ocupado || indice === 0} onClick={() => aoMover(-1)} icon={<ArrowUp className="h-4 w-4" />} />
        <IconActionButton label={`Descer ${linha.nome} na fila`} variant="ghost" disabled={ocupado || indice === total - 1} onClick={() => aoMover(1)} icon={<ArrowDown className="h-4 w-4" />} />
        <Chave rotulo={`${linha.nome} recebe leads`} semRotuloVisivel semAviso ligada={linha.is_active} aoMudar={aoPausar} desabilitada={ocupado} className="mx-1" />
        <IconActionButton label={`Tirar ${linha.nome} da fila`} variant="ghost" disabled={ocupado} onClick={aoTirar} icon={<X className="h-4 w-4" />} />
      </div>
    </li>
  );
}

interface Props {
  roleta: RoletaConfig;
  aoMudar: (r: RoletaConfig) => void;
}

export default function FilaBloco({ roleta, aoMudar }: Props) {
  const [linhas, setLinhas] = useState<Linha[]>(() => linhasDa(roleta));
  const [ocupado, setOcupado] = useState(false);
  const [equipe, setEquipe] = useState<User[]>([]);
  const [proximo, setProximo] = useState<RoletaNextUp | null>(null);

  useEffect(() => { setLinhas(linhasDa(roleta)); }, [roleta]);

  useEffect(() => {
    let vivo = true;
    usersService.getUsers({ per_page: 200 })
      .then(r => { if (vivo) setEquipe(r.data ?? []); })
      .catch(() => { /* leitura de fundo: sem a lista, o "+ Adicionar corretor" fica vazio */ });
    return () => { vivo = false; };
  }, []);

  // Quem receberia o próximo lead agora (não manda nada a ninguém). Volta a
  // perguntar a cada mudança da roleta: reordenar e pausar mudam a resposta.
  const verProximo = useCallback(() => {
    roletaConfigService.getNextUp(roleta.id)
      .then(setProximo)
      .catch(() => setProximo(null));
  }, [roleta.id]);

  useEffect(() => { verProximo(); }, [verProximo, roleta]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Grava a lista nova. Erro: volta como estava e diz por quê. */
  const gravar = async (nova: Linha[], aviso?: string): Promise<boolean> => {
    if (ocupado) return false;
    const antes = linhas;
    setLinhas(nova);
    setOcupado(true);
    try {
      aoMudar(await roletaConfigService.update(roleta.id, { members: membrosParaGravar(nova) }));
      if (aviso) toast.success(aviso);
      return true;
    } catch (e) {
      setLinhas(antes);
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra salvar a fila. Tente de novo.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const mover = (indice: number, delta: -1 | 1) => void gravar(moveMember(linhas, indice, delta));

  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const de = linhas.findIndex(l => l.user_id === active.id);
    const para = linhas.findIndex(l => l.user_id === over.id);
    if (de < 0 || para < 0) return;
    void gravar(arrayMove(linhas, de, para));
  };

  const pausar = async (indice: number, ativo: boolean) => {
    const l = linhas[indice];
    const ok = await gravar(
      linhas.map((x, i) => (i === indice ? { ...x, is_active: ativo } : x)),
      ativo ? `${l.nome} volta a receber leads` : `${l.nome} pausado`,
    );
    return ok ? undefined : false;
  };

  const tirar = (indice: number) => void gravar(linhas.filter((_, i) => i !== indice), `${linhas[indice].nome} saiu da fila`);

  // Corretores e gestores ativos da Equipe que ainda não estão na fila.
  const disponiveis = useMemo(
    () => equipe
      .filter(u => !u.deactivated && !linhas.some(l => l.user_id === u.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')),
    [equipe, linhas],
  );

  const adicionar = (userId: string) => {
    const u = equipe.find(x => x.id === userId);
    if (!u) return;
    const nova: Linha = {
      user_id: u.id, weight: 10, is_active: true, position: linhas.length,
      personal_whatsapp_number: '', name: u.name, nome: u.name || 'Corretor',
      user_avatar: u.avatar_url ?? u.avatar ?? undefined, phone_status: null,
    };
    void gravar([...linhas, nova], `${nova.nome} entrou na fila`);
  };

  const prazoAtual = Number(roleta.timeout_minutes ?? 0);
  // Prazo gravado fora das opções (roleta antiga com 7 min) continua aparecendo.
  const prazos: number[] = (PRAZOS_EM_MINUTOS as readonly number[]).includes(prazoAtual)
    ? [...PRAZOS_EM_MINUTOS]
    : [...PRAZOS_EM_MINUTOS.filter(p => p > 0), prazoAtual].sort((a, b) => a - b).concat(0);

  const trocarPrazo = async (minutos: number) => {
    if (minutos === prazoAtual || ocupado) return;
    setOcupado(true);
    try {
      aoMudar(await roletaConfigService.update(roleta.id, { timeout_minutes: minutos }));
      toast.success(minutos ? `Prazo pra aceitar: ${prazoTexto(minutos)}` : 'Sem prazo pra aceitar');
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra salvar o prazo. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  };

  const proximoNome = proximo?.user_id
    ? proximo.user_name || linhas.find(l => l.user_id === proximo.user_id)?.nome || 'Corretor'
    : null;

  return (
    <div className="space-y-6">
      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          Ninguém na fila ainda. Adicione os corretores que vão receber os leads desta roleta.
        </p>
      ) : (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={linhas.map(l => l.user_id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2" aria-label="Fila da roleta">
              {linhas.map((l, i) => (
                <LinhaDaFila
                  key={l.user_id}
                  linha={l}
                  indice={i}
                  total={linhas.length}
                  ocupado={ocupado}
                  proximo={!!proximo?.user_id && proximo.user_id === l.user_id}
                  aoMover={d => mover(i, d)}
                  aoPausar={ativo => pausar(i, ativo)}
                  aoTirar={() => tirar(i)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Seletor
          aria-label="Adicionar corretor"
          value=""
          disabled={ocupado || disponiveis.length === 0}
          onChange={e => { if (e.target.value) adicionar(e.target.value); }}
          className="w-64"
        >
          <option value="">+ Adicionar corretor</option>
          {disponiveis.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Seletor>
        {proximo && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {proximoNome ? (
              <>Próximo agora: <span className="font-medium text-foreground">{proximoNome}</span></>
            ) : (
              <>Próximo agora: ninguém{proximo.reason ? `. ${proximo.reason}` : ''}</>
            )}
          </p>
        )}
      </div>

      <Campo
        id="fila-prazo"
        rotulo="Prazo pra aceitar"
        ajuda="Quem não aceita no prazo passa a vez pro próximo da fila. Sem prazo, a oferta fica com o corretor até ele responder."
      >
        <Seletor
          id="fila-prazo"
          value={String(prazoAtual)}
          disabled={ocupado}
          onChange={e => void trocarPrazo(Number(e.target.value))}
          className="w-44"
        >
          {prazos.map(p => <option key={p} value={String(p)}>{prazoTexto(p)}</option>)}
        </Seletor>
      </Campo>
    </div>
  );
}
