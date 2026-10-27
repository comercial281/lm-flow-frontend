/**
 * "Agendar visita" em duas colunas: Quem (cliente, corretor, observações,
 * imóvel) × Quando (dia, horário, duração, a frase por extenso e as visitas
 * do corretor naquele dia).
 *
 * Quem pode marcar para quem é decidido pelo SERVIDOR (Visits::Booking): o
 * corretor isolado só encontra os clientes dele e é sempre o responsável. A
 * tela sabe disso pelo `meta.only_mine` do seletor, não pelo cargo.
 * O gestor escolhe o corretor em botões (`GET /visits/realtors`); o cliente
 * vem do seletor paginado (50 por vez, com o total).
 *
 * Com a agenda ligada no servidor (`useAgendaLigada`, `GET /visit_settings`),
 * os horários do dia vêm do servidor (`/visits/availability`: só os de dentro
 * do horário de visita, com ocupado e folga já marcados) e dia fechado não se
 * escolhe (`motivoDiaFechado`, com o horário de visita e as folgas do corretor
 * escolhido). Com o servidor respondendo `enabled: false` (ou ainda sem
 * resposta, ou com erro) é a grade fixa de `daySlots.ts`, exatamente como antes.
 *
 * Três modos (frente 4 de Visitas):
 * - Agendar: o de sempre, só horário que ainda não passou.
 * - Registrar visita realizada: dia anterior a hoje (grade 07:00–22:00, sem
 *   ocupado nem dia fechado, porque registro não passa por trava), ou horário de
 *   hoje do grupo "Já passou" respondido com "Sim, já aconteceu". Vai com
 *   `status: 'completed'` e o retorno (nota e comentário).
 * - Remarcar (`visitaParaRemarcar`): cliente e imóvel fixos, dia/hora/duração/
 *   corretor vindos da visita, só horários futuros; salva com `reschedule`.
 * Specs: specs/2026-09-30-fase-4-agendar-visita-design.md,
 * specs/2026-10-01-fase-4-agenda-do-corretor-design.md e
 * specs/2026-10-10-visitas-frente-4-design.md (pasta LM FLOW).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, ChevronDown, Search, Star } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label as UILabel, Textarea,
} from '@/components/ui/ds';
import { CaixaDaJanela, CampoDaJanela, ESCOLHA } from '@/components/base/janela';
import { LeadCombobox } from '@/components/visits/LeadCombobox';
import { EscolhaCorretor } from '@/components/visits/EscolhaCorretor';
import {
  visitsService, type LeadPickerItem, type PersonRef, type Visit,
} from '@/services/visits/visitsService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { agendaService, type AvailabilitySlot } from '@/services/visits/agendaService';
import { useAgendaLigada } from '@/features/visits/useAgendaLigada';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { cn } from '@/lib/utils';
import { hora } from '@/lib/formato';
import {
  DURACOES, atalhosDeDia, diaISO, diaPassado, gradeDeRegistro, horariosDoDia, horariosQueJaPassaram,
  mesmoDia, ocupando, porExtenso, rotuloDuracao, type BusyVisit,
} from '@/features/visits/daySlots';
import { motivoDiaFechado, type TimeOff } from '@/features/visits/agenda';
import EmptyState from '@/components/base/EmptyState';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  diaInicial?: Date | null;
  /**
   * Horário já marcado ao abrir (o clique na grade de Semana/Dia). Passa pela
   * mesma conferência de quem escolhe na grade: ocupado, folga ou fora do
   * horário de visita, ele é desmarcado quando os horários do dia chegam.
   */
  inicioInicial?: Date | null;
  /**
   * Cliente já escolhido ao abrir (o card do lead abre daqui). Igual a escolher
   * na lista: o dono dele vira o corretor, e o corretor travado continua travado.
   */
  leadInicial?: LeadPickerItem | null;
  /**
   * Abre em "Remarcar visita": cliente e imóvel fixos, dia, hora, duração e
   * corretor vindos da visita, só horários futuros, salva com `reschedule`.
   */
  visitaParaRemarcar?: Visit | null;
  /** Imóvel já escolhido ao abrir (a ficha do imóvel abre daqui). */
  imovelInicial?: { id: string; title: string; code: string } | null;
  /** Chamado com a visita salva: agendada, registrada ou remarcada. */
  onCreated: (v: Visit) => void;
}

