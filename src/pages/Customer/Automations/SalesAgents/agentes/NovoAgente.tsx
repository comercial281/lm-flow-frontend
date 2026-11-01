// Novo agente em 4 passos, tela cheia (fase 6, tarefa 69): Modo operante · Números e
// usuários · Quem fala · Produto. Cria o agente DESLIGADO e abre no Configurar.
// Substitui o "Nova IA" do seletor e os modelos do passo a passo antigo.
//
// ⚠️ O agente é criado UMA vez e os números entram depois, um a um. Se um número
// falhar, o agente já existe: nada é apagado, o Configurar abre na página dos
// números (`pagina=numeros`) e o aviso diz qual não entrou.
// ⚠️ Salvar nunca recusa por falta de pergunta obrigatória (C11): quem recusa é o
// ligar, depois.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button, Card, Checkbox, Input } from '@/components/ui/ds';
import { BaseHeader, Pagina } from '@/components/base';
import { Campo } from '@/components/base/Campo';
import Aviso from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import inboxesService from '@/services/channels/inboxesService';
import { propertiesService } from '@/services/properties/propertiesService';
import {
  salesAgentsService, type HouseVoice, type Job, type Marca, type QuemFala, type SalesAgent,
} from '@/services/salesAgents/salesAgentsService';
import { paramsDaIa } from '@/features/salesAgents/iaMenu';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';
import {
  ORDEM_DAS_MARCAS, PASSOS_DO_NOVO, agentesDoNumero, avisoDoNumero, marcasComImovel, payloadDoNovo, podeSeguir,
  rascunhoVazio, type RascunhoDoNovo,
} from '@/features/salesAgents/novoAgente';

const MODOS = [
  { valor: 'filtra_passa' as const, rotulo: 'Filtra e passa', descricao: 'Qualifica e passa quando as perguntas obrigatórias estão respondidas.' },
  { valor: 'leva_visita' as const, rotulo: 'Leva até a visita', descricao: 'Qualifica, marca na agenda e só passa com a visita marcada.' },
];
const VOZES = [
  { valor: 'corretor' as const, rotulo: 'Corretor', descricao: 'Como o próprio corretor dono do número.' },
  { valor: 'consultora' as const, rotulo: 'Consultora', descricao: 'Como alguém do time; passa pro corretor.' },
  { valor: 'dono_gerente' as const, rotulo: 'Dono ou gerente', descricao: 'Como quem manda; pode chamar a equipe.' },
];
const GENEROS = [{ valor: 'ela' as const, rotulo: 'Ela' }, { valor: 'ele' as const, rotulo: 'Ele' }];
const MARCAS: Record<Marca, string> = { venda: 'Venda', locacao: 'Locação', leilao: 'Leilão', empreendimento: 'Empreendimento' };

interface Canal { id: string; name: string; oficial: boolean }

