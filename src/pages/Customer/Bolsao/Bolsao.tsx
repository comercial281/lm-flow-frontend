import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
} from '@/components/ui/ds';
import {
  Inbox,
  Search,
  MapPin,
  Building2,
  Clock,
  Hand,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { apiErrorMessage } from '@/utils/apiHelpers';
import bolsaoService, { BolsaoLead, BolsaoQuota } from '@/services/bolsao/bolsaoService';
import { useBolsaoQuota } from './useBolsaoQuota';

// De quanto em quanto tempo a lista se atualiza sozinha. Mesma cadência da faixa
// de ofertas da roleta. Existe para o corretor não clicar num lead que outro
// acabou de levar — o erro chega igual, mas ver a lista mexer é diferente de
// levar um "esse já foi" do nada.
const POLL_MS = 30_000;

function waitingLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

export default function Bolsao() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<BolsaoLead[]>([]);
  const [quota, setQuota] = useState<BolsaoQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // O lead recém-puxado, com o contato revelado. Fica no topo até o corretor
  // sair da tela: é o momento em que ele precisa do telefone.
  const [justClaimed, setJustClaimed] = useState<BolsaoLead | null>(null);

  const searchRef = useRef(search);
  searchRef.current = search;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { leads: rows, quota: q } = await bolsaoService.list(
        searchRef.current ? { q: searchRef.current } : {},
      );
      setLeads(rows);
      setQuota(q);
    } catch (e) {
      // No polling silencioso não vale gritar: a rede oscila, e um toast a cada
      // 30 segundos transformaria a tela numa cachoeira de erro.
      if (!silent) toast.error(apiErrorMessage(e, 'Não consegui carregar o Bolsão.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => load(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Busca com respiro: sem isso seria uma requisição por tecla digitada.
  useEffect(() => {
    const id = window.setTimeout(() => load(true), 400);
    return () => window.clearTimeout(id);
  }, [search, load]);

  const { blocked, countdown, expired } = useBolsaoQuota(quota);

  // Relógio zerou: quem libera é o servidor, não a tela.
  useEffect(() => {
    if (expired) load(true);
  }, [expired, load]);

  const handleClaim = async (lead: BolsaoLead) => {
    setClaiming(lead.id);
    try {
      const result = await bolsaoService.claim(lead.id);
      setJustClaimed(result.lead);
      setQuota(result.quota);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      toast.success('Lead é seu. Fale com ele agora.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui puxar esse lead.'));
      // Seja "outro pegou primeiro" ou cota estourada, a lista e o contador na
      // tela estão velhos — recarregar é o que faz a tela parar de mentir.
      load(true);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Inbox className="h-6 w-6" /> Bolsão de Leads
        </h1>
        <p className="text-muted-foreground">
          Leads sem responsável esperando alguém. Escolha um e ele passa a ser seu.
        </p>
      </div>

      <QuotaBanner quota={quota} blocked={blocked} countdown={countdown} onRefresh={() => load()} />

      {justClaimed && (
        <ClaimedCard lead={justClaimed} onOpen={() => navigate('/conversations')} onDismiss={() => setJustClaimed(null)} />
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, cidade ou interesse"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando o Bolsão…
        </div>
      ) : leads.length === 0 ? (
        // O estado vazio importa: sem explicação, o corretor conclui que a tela
        // está quebrada em vez de que ninguém abasteceu ainda.
        <EmptyState
          icon={Inbox}
          title={search ? 'Nenhum lead com esse filtro' : 'O Bolsão está vazio agora'}
          description={
            search
              ? 'Tente outro nome, cidade ou empreendimento.'
              : 'Assim que o gestor subir uma lista, os leads aparecem aqui. Vale voltar mais tarde — a tela se atualiza sozinha.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              blocked={blocked}
              countdown={countdown}
              claiming={claiming === lead.id}
              onClaim={() => handleClaim(lead)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * O contador fica SEMPRE visível, não só quando trava. Ver "pode pegar mais 1"
 * antes de clicar é o que evita a surpresa de levar um "não pode" depois do
 * clique — e é o que faz a regra parecer regra, e não castigo.
 */
function QuotaBanner({
  quota,
  blocked,
  countdown,
  onRefresh,
}: {
  quota: BolsaoQuota | null;
  blocked: boolean;
  countdown: string | null;
  onRefresh: () => void;
}) {
  if (!quota) return null;

  return (
    <Card className={blocked ? 'border-amber-500/50 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          {blocked ? <Clock className="h-5 w-5 text-amber-600" /> : <Hand className="h-5 w-5 text-emerald-600" />}
          <div>
            <p className="font-medium text-foreground">
              {blocked
                ? 'Você atingiu o limite por enquanto'
                : `Você pode pegar mais ${quota.remaining} ${quota.remaining === 1 ? 'lead' : 'leads'}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {blocked && countdown
                ? `Próxima liberação em ${countdown}`
                : `São ${quota.limit} ${quota.limit === 1 ? 'lead' : 'leads'} a cada ${quota.window_minutes} minutos.`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </CardContent>
    </Card>
  );
}

function LeadCard({
  lead,
  blocked,
  countdown,
  claiming,
  onClaim,
}: {
  lead: BolsaoLead;
  blocked: boolean;
  countdown: string | null;
  claiming: boolean;
  onClaim: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex-1 space-y-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground">{waitingLabel(lead.waiting_since)} no Bolsão</p>
          </div>
          {lead.is_test && <Badge variant="secondary">TESTE</Badge>}
        </div>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          {lead.city && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" /> {lead.city}
            </p>
          )}
          {lead.interest && (
            <p className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0" /> <span className="truncate">{lead.interest}</span>
            </p>
          )}
          {/* O contato aparece cadeado, não em branco: mostrar o campo vazio faria
              parecer que o lead não tem telefone. */}
          <p className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{lead.phone_masked ?? 'Contato oculto'} — aparece ao pegar</span>
          </p>
        </div>

        {lead.batch_name && (
          <Badge variant="outline" className="font-normal">
            {lead.batch_name}
          </Badge>
        )}
      </CardContent>

      <div className="p-4 pt-0">
        <Button className="w-full" disabled={blocked || claiming} onClick={onClaim}>
          {claiming ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pegando…
            </>
          ) : blocked ? (
            <>
              <Clock className="h-4 w-4 mr-2" /> Libera em {countdown}
            </>
          ) : (
            <>
              <Hand className="h-4 w-4 mr-2" /> Pegar lead
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function ClaimedCard({
  lead,
  onOpen,
  onDismiss,
}: {
  lead: BolsaoLead;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-emerald-500/50 bg-emerald-500/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{lead.name} agora é seu</p>
          <p className="text-sm text-muted-foreground">
            {lead.phone_number}
            {lead.email ? ` · ${lead.email}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onOpen}>
            <MessageSquare className="h-4 w-4 mr-2" /> Abrir conversa
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Fechar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
