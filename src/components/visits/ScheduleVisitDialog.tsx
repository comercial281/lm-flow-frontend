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
 * Com a chave `agenda_do_corretor`, os horários do dia vêm do servidor
 * (`/visits/availability`: só os de dentro do horário de visita, com ocupado e
 * folga já marcados) e dia fechado não se escolhe (`motivoDiaFechado`, com o
 * horário de visita e as folgas do corretor escolhido). Sem a chave — ou com o
 * servidor respondendo `enabled: false` — é a grade fixa de `daySlots.ts`,
 * exatamente como antes.
 * Specs: specs/2026-09-30-fase-4-agendar-visita-design.md e
 * specs/2026-10-01-fase-4-agenda-do-corretor-design.md (pasta LM FLOW).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, ChevronDown, Search } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label as UILabel, Textarea,
} from '@/components/ui/ds';
import { LeadCombobox } from '@/components/visits/LeadCombobox';
import { EscolhaCorretor } from '@/components/visits/EscolhaCorretor';
import {
  visitsService, type LeadPickerItem, type PersonRef, type Visit,
} from '@/services/visits/visitsService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { agendaService, type AvailabilitySlot } from '@/services/visits/agendaService';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { hora } from '@/lib/formato';
import {
  DURACOES, atalhosDeDia, diaISO, horariosDoDia, mesmoDia, ocupando, porExtenso, rotuloDuracao,
  type BusyVisit,
} from '@/features/visits/daySlots';
import { motivoDiaFechado, type AgendaSettings, type TimeOff } from '@/features/visits/agenda';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  diaInicial?: Date | null;
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