export default function NovoAgente() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(1);
  const [r, setR] = useState<RascunhoDoNovo>(rascunhoVazio);
  const [agentes, setAgentes] = useState<SalesAgent[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [criando, setCriando] = useState(false);
  // A contagem do cadastro vem de uma fonte só (a mesma pra conta com e sem agente),
  // lida uma vez ao abrir. Falhou: as marcas ficam sem número e desmarcadas.
  const [contagem, setContagem] = useState<Record<Marca, number> | null>(null);
  // O aviso de marca só depois de tentar criar sem nenhuma.
  const [tentouSemMarca, setTentouSemMarca] = useState(false);

  useEffect(() => {
    let vivo = true;
    salesAgentsService.list()
      .then((l) => { if (vivo) setAgentes(l.filter((a) => !a.absorbed_into_id)); })
      .catch(() => { /* sem a lista, o passo 2 só não mostra quem já usa o número */ });
    inboxesService.list()
      .then((res) => {
        const data = ((res as unknown as { data?: Array<{ id: string | number; name: string; whatsapp_cloud?: unknown }> }).data) ?? [];
        if (vivo) setCanais(data.map((i) => ({ id: String(i.id), name: i.name, oficial: !!i.whatsapp_cloud })));
      })
      .catch(() => { if (vivo) setCanais([]); });
    propertiesService.contarPorMarca()
      .then((c) => {
        if (!vivo) return;
        setContagem(c);
        // Só preenche se a pessoa ainda não mexeu nas marcas.
        setR((x) => (x.serves.length ? x : { ...x, serves: marcasComImovel(c) }));
      })
      .catch(() => { /* sem contagem: marcas sem número e desmarcadas */ });
    return () => { vivo = false; };
  }, []);

  const comImovel = useMemo(() => marcasComImovel(contagem), [contagem]);

  const casa = r.casa;
  const mudaCasa = (campo: Partial<HouseVoice>) => setR((x) => ({ ...x, casa: { ...x.casa, ...campo } }));
  const alterna = <T,>(lista: T[], v: T, on: boolean) => (on ? (lista.includes(v) ? lista : [...lista, v]) : lista.filter((i) => i !== v));

  const criar = async () => {
    setCriando(true);
    let novo: SalesAgent;
    try {
      novo = await salesAgentsService.create(payloadDoNovo(r, comImovel));
    } catch (e) {
      toast.error(motivoDaFalha(e, 'Não consegui criar o agente.'));
      setCriando(false);
      return;
    }
    const naoEntraram: string[] = [];
    for (const id of r.inboxIds) {
      try {
        await salesAgentsService.criarNumero(novo.id, { inbox_id: id });
      } catch {
        naoEntraram.push(canais.find((c) => c.id === id)?.name ?? 'um número');
      }
    }
    if (naoEntraram.length) {
      toast.error(`O agente foi criado, mas ${naoEntraram.length === 1 ? 'este número não entrou' : 'estes números não entraram'}: ${naoEntraram.join(', ')}. Ligue ${naoEntraram.length === 1 ? 'ele' : 'eles'} na página Números.`);
      navigate({ pathname: '/ia-vendedora', search: `?${new URLSearchParams(paramsDaIa(novo.id, 'configurar', 'numeros'))}` }, { replace: true });
      return;
    }
    navigate({ pathname: '/ia-vendedora', search: `?${new URLSearchParams(paramsDaIa(novo.id, 'configurar'))}` }, { replace: true });
  };

  return (
    <Pagina
      estreita
      className="space-y-5"
      acima={<p className="text-xs font-medium text-muted-foreground"><Link to="/ia-vendedora" className="hover:underline">IA Vendedora</Link> / Novo agente</p>}
      cabecalho={<BaseHeader title="Novo agente" subtitle="Quatro passos. Ele nasce desligado e abre no Configurar." />}
    >
      <ol aria-label="Passos" className="flex flex-wrap gap-2 text-sm">
        {PASSOS_DO_NOVO.map((nome, i) => (
          <li key={nome} aria-current={i + 1 === passo ? 'step' : undefined}
            className={`rounded-full border px-3 py-1 ${i + 1 === passo ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border text-muted-foreground'}`}>
            {`${i + 1} · ${nome}`}
          </li>
        ))}
      </ol>

      <Card className="gap-5 p-5 sm:p-8">
        {passo === 1 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Qual o modo operante?</h2>
              <p className="text-sm text-muted-foreground">Dá pra mudar depois. O resto já vem pronto pro modo escolhido.</p>
            </div>
            <CartoesDeEscolha<Job> rotulo="Modo operante" valor={r.job} opcoes={MODOS} aoEscolher={(job) => setR((x) => ({ ...x, job }))} />
            <Campo id="novo-nome" rotulo="Nome do agente" ajuda="Só aparece aqui no LM Flow.">
              <Input id="novo-nome" value={r.nome} maxLength={60} onChange={(e) => setR((x) => ({ ...x, nome: e.target.value }))} />
            </Campo>
          </>
        )}

        {passo === 2 && (
          <>
            <h2 className="text-lg font-semibold">Em quais números ele atende?</h2>
            {canais.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há número conectado. Dá pra ligar um depois, no Configurar.</p>
            ) : (
              <ul className="space-y-2">
                {canais.map((c) => {
                  const usam = agentesDoNumero(c.id, agentes);
                  const marcado = r.inboxIds.includes(c.id);
                  const avisoDaDivisao = marcado ? avisoDoNumero(c.id, agentes) : null;
                  return (
                    <li key={c.id} className="space-y-2">
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                        <Checkbox checked={marcado} aria-label={c.name}
                          onCheckedChange={(v) => setR((x) => ({ ...x, inboxIds: alterna(x.inboxIds, c.id, v === true) }))} />
                        <span>{c.oficial ? `${c.name} (API oficial)` : c.name}</span>
                        {usam.map((n) => <span key={n} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{n}</span>)}
                      </label>
                      {avisoDaDivisao && <Aviso tom="atencao" compacto>{avisoDaDivisao}</Aviso>}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">Número que já tem agente: os dois dividem o número por gatilho.</p>
          </>
        )}

        {passo === 3 && (
          <>
            <div>
              <h2 className="text-lg font-semibold">Quem fala, por padrão?</h2>
              <p className="text-sm text-muted-foreground">É a ficha da casa. Cada número pode ter a sua depois, no Configurar.</p>
            </div>
            <CartoesDeEscolha<QuemFala> rotulo="Quem fala" valor={casa.kind ?? null} opcoes={VOZES} colunas={3}
              aoEscolher={(kind) => mudaCasa({ kind })} />
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="novo-casa-nome" rotulo="Nome">
                <Input id="novo-casa-nome" value={casa.name ?? ''} placeholder="sem nome" maxLength={60} onChange={(e) => mudaCasa({ name: e.target.value })} />
              </Campo>
              <Campo id="novo-casa-intro" rotulo="Como se apresenta">
                <Input id="novo-casa-intro" value={casa.intro ?? ''} maxLength={200} onChange={(e) => mudaCasa({ intro: e.target.value })} />
              </Campo>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Ele ou ela</p>
              <BotoesDeEscolha rotulo="Ele ou ela" valor={casa.gender ?? null} opcoes={GENEROS}
                aoEscolher={(gender) => mudaCasa({ gender })} />
            </div>
          </>
        )}

        {passo === 4 && (
          <>
            <h2 className="text-lg font-semibold">O que ele vende?</h2>
            <ul className="space-y-2">
              {ORDEM_DAS_MARCAS.map((m) => (
                <li key={m}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox checked={r.serves.includes(m)} aria-label={MARCAS[m]}
                      onCheckedChange={(v) => setR((x) => ({ ...x, serves: alterna(x.serves, m, v === true) }))} />
                    <span>{MARCAS[m]}</span>
                    {contagem && <span className="text-xs text-muted-foreground">{`${contagem[m]} no cadastro`}</span>}
                  </label>
                </li>
              ))}
            </ul>
            {tentouSemMarca && r.serves.length === 0 && <p className="text-sm text-destructive">Marque pelo menos um: Venda, Locação, Leilão ou Empreendimento.</p>}
            <Aviso tom="info">Nasce <b>desligado</b> e abre no Configurar com o que falta marcado no índice.</Aviso>
          </>
        )}
      </Card>

      <div className="flex justify-between gap-3">
        <div>
          {passo > 1 && <Button type="button" variant="outline" disabled={criando} onClick={() => setPasso((p) => p - 1)}>Voltar</Button>}
        </div>
        {passo < PASSOS_DO_NOVO.length ? (
          <Button type="button" disabled={!podeSeguir(passo, r)} onClick={() => setPasso((p) => p + 1)}>Seguir</Button>
        ) : (
          <Button type="button" disabled={criando}
            onClick={() => { if (!podeSeguir(passo, r)) { setTentouSemMarca(true); return; } void criar(); }}>
            {criando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}Criar agente desligado
          </Button>
        )}
      </div>
    </Pagina>
  );
}
