// Começo por campanha (Tarefa 73, 01/11/2026): como a IA abre a conversa com cada campanha que chega
// nela (boas-vindas, print, áudio e pergunta de intenção). Grava em `openings`, uma entrada por
// campanha (`ref: {kind: 'form' | 'link', id}`); vazio = o padrão da IA (Condução > Abertura).
//
// ⚠️ O que a campanha vende e a condição NÃO moram aqui: moram em Campanhas (a linha `campaign_links`).
// ⚠️ Campanha sem linha (só descoberta pelos leads): a primeira gravação cria a linha antes
// (`criarLinha` com o par tipo + valor, sem imóvel) e grava o ref `link`. Sem texto nada se cria.
// ⚠️ `openings` vai INTEIRO (o servidor troca a lista): as regras antigas (sem `ref`, por origem,
// formulário ou palavra) seguem na lista, intocadas. A entrada que ficou só com o `ref` sai da lista.
import { useEffect, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button } from '@/components/ui/ds';
import { Secao } from '@/components/base/Secao';
import Aviso from '@/components/base/Aviso';
import { campanhasService, type ItemDeCampanha, type TipoDoImovel } from '@/services/campanhas/campanhasService';
import type { SalesAgent, SalesAgentOpening } from '@/services/salesAgents/salesAgentsService';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import TextoNaHora from '../TextoNaHora';
import { CampoDeMidia } from '../CampoDeMidia';
import type { Gravar } from '../useGravarNaHora';

const ENDERECO_DE_CAMPANHAS = '/automations/origem';
const TIPOS: Record<TipoDoImovel, string> = { resale: 'revenda', development: 'empreendimento', auction: 'leilão' };
type Ref = NonNullable<SalesAgentOpening['ref']>;
type Campo = 'greeting' | 'intent_question' | 'image_url' | 'audio_url';

const nomeDe = (it: ItemDeCampanha) => it.label || it.ad_title || it.campaign_name || it.match_value || 'Sem nome';

function vende(it: ItemDeCampanha): string {
  if (it.sells_scope === 'properties') {
    const n = it.property_ids.length;
    return n > 0 ? `${n} ${n === 1 ? 'imóvel' : 'imóveis'}` : 'não diz';
  }
  if (it.sells_scope === 'listing_kind') return it.sells_listing_kind ? `tipo ${TIPOS[it.sells_listing_kind]}` : 'um tipo de imóvel';
  if (it.sells_scope === 'catalog') return 'o catálogo';
  return 'não diz';
}

/** A referência que a abertura usa: o id da ficha (formulário) ou da linha (campanha e anúncio). Nula = ainda sem linha. */
function refDe(it: ItemDeCampanha): Ref | null {
  if (it.kind === 'form') return it.form_config_id ? { kind: 'form', id: String(it.form_config_id) } : null;
  return it.link_id ? { kind: 'link', id: String(it.link_id) } : null;
}
const mesmaRef = (a: SalesAgentOpening['ref'], b: Ref) => !!a && a.kind === b.kind && String(a.id) === b.id;

function LinkParaCampanhas({ children }: { children: string }) {
  const dentro = useInRouterContext();
  return dentro
    ? <Link to={ENDERECO_DE_CAMPANHAS} className="text-primary underline-offset-2 hover:underline">{children}</Link>
    : <a href={ENDERECO_DE_CAMPANHAS} className="text-primary underline-offset-2 hover:underline">{children}</a>;
}