const hojeSemHora = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export function ScheduleVisitDialog({ open, onOpenChange, diaInicial, onCreated }: Props) {
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
  const [imovel, setImovel] = useState<Property | null>(null);
  const [doDia, setDoDia] = useState<BusyVisit[]>([]);
  const [salvando, setSalvando] = useState(false);
  // Sobe quando o servidor recusa o agendamento por conflito (422): alguém
  // marcou nesse horário entre a tela abrir e o Agendar ser clicado. Entra nas
  // deps do efeito "visitas do dia" pra forçar um refetch sem duplicar a
  // lógica nem o guarda de corrida dele.
  const [recarregarDia, setRecarregarDia] = useState(0);

  // Agenda do corretor. `servidorSemAgenda`: a tela tem a chave, mas o
  // servidor respondeu `enabled: false` — vale o que o servidor diz, e a tela
  // volta para a grade fixa.
  const agendaLigada = useClientToggle('agenda_do_corretor');
  const [servidorSemAgenda, setServidorSemAgenda] = useState(false);
  const usarAgenda = agendaLigada && !servidorSemAgenda;
  const [ajustes, setAjustes] = useState<AgendaSettings | null>(null);
  const [folgas, setFolgas] = useState<TimeOff[]>([]);
  // `null` = carregando.
  const [diaAgenda, setDiaAgenda] = useState<DiaDaAgenda | null>(null);
  const [erroAgenda, setErroAgenda] = useState(false);

  // `diaInicial` costuma ser um `Date` recriado a cada render do pai: não pode
  // entrar nas dependências do reset (reabriria o form de novo só por isso).
  // O efeito abaixo lê o valor mais recente só no instante em que abre.
  const diaInicialRef = useRef<Date | null | undefined>(diaInicial);
  diaInicialRef.current = diaInicial;

  // Abriu: zera e descobre se é corretor travado. Só depende de `open` —
  // reabrir é a única hora de zerar o formulário.
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setLead(null);
    setCorretor(null);
    setDia(diaInicialRef.current ?? hojeSemHora());
    setInicio(null);
    setDuracao(60);
    setObservacoes('');
    setImovel(null);
    setTravado(null);
    setVerificandoCargo(true);
    setCorretores(null);
    setErroCorretores(false);
    setServidorSemAgenda(false);
    setAjustes(null);
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
    if (!open || !corretor) { setDoDia([]); return; }
    setDoDia([]);
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
      .catch(() => { if (vivo) setDoDia([]); });
    return () => { vivo = false; };
  }, [open, corretor, dia, recarregarDia]);

  const corretorId = corretor?.id;
  const diaChave = diaISO(dia);

  // Agenda: o horário de visita da imobiliária, uma vez por abertura.
  useEffect(() => {
    if (!open || !agendaLigada) return;
    let vivo = true;
    agendaService.getSettings()
      .then(r => {
        if (!vivo) return;
        if (r.enabled) setAjustes(r);
        else setServidorSemAgenda(true);
      })
      .catch(() => { /* sem o horário, os atalhos não travam; o servidor confere ao salvar */ });
    return () => { vivo = false; };
  }, [open, agendaLigada]);

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
    if (!open || !usarAgenda || verificandoCargo) return;
    let vivo = true;
    agendaService.availability({ realtor_id: corretorId, date: diaChave, duration: duracao })
      .then(r => {
        if (!vivo) return;
        if (!r.enabled) { setServidorSemAgenda(true); return; }
        setDiaAgenda({ aberto: r.day.open, motivo: r.day.reason_text, slots: r.slots ?? [] });
      })
      .catch(() => { if (vivo) setErroAgenda(true); });
    return () => { vivo = false; };
  }, [open, usarAgenda, verificandoCargo, corretorId, diaChave, duracao, recarregarDia]);

  const ocupadas = useMemo(() => ocupando(doDia), [doDia]);
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

  // Trocou dia, duração ou corretor e o horário escolhido deixou de caber: limpa.
  useEffect(() => {
    if (!inicio || !slots) return;
    const s = slots.find(x => x.inicio.getTime() === inicio.getTime());
    if (!s || s.ocupadoPor || s.folga) setInicio(null);
  }, [slots, inicio]);

  // Por que o dia está fechado (agenda ligada e horário carregado), ou null.
  const motivoFechado = (d: Date): string | null =>
    usarAgenda && ajustes ? motivoDiaFechado(d, ajustes, folgas) : null;

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
    setSalvando(true);
    try {
      const criada = await visitsService.create({
        contact_id: lead.id,
        // Corretor travado não manda: o servidor grava ele mesmo.
        realtor_id: travado ? undefined : corretor.id,
        scheduled_at: inicio.toISOString(),
        duration_minutes: duracao,
        realtor_notes: observacoes.trim() || undefined,
        property_id: imovel?.id ?? null,
      });
      toast.success('Visita agendada');
      onCreated(criada);
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao agendar visita'));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
          <DialogDescription>Quem vai visitar e quando</DialogDescription>
        </DialogHeader>

        <div className="grid gap-8 py-2 md:grid-cols-2">
          {/* Quem */}
          <section className="space-y-5" aria-label="Quem">
            <LeadCombobox
              value={lead}
              onChange={escolherLead}
              label="Cliente *"
              placeholder="Buscar cliente por nome ou telefone"
              allowCreate={false}
              paginated
            />

            <div>
              <UILabel>Corretor responsável{travado ? '' : ' *'}</UILabel>
              {travado ? (
                <p className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{travado.name}</p>
              ) : verificandoCargo ? (
                <p className="mt-1 text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <EscolhaCorretor corretores={corretores} erro={erroCorretores} valor={corretor} onEscolher={setCorretor} />
              )}
            </div>

            <div>
              <UILabel>Observações</UILabel>
              <Textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Detalhes da visita"
                className="mt-1 resize-none"
              />
            </div>

            <BuscaImovel valor={imovel} onEscolher={setImovel} />
          </section>

          {/* Quando */}
          <section className="space-y-5" aria-label="Quando">
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
                      variant={atalhoAtivo?.rotulo === a.rotulo ? 'default' : 'outline'}
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
                  min={diaISO(hojeSemHora())}
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
                    variant={duracao === min ? 'default' : 'outline'}
                    onClick={() => setDuracao(min)}
                  >
                    {rotuloDuracao(min)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <UILabel>Horário *</UILabel>
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
                <p className="mt-1 text-sm text-muted-foreground">Não sobrou horário nesse dia. Escolha outro dia.</p>
              ) : (
                <div className="mt-1 grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto pr-1 md:grid-cols-4">
                  {slots.map(s => (
                    <Button
                      key={s.rotulo}
                      type="button"
                      size="sm"
                      variant={inicio?.getTime() === s.inicio.getTime() ? 'default' : 'outline'}
                      disabled={!!s.ocupadoPor || s.folga}
                      title={s.ocupadoPor ? `Ocupado: visita com ${s.ocupadoPor}` : s.folga ? 'Folga do corretor' : undefined}
                      aria-label={s.ocupadoPor ? `${s.rotulo} · ocupado, ${s.ocupadoPor}` : s.folga ? `${s.rotulo} · folga` : undefined}
                      className={s.ocupadoPor || s.folga ? 'line-through' : undefined}
                      onClick={() => setInicio(s.inicio)}
                    >
                      {s.rotulo}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {inicio && <p className="text-sm font-medium">{porExtenso(inicio, duracao)}</p>}

            {corretor && (
              <div>
                <UILabel>{travado ? 'Suas visitas nesse dia' : `Visitas de ${corretor.name} nesse dia`}</UILabel>
                {ocupadas.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {travado ? 'Nenhuma outra visita sua nesse dia.' : `Nenhuma outra visita de ${corretor.name} nesse dia.`}
                  </p>
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
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || verificandoCargo}>{salvando ? 'Salvando...' : 'Agendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Imóvel, opcional e por último: é a última coisa que se combina com o cliente. */
function BuscaImovel({ valor, onEscolher }: { valor: Property | null; onEscolher: (p: Property | null) => void }) {
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
        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
          <Building2 className="h-3 w-3" />
          {valor.code} escolhido
        </div>
      )}
    </div>
  );
}
