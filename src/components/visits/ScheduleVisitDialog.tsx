/**
 * "Agendar visita" em duas colunas: Quem (cliente, corretor, observações,
 * imóvel) × Quando (dia, horário, duração, a frase por extenso e as visitas
 * do corretor naquele dia).
 *
 * Quem pode marcar para quem é decidido pelo SERVIDOR (Visits::Booking): o
 * corretor isolado só encontra os clientes dele e é sempre o responsável. A
 * tela sabe disso pelo `meta.only_mine` do seletor, não pelo cargo.
 * Spec: specs/2026-09-30-fase-4-agendar-visita-design.md (pasta LM FLOW).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, ChevronDown, Search } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label as UILabel, Textarea,
} from '@/components/ui/ds';
import { LeadCombobox } from '@/components/visits/LeadCombobox';
import {
  visitsService, type LeadPickerItem, type PersonRef, type Visit,
} from '@/services/visits/visitsService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { usersService } from '@/services/users';
import type { User } from '@/types/users';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { hora } from '@/lib/formato';
import {
  DURACOES, atalhosDeDia, diaISO, horariosDoDia, mesmoDia, ocupando, porExtenso, rotuloDuracao,
  type BusyVisit,
} from '@/features/visits/daySlots';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  diaInicial?: Date | null;
  onCreated: (v: Visit) => void;
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
  const [dia, setDia] = useState<Date>(diaInicial ?? hojeSemHora());
  const [inicio, setInicio] = useState<Date | null>(null);
  const [duracao, setDuracao] = useState<number>(60);
  const [observacoes, setObservacoes] = useState('');
  const [imovel, setImovel] = useState<Property | null>(null);
  const [doDia, setDoDia] = useState<BusyVisit[]>([]);
  const [salvando, setSalvando] = useState(false);
  // Sobe a cada "abriu" (ver efeito abaixo) e vira `key` do `BuscaCorretor`:
  // força ele a remontar do zero no reset, sem depender de o Dialog
  // desmontar o conteúdo sozinho (aqui é explícito, não um efeito colateral
  // do Radix). Sem isso o texto digitado por cima de um corretor anterior
  // poderia sobreviver a uma reabertura.
  const [cicloFormulario, setCicloFormulario] = useState(0);

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
    setCicloFormulario(c => c + 1);
    visitsService.leadPickerPage('', 1)
      .then(({ meta }) => {
        if (!vivo) return;
        if (meta.only_mine && meta.me) {
          setTravado(meta.me);
          setCorretor(meta.me);
        }
      })
      .catch(() => { /* sem meta = tela de gestor; o servidor confere ao salvar */ })
      .finally(() => { if (vivo) setVerificandoCargo(false); });
    return () => { vivo = false; };
  }, [open]);

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
  }, [open, corretor, dia]);

  const ocupadas = useMemo(() => ocupando(doDia), [doDia]);
  const slots = useMemo(() => horariosDoDia(dia, duracao, ocupadas, new Date()), [dia, duracao, ocupadas]);

  // Trocou dia, duração ou corretor e o horário escolhido deixou de caber: limpa.
  useEffect(() => {
    if (!inicio) return;
    const s = slots.find(x => x.inicio.getTime() === inicio.getTime());
    if (!s || s.ocupadoPor) setInicio(null);
  }, [slots, inicio]);

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
    } finally {
      setSalvando(false);
    }
  };

  const atalhos = atalhosDeDia(new Date());
  const atalhoAtivo = atalhos.find(a => mesmoDia(a.dia, dia));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
          <DialogDescription>Quem vai visitar e quando</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2 md:grid-cols-2">
          {/* Quem */}
          <section className="space-y-4" aria-label="Quem">
            <LeadCombobox
              value={lead}
              onChange={escolherLead}
              label="Cliente *"
              placeholder="Buscar cliente por nome ou telefone"
              allowCreate={false}
            />

            <div>
              <UILabel>Corretor responsável{travado ? '' : ' *'}</UILabel>
              {travado ? (
                <p className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{travado.name}</p>
              ) : (
                <BuscaCorretor key={cicloFormulario} valor={corretor} onEscolher={setCorretor} />
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
          <section className="space-y-4" aria-label="Quando">
            <div>
              <UILabel>Dia *</UILabel>
              <div className="mt-1 flex flex-wrap gap-2">
                {atalhos.map(a => (
                  <Button
                    key={a.rotulo}
                    type="button"
                    size="sm"
                    variant={atalhoAtivo?.rotulo === a.rotulo ? 'default' : 'outline'}
                    onClick={() => setDia(a.dia)}
                  >
                    {a.rotulo}
                  </Button>
                ))}
                <Input
                  type="date"
                  aria-label="Outra data"
                  className="w-auto"
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
              {slots.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Não sobrou horário nesse dia. Escolha outro dia.</p>
              ) : (
                <div className="mt-1 grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                  {slots.map(s => (
                    <Button
                      key={s.rotulo}
                      type="button"
                      size="sm"
                      variant={inicio?.getTime() === s.inicio.getTime() ? 'default' : 'outline'}
                      disabled={!!s.ocupadoPor}
                      title={s.ocupadoPor ? `Ocupado: visita com ${s.ocupadoPor}` : undefined}
                      className={s.ocupadoPor ? 'line-through' : undefined}
                      onClick={() => setInicio(s.inicio)}
                    >
                      {s.ocupadoPor ? `${s.rotulo} · ocupado, ${s.ocupadoPor}` : s.rotulo}
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

/** Corretor responsável, para o gestor. Mesmo serviço de usuários que a tela antiga usava. */
function BuscaCorretor({ valor, onEscolher }: { valor: PersonRef | null; onEscolher: (p: PersonRef | null) => void }) {
  const [texto, setTexto] = useState(valor?.name ?? '');
  const [lista, setLista] = useState<User[]>([]);
  const [aberto, setAberto] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fica `true` só entre "digitei e isso zerou o `valor`" e o re-render que
  // chega de volta com `valor = null` — pra esse re-render não apagar o que
  // acabou de ser digitado. Qualquer OUTRA causa de `valor` virar null (o
  // gestor trocou de cliente para um sem dono) passa batido por aqui e cai no
  // sync normal abaixo, que esvazia o campo de verdade.
  const limpeiPorDigitarRef = useRef(false);

  useEffect(() => {
    if (limpeiPorDigitarRef.current) { limpeiPorDigitarRef.current = false; return; }
    setTexto(valor?.name ?? '');
  }, [valor]);

  const buscar = (q: string) => {
    if (espera.current) clearTimeout(espera.current);
    if (!q.trim()) { setLista([]); setAberto(false); return; }
    espera.current = setTimeout(async () => {
      try {
        const res = await usersService.getUsers({ q, per_page: 8 });
        setLista(res.data ?? []);
        setAberto(true);
      } catch { setLista([]); }
    }, 300);
  };

  return (
    <div className="relative mt-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={texto}
        onChange={e => {
          const v = e.target.value;
          setTexto(v);
          // Digitou por cima do nome escolhido: o campo não pode mais exibir
          // um nome que não é mais o que vai ser salvo. Mas o texto JÁ digitado
          // continua na tela — quem limpa pra "nada escolhido" é o estado
          // (`corretor` vira null), não o campo (ver `limpeiPorDigitarRef`).
          if (valor && v !== valor.name) {
            limpeiPorDigitarRef.current = true;
            onEscolher(null);
          }
          buscar(v);
        }}
        placeholder="Buscar corretor por nome"
        className="pl-9"
      />
      {aberto && lista.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {lista.map(u => (
            <button
              key={u.id}
              type="button"
              className="w-full border-b border-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/50"
              onClick={() => { onEscolher({ id: u.id, name: u.available_name ?? u.name }); setAberto(false); }}
            >
              {u.available_name ?? u.name}
            </button>
          ))}
        </div>
      )}
    </div>
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