/** Um botão da grade de horários, venha da grade fixa ou do servidor. */
interface SlotTela {
  inicio: Date;
  rotulo: string;
  ocupadoPor: string | null;
  folga: boolean;
}

/** A resposta do servidor para o dia, já no formato da tela. */
interface DiaDaAgenda {
  aberto: boolean;
  motivo: string | null;
  slots: AvailabilitySlot[];
}

/** O imóvel da visita: o que a janela mostra e manda (vem da busca, da visita ou da prop). */
type ImovelEscolhido = Pick<Property, 'id' | 'title' | 'code'>;

const hojeSemHora = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export function ScheduleVisitDialog({
  open, onOpenChange, diaInicial, inicioInicial, leadInicial, visitaParaRemarcar, imovelInicial, onCreated,
}: Props) {
  const [travado, setTravado] = useState<PersonRef | null>(null);
  const [verificandoCargo, setVerificandoCargo] = useState(true);
  const [lead, setLead] = useState<LeadPickerItem | null>(null);
  const [corretor, setCorretor] = useState<PersonRef | null>(null);
  // Corretores que o gestor pode escolher; `null` = ainda carregando.
  const [corretores, setCorretores] = useState<PersonRef[] | null>(null);
  const [erroCorretores, setErroCorretores] = useState(false);
  const [dia, setDia] = useState<Date>(diaInicial ?? hojeSemHora());
  const [inicio, setInicio] = useState<Date | null>(null);
  const [duracao, setDuracao] = useState<number>(60);
  const [observacoes, setObservacoes] = useState('');
  const [imovel, setImovel] = useState<ImovelEscolhido | null>(null);
  const [doDia, setDoDia] = useState<BusyVisit[]>([]);
  // Falha ao ler as visitas do dia não vira "Nenhuma outra visita".
  const [erroDoDia, setErroDoDia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Horário de hoje que já passou: a resposta de "Essa visita já aconteceu?".
  // `null` = ainda não respondeu (salvar pede a resposta).
  const [jaAconteceu, setJaAconteceu] = useState<boolean | null>(null);
  // Retorno da visita registrada como realizada (nota 0 = sem nota).
  const [nota, setNota] = useState(0);
  const [retorno, setRetorno] = useState('');
  // Sobe quando o servidor recusa o agendamento por conflito (422): alguém
  // marcou nesse horário entre a tela abrir e o Agendar ser clicado. Entra nas
  // deps do efeito "visitas do dia" pra forçar um refetch sem duplicar a
  // lógica nem o guarda de corrida dele.
  const [recarregarDia, setRecarregarDia] = useState(0);

  // Agenda do corretor: ligada só quando o servidor diz (`/visit_settings`),
  // perguntado a cada abertura. Enquanto não responde, é a grade fixa de antes.
  // `servidorSemAgenda`: o `/visits/availability` respondeu `enabled: false`
  // (desligaram no meio) — vale o que o servidor diz, e a tela volta para a
  // grade fixa.
  const { ligada: agendaLigada, ajustes } = useAgendaLigada(open);
  const [servidorSemAgenda, setServidorSemAgenda] = useState(false);
  const usarAgenda = agendaLigada === true && !servidorSemAgenda;
  const [folgas, setFolgas] = useState<TimeOff[]>([]);
  // `null` = carregando.
  const [diaAgenda, setDiaAgenda] = useState<DiaDaAgenda | null>(null);
  const [erroAgenda, setErroAgenda] = useState(false);

  // `diaInicial` costuma ser um `Date` recriado a cada render do pai: não pode
  // entrar nas dependências do reset (reabriria o form de novo só por isso).
  // O efeito abaixo lê o valor mais recente só no instante em que abre.
  const diaInicialRef = useRef<Date | null | undefined>(diaInicial);
  diaInicialRef.current = diaInicial;
  const inicioInicialRef = useRef<Date | null | undefined>(inicioInicial);
  inicioInicialRef.current = inicioInicial;
  const leadInicialRef = useRef<LeadPickerItem | null | undefined>(leadInicial);
  leadInicialRef.current = leadInicial;
  const visitaParaRemarcarRef = useRef<Visit | null | undefined>(visitaParaRemarcar);
  visitaParaRemarcarRef.current = visitaParaRemarcar;
  const imovelInicialRef = useRef<{ id: string; title: string; code: string } | null | undefined>(imovelInicial);
  imovelInicialRef.current = imovelInicial;

  // Abriu: zera e descobre se é corretor travado. Só depende de `open` —
  // reabrir é a única hora de zerar o formulário.
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    const v = visitaParaRemarcarRef.current;
    if (v) {
      setLead({
        id: v.contact_id,
        name: v.contact?.name ?? 'Cliente',
        phone_number: v.contact?.phone_number ?? null,
        in_pipeline: false,
        owner: v.realtor ?? null,
      });
      setCorretor(v.realtor ?? null);
      // Abre no dia da visita, ou hoje se ela já passou (o cliente não veio,
      // por exemplo): remarcar só aceita horário futuro, e o dia da visita
      // passada abriria sem nenhum horário.
      const quando = new Date(v.scheduled_at);
      const diaDaVisita = new Date(quando.getFullYear(), quando.getMonth(), quando.getDate());
      const hoje = hojeSemHora();
      setDia(diaDaVisita < hoje ? hoje : diaDaVisita);
      setInicio(null);
      setDuracao(v.duration_minutes || 60);
      setImovel(v.property ?? null);
    } else {
      setLead(leadInicialRef.current ?? null);
      setCorretor(leadInicialRef.current?.owner ?? null);
      setDia(diaInicialRef.current ?? hojeSemHora());
      setInicio(inicioInicialRef.current ?? null);
      setDuracao(60);
      setImovel(imovelInicialRef.current ?? null);
    }
    setObservacoes('');
    setJaAconteceu(null);
    setNota(0);
    setRetorno('');
    setTravado(null);
    setVerificandoCargo(true);
    setCorretores(null);
    setErroCorretores(false);
    setServidorSemAgenda(false);
    // Um cliente só, porque aqui só interessa o meta (cargo travado ou não).
    visitsService.leadPickerPage('', 1, 1)
      .then(({ meta }) => {
        if (!vivo) return;
        if (meta.only_mine && meta.me) {
          setTravado(meta.me);
          setCorretor(meta.me);
        }
      })
      .catch(() => { /* sem meta = tela de gestor; o servidor confere ao salvar */ })
      .finally(() => { if (vivo) setVerificandoCargo(false); });
    visitsService.realtors()
      .then(lista => { if (vivo) setCorretores(lista); })
      .catch(() => { if (vivo) setErroCorretores(true); });
    return () => { vivo = false; };
  }, [open]);

  // Gestor: o corretor escolhido é sempre um dos botões. Dono do lead que não
  // está na lista (desativado, fora da equipe visível) não fica marcado
  // escondido — o gestor escolhe outro.
  useEffect(() => {
    if (travado || !corretor || !corretores) return;
    if (!corretores.some(c => c.id === corretor.id)) setCorretor(null);
  }, [travado, corretor, corretores]);

  // Visitas do corretor no dia escolhido. Trocar corretor ou dia antes da
  // resposta anterior chegar não pode deixar a resposta velha pisar na nova
  // (resposta mais lenta de um pedido antigo vencendo a mais rápida do atual).
  useEffect(() => {
    if (!open || !corretor) { setDoDia([]); setErroDoDia(false); return; }
    setDoDia([]);
    setErroDoDia(false);
    let vivo = true;
    const d = diaISO(dia);
    visitsService.list({ realtor_id: corretor.id, since: d, until: d, per_page: 50 })
      .then(res => {
        if (!vivo) return;
        // O servidor manda mais nova primeiro; a lista do dia é lida de cima
        // pra baixo, então ordena crescente aqui.
        const ordenada = ((res.data ?? []) as BusyVisit[])
          .slice()
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
        setDoDia(ordenada);
      })
      .catch(() => { if (vivo) { setDoDia([]); setErroDoDia(true); } });
    return () => { vivo = false; };
  }, [open, corretor, dia, recarregarDia]);

  const corretorId = corretor?.id;
  const diaChave = diaISO(dia);

  const remarcando = !!visitaParaRemarcar;
  const excluirContatoId = visitaParaRemarcar?.contact_id;
  const agora = new Date();
  // Dia anterior a hoje: só dá para registrar a visita como realizada.
  const passouODia = !remarcando && diaPassado(dia, agora);

  // Agenda: as folgas do corretor escolhido, uma vez por abertura e corretor.
  useEffect(() => {
    setFolgas([]);
    if (!open || !usarAgenda || !corretorId) return;
    let vivo = true;
    agendaService.listTimeOffs({ user_id: corretorId, from: diaISO(hojeSemHora()) })
      .then(lista => { if (vivo) setFolgas(lista); })
      .catch(() => { /* idem: o servidor confere ao salvar */ });
    return () => { vivo = false; };
  }, [open, usarAgenda, corretorId]);

  // Agenda: os horários do dia, pela conta do servidor. Mesmo guarda de corrida
  // das visitas do dia (resposta velha descartada) e o mesmo `recarregarDia`
  // depois de um 422. Espera saber o cargo para não pedir duas vezes. Sem
  // corretor (gestor antes de escolher): o horário de visita, sem ocupação.
  useEffect(() => {
    setDiaAgenda(null);
    setErroAgenda(false);
    // Dia que passou não pergunta ao servidor: registro não passa pela agenda.
    if (!open || !usarAgenda || verificandoCargo || passouODia) return;
    let vivo = true;
    agendaService.availability({
      realtor_id: corretorId, date: diaChave, duration: duracao,
      // Remarcando: as visitas desse cliente (a própria visita) não ocupam.
      exclude_contact_id: excluirContatoId,
    })
      .then(r => {
        if (!vivo) return;
        if (!r.enabled) { setServidorSemAgenda(true); return; }
        setDiaAgenda({ aberto: r.day.open, motivo: r.day.reason_text, slots: r.slots ?? [] });
      })
      .catch(() => { if (vivo) setErroAgenda(true); });
    return () => { vivo = false; };
  }, [open, usarAgenda, verificandoCargo, passouODia, corretorId, diaChave, duracao, recarregarDia, excluirContatoId]);

  // Remarcando: a própria visita não ocupa o horário que vai deixar (o
  // servidor também não conta ela contra si mesma).
  const remarcandoId = visitaParaRemarcar?.id;
  const ocupadas = useMemo(
    () => ocupando(doDia).filter(v => v.id !== remarcandoId),
    [doDia, remarcandoId],
  );
  const slotsFixos = useMemo(() => horariosDoDia(dia, duracao, ocupadas, new Date()), [dia, duracao, ocupadas]);
  // `null` = a agenda ainda não respondeu.
  const slots = useMemo<SlotTela[] | null>(() => {
    if (!usarAgenda) return slotsFixos.map(s => ({ ...s, folga: false }));
    if (!diaAgenda) return null;
    return diaAgenda.slots.map(s => ({
      inicio: new Date(s.at),
      rotulo: hora(s.at),
      ocupadoPor: s.state === 'busy' ? (s.client_name || 'outro cliente') : null,
      folga: s.state === 'time_off',
    }));
  }, [usarAgenda, slotsFixos, diaAgenda]);

  // Dia que passou: a grade de registro, toda clicável.
  const gradeRegistro = useMemo<SlotTela[]>(
    () => (passouODia ? gradeDeRegistro(dia).map(s => ({ ...s, folga: false })) : []),
    [passouODia, dia],
  );
  // Hoje: os horários que já passaram (grupo "Já passou"). Remarcar não tem.
  const passados = useMemo(
    () => (remarcando ? [] : horariosQueJaPassaram(dia, new Date(), ocupadas)),
    [remarcando, dia, ocupadas],
  );
  const escolheuPassado = !!inicio && passados.some(s => s.inicio.getTime() === inicio.getTime());
  // Registrar = dia anterior a hoje, ou horário de hoje que já passou com "Sim, já aconteceu".
  const registrando = passouODia || (escolheuPassado && jaAconteceu === true);
  const modo: 'agendar' | 'registrar' | 'remarcar' = remarcando ? 'remarcar' : registrando ? 'registrar' : 'agendar';

  // Trocou dia, duração ou corretor e o horário escolhido deixou de caber: limpa.
  // Horário do "Já passou" sempre cabe (o ocupado ali é só informação); no dia
  // que passou, cabe qualquer um da grade de registro daquele dia.
  useEffect(() => {
    if (!inicio) return;
    const mesmo = (x: { inicio: Date }) => x.inicio.getTime() === inicio.getTime();
    if (passouODia) {
      if (!gradeRegistro.some(mesmo)) setInicio(null);
      return;
    }
    if (passados.some(mesmo) || !slots) return;
    const s = slots.find(mesmo);
    if (!s || s.ocupadoPor || s.folga) setInicio(null);
  }, [passouODia, gradeRegistro, passados, slots, inicio]);

  // Por que o dia está fechado (agenda ligada e horário carregado), ou null.
  // Dia que passou nunca está fechado: é registro, não agendamento.
  const motivoFechado = (d: Date): string | null =>
    usarAgenda && ajustes && !diaPassado(d, new Date()) ? motivoDiaFechado(d, ajustes, folgas) : null;

  const escolherLead = (l: LeadPickerItem) => {
    setLead(l);
    // Cliente sem dono precisa LIMPAR o corretor anterior, não só deixar como
    // estava — senão o form salva o corretor do cliente trocado.
    if (!travado) setCorretor(l.owner ?? null);
  };

  const salvar = async () => {
    if (!lead) { toast.error('Escolha o cliente'); return; }
    if (!corretor) { toast.error('Escolha o corretor responsável'); return; }
    if (!inicio) { toast.error('Escolha o horário'); return; }
    if (escolheuPassado && !passouODia && jaAconteceu === null) { toast.error('Diga se a visita já aconteceu'); return; }
    setSalvando(true);
    try {
      let salva: Visit;
      if (modo === 'remarcar' && visitaParaRemarcar) {
        salva = await visitsService.reschedule(visitaParaRemarcar.id, inicio.toISOString(), {
          duration_minutes: duracao,
          // Corretor travado não manda: o servidor mantém ele mesmo.
          realtor_id: travado ? undefined : corretor.id,
        });
        toast.success('Visita remarcada');
      } else {
        salva = await visitsService.create({
          contact_id: lead.id,
          // Corretor travado não manda: o servidor grava ele mesmo.
          realtor_id: travado ? undefined : corretor.id,
          scheduled_at: inicio.toISOString(),
          duration_minutes: duracao,
          realtor_notes: observacoes.trim() || undefined,
          property_id: imovel?.id ?? null,
          ...(modo === 'registrar'
            ? { status: 'completed' as const, rating: nota || undefined, feedback_notes: retorno.trim() || undefined }
            : {}),
        });
        toast.success(modo === 'registrar' ? 'Visita registrada' : 'Visita agendada');
      }
      onCreated(salva);
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, modo === 'remarcar'
        ? 'Erro ao remarcar visita'
        : modo === 'registrar' ? 'Erro ao registrar visita' : 'Erro ao agendar visita'));
      // 422 = corrida: alguém marcou nesse horário entre a tela abrir e o
      // clique no Agendar. O horário escolhido já não vale mais — recarrega a
      // lista do dia pra riscar o que acabou de ser ocupado por outra pessoa.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 422) setRecarregarDia(c => c + 1);
    } finally {
      setSalvando(false);
    }
  };

  const atalhos = atalhosDeDia(new Date());
  const atalhoAtivo = atalhos.find(a => mesmoDia(a.dia, dia));
  const motivoOutraData = atalhoAtivo ? null : motivoFechado(dia);
  const textos = {
    agendar: { titulo: 'Agendar visita', descricao: 'Quem vai visitar e quando', botao: 'Agendar' },
    registrar: { titulo: 'Registrar visita realizada', descricao: 'A visita já aconteceu: registre quando foi e como foi', botao: 'Registrar visita' },
    remarcar: { titulo: 'Remarcar visita', descricao: 'Escolha o novo dia e horário', botao: 'Remarcar' },
  }[modo];

  // Um botão de horário: o mesmo para a grade de registro, o "Já passou" e a
  // grade normal. Escolher outro horário zera a resposta da pergunta.
  const botaoHorario = (s: SlotTela, extra?: { passado?: boolean }) => {
    const bloqueado = !extra?.passado && (!!s.ocupadoPor || s.folga);
    return (
      <Button
        key={s.rotulo}
        type="button"
        size="sm"
        variant="outline" aria-pressed={inicio?.getTime() === s.inicio.getTime()}
        disabled={bloqueado}
        title={extra?.passado
          ? (s.ocupadoPor ? `Visita com ${s.ocupadoPor} nesse horário` : undefined)
          : s.ocupadoPor ? `Ocupado: visita com ${s.ocupadoPor}` : s.folga ? 'Folga do corretor' : undefined}
        aria-label={bloqueado ? (s.ocupadoPor ? `${s.rotulo} · ocupado, ${s.ocupadoPor}` : `${s.rotulo} · folga`) : undefined}
        className={cn(ESCOLHA, extra?.passado ? 'opacity-70' : bloqueado ? 'line-through' : undefined)}
        onClick={() => { setInicio(s.inicio); setJaAconteceu(null); }}
      >
        {s.rotulo}
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="wide"
        className="max-h-[90dvh] overflow-y-auto"
        // Cliente já escolhido (veio do card): o foco automático no campo de
        // cliente abriria a busca por cima do nome, como se nada estivesse escolhido.
        onOpenAutoFocus={e => { if (leadInicialRef.current || visitaParaRemarcarRef.current) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{textos.titulo}</DialogTitle>
          <DialogDescription>{textos.descricao}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-8 py-2 md:grid-cols-2 md:grid-rows-[auto_1fr] md:items-stretch">
          {/* Quem */}
          <section className="space-y-5 md:col-start-1 md:row-start-1" aria-label="Quem">
            {remarcando ? (
              <div>
                <UILabel>Cliente</UILabel>
                <p className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{lead?.name ?? 'Cliente'}</p>
              </div>
            ) : (
              <LeadCombobox
                value={lead}
                onChange={escolherLead}
                label="Cliente"
                placeholder="Buscar cliente por nome ou telefone"
                allowCreate={false}
                paginated
              />
            )}

            <CampoDaJanela rotulo="Corretor responsável" htmlFor={travado ? undefined : 'visita_corretor'} obrigatorio={!travado}>
              {travado ? (
                <p className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{travado.name}</p>
              ) : verificandoCargo ? (
                <p className="mt-1 text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <EscolhaCorretor id="visita_corretor" corretores={corretores} erro={erroCorretores} valor={corretor} onEscolher={setCorretor} />
              )}
            </CampoDaJanela>

            {remarcando ? (
              imovel && (
                <div>
                  <UILabel>Imóvel</UILabel>
                  <p className="mt-1 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{imovel.code} · {imovel.title}</span>
                  </p>
                </div>
              )
            ) : (
              <>
                <CampoDaJanela rotulo="Observações" htmlFor="visita_observacoes">
                  <Textarea
                    id="visita_observacoes"
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    rows={2}
                    placeholder="Detalhes da visita"
                    className="resize-none"
                  />
                </CampoDaJanela>

                {modo === 'registrar' && (
                  <div>
                    <UILabel>Retorno (opcional)</UILabel>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNota(n)}
                          aria-label={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                          title={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                        >
                          <Star className={`h-6 w-6 ${n <= nota ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={retorno}
                      onChange={e => setRetorno(e.target.value)}
                      rows={3}
                      placeholder="Como foi a visita? Interesse do cliente?"
                      className="mt-2 resize-none"
                    />
                  </div>
                )}

                <BuscaImovel valor={imovel} onEscolher={setImovel} />
              </>
            )}
          </section>

          {/* Quando */}
          <section className="space-y-5 md:col-start-2 md:row-span-2 md:row-start-1" aria-label="Quando">
            <div>
              <UILabel>Dia *</UILabel>
              <div className="mt-1 flex flex-wrap gap-2">
                {atalhos.map(a => {
                  const motivo = motivoFechado(a.dia);
                  return (
                    <Button
                      key={a.rotulo}
                      type="button"
                      size="sm"
                      variant="outline" className={ESCOLHA} aria-pressed={atalhoAtivo?.rotulo === a.rotulo}
                      disabled={!!motivo}
                      title={motivo ?? undefined}
                      onClick={() => setDia(a.dia)}
                    >
                      {a.rotulo}
                    </Button>
                  );
                })}
                <Input
                  type="date"
                  aria-label="Outra data"
                  className="w-auto"
                  title={motivoOutraData ?? undefined}
                  aria-invalid={motivoOutraData ? true : undefined}
                  // Agendar aceita dia que passou (vira registro); remarcar, só daqui pra frente.
                  min={remarcando ? diaISO(hojeSemHora()) : undefined}
                  value={atalhoAtivo ? '' : diaISO(dia)}
                  onChange={e => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    if (y && m && d) setDia(new Date(y, m - 1, d));
                  }}
                />
              </div>
            </div>

            <div>
              <UILabel>Duração</UILabel>
              <div className="mt-1 flex flex-wrap gap-2">
                {DURACOES.map(min => (
                  <Button
                    key={min}
                    type="button"
                    size="sm"
                    variant="outline" className={ESCOLHA} aria-pressed={duracao === min}
                    onClick={() => setDuracao(min)}
                  >
                    {rotuloDuracao(min)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <UILabel>Horário *</UILabel>
              {passouODia ? (
                <div className="mt-1 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto pr-1 md:grid-cols-4">
                  {gradeRegistro.map(s => botaoHorario(s))}
                </div>
              ) : (<>
              {passados.length > 0 && (
                <div className="mt-1 mb-3">
                  <p className="text-xs text-muted-foreground">Já passou</p>
                  <div className="mt-1 grid max-h-32 grid-cols-3 gap-1.5 overflow-y-auto pr-1 md:grid-cols-4">
                    {passados.map(s => botaoHorario({ ...s, folga: false }, { passado: true }))}
                  </div>
                </div>
              )}
              {erroAgenda ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Não deu para carregar os horários.</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRecarregarDia(c => c + 1)}>Tentar de novo</Button>
                </div>
              ) : !slots ? (
                <p className="mt-1 text-sm text-muted-foreground">Carregando horários...</p>
              ) : diaAgenda && !diaAgenda.aberto ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {diaAgenda.motivo || motivoFechado(dia) || 'Esse dia está fechado para visitas.'}
                </p>
              ) : slots.length === 0 ? (
                // Fim do dia: com o "Já passou" na tela, o recado de dia cheio só confunde.
                passados.length === 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">Não sobrou horário nesse dia. Escolha outro dia.</p>
                )
              ) : (
                <div className="mt-1 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto pr-1 md:grid-cols-4">
                  {slots.map(s => botaoHorario(s))}
                </div>
              )}
              </>)}

              {escolheuPassado && !passouODia && (
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm" role="group" aria-label="Essa visita já aconteceu?">
                  <p className="font-medium">Essa visita já aconteceu?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className={ESCOLHA} aria-pressed={jaAconteceu === true} onClick={() => setJaAconteceu(true)}>Sim, já aconteceu</Button>
                    <Button type="button" size="sm" variant="outline" className={ESCOLHA} aria-pressed={jaAconteceu === false} onClick={() => setJaAconteceu(false)}>Não, ainda vai acontecer</Button>
                  </div>
                </div>
              )}
            </div>

          </section>

          {/* Resumo: embaixo de Imóvel no computador; no celular, depois dos horários */}
          {(inicio || corretor) && (
            <CaixaDaJanela titulo="Resumo" data-testid="resumo-da-visita" className="md:col-start-1 md:row-start-2" corpoClassName="space-y-4">
              {inicio && <p className="text-sm font-medium">{porExtenso(inicio, duracao)}</p>}

              {corretor && (
                <div>
                  <UILabel>{travado ? 'Suas visitas nesse dia' : `Visitas de ${corretor.name} nesse dia`}</UILabel>
                  {ocupadas.length === 0 && erroDoDia ? (
                    <EmptyState
                      tipo="erro"
                      tamanho="compacto"
                      aoTentarDeNovo={() => setRecarregarDia(c => c + 1)}
                      className="mt-1 p-3"
                    />
                  ) : ocupadas.length === 0 ? (
                    <EmptyState
                      tamanho="compacto"
                      title={travado ? 'Nenhuma outra visita sua nesse dia.' : `Nenhuma outra visita de ${corretor.name} nesse dia.`}
                      className="mt-1 p-3"
                    />
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {ocupadas.map(v => (
                        <li key={v.id} className="flex gap-2">
                          <span className="tabular-nums text-muted-foreground">{hora(v.scheduled_at)}</span>
                          <span className="truncate">
                            {v.contact?.name ?? 'Cliente'}
                            {v.property ? ` · ${v.property.code}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CaixaDaJanela>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || verificandoCargo}>{salvando ? 'Salvando...' : textos.botao}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Imóvel, opcional e por último: é a última coisa que se combina com o cliente. */
function BuscaImovel({ valor, onEscolher }: { valor: ImovelEscolhido | null; onEscolher: (p: ImovelEscolhido | null) => void }) {
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<Property[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = (q: string) => {
    if (espera.current) clearTimeout(espera.current);
    if (!q.trim()) { setLista([]); setAberto(false); onEscolher(null); return; }
    setBuscando(true);
    espera.current = setTimeout(async () => {
      try {
        const res = await propertiesService.list({ q, per_page: 8 });
        setLista(res.data ?? []);
        setAberto(true);
      } catch { setLista([]); }
      finally { setBuscando(false); }
    }, 300);
  };

  return (
    <div className="relative">
      <UILabel>Imóvel (opcional)</UILabel>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texto}
          onChange={e => { setTexto(e.target.value); buscar(e.target.value); }}
          placeholder="Buscar por título ou código"
          className="pl-9"
        />
        {buscando && <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {aberto && lista.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {lista.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/50"
              onClick={() => { onEscolher(p); setTexto(p.title); setAberto(false); }}
            >
              <div className="truncate font-medium">{p.title}</div>
              <div className="text-xs text-muted-foreground">{p.code} · {p.address_city}</div>
            </button>
          ))}
        </div>
      )}
      {valor && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {valor.code} escolhido
        </div>
      )}
    </div>
  );
}