export default function ComecoPorCampanha({ agent, gravar }: { agent: SalesAgent; gravar: Gravar }) {
  const [itens, setItens] = useState<ItemDeCampanha[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  // Sempre a lista mais nova: a linha pode demorar a criar, e a IA muda enquanto isso.
  const aberturas = useRef<SalesAgentOpening[]>(agent.openings ?? []);
  aberturas.current = agent.openings ?? [];

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    campanhasService.lista({ salesAgentId: agent.id })
      .then((l) => { if (vivo) setItens(l); })
      .catch(() => { if (vivo) { setItens([]); setFalhou(true); } });
    return () => { vivo = false; };
  }, [agent.id]);

  const gravarCampo = async (it: ItemDeCampanha, campo: Campo, valor: string | null) => {
    const texto = valor && valor.trim() ? valor : null;
    let ref = refDe(it);
    if (!ref) {
      // Campanha sem linha: sem nada a gravar não se cria linha à toa.
      if (!texto || it.kind === 'form' || !it.match_kind || !it.match_value) return;
      try {
        const linha = await campanhasService.criarLinha({ match_kind: it.match_kind, match_value: it.match_value });
        ref = { kind: 'link', id: String(linha.id) };
        setItens((l) => (l ?? []).map((x) => (x.key === it.key ? { ...x, link_id: String(linha.id) } : x)));
      } catch (e) {
        toast.error(motivoEscrito(e) ?? 'Não deu pra criar a linha da campanha. Tente de novo.');
        return;
      }
    }
    const lista = aberturas.current;
    const i = lista.findIndex((o) => mesmaRef(o.ref, ref!));
    const proxima: SalesAgentOpening = { ...(i >= 0 ? lista[i] : { ref }) };
    if (texto) proxima[campo] = texto; else delete proxima[campo];
    const soRef = Object.keys(proxima).every((k) => k === 'ref');
    if (i < 0 && soRef) return;
    const nova = i < 0 ? [...lista, proxima] : soRef ? lista.filter((_, j) => j !== i) : lista.map((o, j) => (j === i ? proxima : o));
    await gravar({ openings: nova });
  };

  const regrasAntigas = (agent.openings ?? []).filter((o) => !o.ref).length;

  return (
    <Secao titulo="Começo por campanha"
      descricao="Boas-vindas, print, áudio e pergunta de cada campanha. Vazio usa o padrão da IA, da Condução.">
      <Aviso tom="info" compacto>
        <p>
          <b>Quem manda a primeira mensagem?</b> A boas-vindas daqui só sai quando é a IA que começa a conversa. Se um fluxo
          manda antes, ela não sai: a IA lê o que o fluxo mandou, não se apresenta duas vezes e entra já sabendo da campanha.
        </p>
      </Aviso>
      <p className="text-sm text-muted-foreground">
        As campanhas que chegam nesta IA. O que cada uma vende e a condição ficam em Campanhas; aqui fica como ela começa a conversa.
      </p>
      {itens === null && <p className="text-sm text-muted-foreground">Carregando as campanhas...</p>}
      {falhou && <p className="text-sm text-destructive">Não consegui carregar as campanhas. Recarregue a página.</p>}
      {itens !== null && !falhou && itens.length === 0 && (
        <p className="text-sm text-muted-foreground">Ainda não chegou campanha nesta IA.</p>
      )}
      <div className="space-y-3">
        {(itens ?? []).map((it) => {
          const ref = refDe(it);
          const regra = ref ? (agent.openings ?? []).find((o) => mesmaRef(o.ref, ref)) : undefined;
          const nome = nomeDe(it);
          const id = `abertura-${it.key}`;
          const aberto = aberta === it.key;
          return (
            <section key={it.key} aria-label={nome} className="space-y-3 rounded-2xl border-[1.5px] border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{nome}</p>
                  <p className="text-[13px] text-muted-foreground">Vende: {vende(it)} · <LinkParaCampanhas>editar em Campanhas</LinkParaCampanhas></p>
                </div>
                <Button type="button" variant="outline" aria-expanded={aberto} onClick={() => setAberta(aberto ? null : it.key)}>
                  {aberto ? 'Fechar' : 'Abrir'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{regra?.greeting ? 'Boas-vindas própria' : 'Boas-vindas padrão'}</Badge>
                <Badge variant="outline">{regra?.image_url ? 'Com print' : 'Sem print'}</Badge>
                <Badge variant="outline">{regra?.audio_url ? 'Com áudio' : 'Sem áudio'}</Badge>
                <Badge variant="outline">{regra?.intent_question ? 'Intenção: texto próprio' : 'Intenção: automática'}</Badge>
              </div>
              {aberto && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <TextoNaHora id={`${id}-boas`} rotulo="Boas-vindas" tipo="varias" salvo={regra?.greeting ?? ''}
                      ajuda="Vazio usa a padrão da IA." placeholder="Padrão: se apresenta, cita de onde a pessoa veio e faz a pergunta."
                      aoGravar={(x) => gravarCampo(it, 'greeting', x)} />
                  </div>
                  <CampoDeMidia id={`${id}-print`} agentId={agent.id} tipo="image" rotulo="Print" valor={regra?.image_url}
                    aoMudar={(url) => void gravarCampo(it, 'image_url', url)} />
                  <CampoDeMidia id={`${id}-audio`} agentId={agent.id} tipo="audio" rotulo="Áudio" valor={regra?.audio_url}
                    aoMudar={(url) => void gravarCampo(it, 'audio_url', url)} />
                  <div className="md:col-span-2">
                    <TextoNaHora id={`${id}-intencao`} rotulo="Pergunta de intenção" salvo={regra?.intent_question ?? ''}
                      ajuda="Vazio = automática, pelo público do que a campanha vende." placeholder="Texto próprio, se quiser"
                      aoGravar={(x) => gravarCampo(it, 'intent_question', x)} />
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {regrasAntigas > 0 && (
        <p className="text-[13px] text-muted-foreground">
          {regrasAntigas === 1 ? 'Há 1 regra antiga' : `Há ${regrasAntigas} regras antigas`} por origem, formulário ou palavra. Elas continuam valendo e não aparecem na lista.
        </p>
      )}
    </Secao>
  );
}
