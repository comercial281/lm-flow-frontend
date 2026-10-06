import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import api from '@/services/core/api';
import Chave from '@/components/base/Chave';
import { Seletor } from '@/components/base/Seletor';
import { Button } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { clientesService } from '@/services/superAdmin/clientesService';
import ConfirmarDigitando from '../ConfirmarDigitando';
import KitBoasVindasBloco from '../KitBoasVindasBloco';
import {
  GROUP_KIND_LABEL, groupJidsFrom, groupLabel, groupsPatch, nameRuleHint, sortGroupsForPicker,
  type ClientGroupJids, type ClientGroupKind, type WaGroup,
} from '../clientGroups';
import { pedidoLigarDemo, pedidoSemearDemo } from '../confirmacoes';
import { SECAO, TITULO_SECAO } from '../estilo';
import type { PropsDaAba } from './Pagina';

// Operação do cliente (fora do pacote): o que entra no funil, grupos de
// WhatsApp, kit de boas-vindas, isolamento por corretor, caixa só de campanha
// e, no fim, a demonstração. Os grupos têm UMA fonte de verdade (groupJids):
// o servidor faz compact! nessas chaves, então funil e grupos sempre as reenviam.
// Isolamento, caixa e demonstração não reenviam (como na janela antiga).

// As chaves batem 1:1 com LeadOrigin::PipeEntry::GROUPS no backend.
const PIPE_SOURCES = [
  { key: 'ads', label: 'Anúncio (Meta)', desc: 'Lead de campanha: Click-to-WhatsApp ou formulário de anúncio.' },
  { key: 'organic', label: 'WhatsApp orgânico', desc: 'Quem manda a 1ª mensagem no WhatsApp sem ser de anúncio.' },
  { key: 'form', label: 'Captação / site', desc: 'Lead de formulário ou landing page do site.' },
  { key: 'manual', label: 'Manual no CRM', desc: 'Conversa aberta na mão pelo corretor. Adicionar card na mão nunca é bloqueado.' },
] as const;
const PIPE_SOURCE_KEYS: string[] = PIPE_SOURCES.map((p) => p.key);

const CAMPO = 'w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm';

type Auditoria = { saude?: string; painel?: { vazios?: string[] }; entidades_sem_exemplo?: string[] };

const motivoDoErro = (e: unknown): string | undefined =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error;

export default function AbaOperacao({ cliente, aoMudar }: PropsDaAba) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const s = cliente.settings ?? {};
  const [groupJids, setGroupJids] = useState<ClientGroupJids>(groupJidsFrom(s));
  // Legado only_ad_leads=true barrava SÓ o WhatsApp orgânico. Espelha LeadOrigin::PipeEntry::LEGACY_ONLY_ADS.
  // Ref síncrona: dois cliques seguidos, antes do 1º PATCH voltar, partem do mesmo valor atual (otimista).
  const fontes = useRef<string[]>(
    (Array.isArray(s.pipe_entry_sources) ? (s.pipe_entry_sources as string[])
      : (s.only_ad_leads ? PIPE_SOURCE_KEYS.filter((k) => k !== 'organic') : PIPE_SOURCE_KEYS)
    ).filter((k) => PIPE_SOURCE_KEYS.includes(k)),
  );
  const [, redesenhar] = useState(0);
  const [demo, setDemo] = useState(s.demo_mode === true);

  // Grupos de WhatsApp: a lista do número operacional é uma ida à Evolution, só carrega ao clicar em Trocar.
  const [waGroups, setWaGroups] = useState<WaGroup[] | null>(null);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [erroDeGrupos, setErroDeGrupos] = useState<string | null>(null);
  const [editando, setEditando] = useState<ClientGroupKind | null>(null);
  const [escolhido, setEscolhido] = useState('');
  const [gravandoGrupo, setGravandoGrupo] = useState(false);

  // Demonstração
  const [semeando, setSemeando] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [fotos, setFotos] = useState<string>((Array.isArray(s.demo_photo_urls) ? (s.demo_photo_urls as string[]) : []).join('\n'));
  const [gravandoFotos, setGravandoFotos] = useState(false);
  const [auditando, setAuditando] = useState(false);
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
  const [recomecando, setRecomecando] = useState(false);

  const patch = async (corpo: Record<string, unknown>) => {
    const atualizado = await clientesService.atualizar(cliente.id, { name: cliente.name, ...corpo });
    aoMudar({ ...cliente, ...atualizado });
    return atualizado;
  };

  const mudarFonte = async (key: string, ligada: boolean) => {
    const atual = fontes.current;
    const proximo = ligada ? [...atual.filter((k) => k !== key), key] : atual.filter((k) => k !== key);
    fontes.current = proximo;
    redesenhar((n) => n + 1);
    try {
      await patch({ pipe_entry_sources: proximo, ...groupsPatch(groupJids) });
    } catch (e) {
      // desfaz só esta chave: outra pode ter mudado enquanto esta esperava
      fontes.current = ligada ? fontes.current.filter((k) => k !== key) : [...fontes.current, key];
      redesenhar((n) => n + 1);
      throw e;
    }
  };

  const carregarGrupos = async () => {
    if (waGroups !== null || carregandoGrupos) return;
    setCarregandoGrupos(true);
    setErroDeGrupos(null);
    try {
      const d = await clientesService.dadosDeProvisionamento();
      setWaGroups((d.whatsapp_groups as WaGroup[]) || []);
    } catch {
      setErroDeGrupos('Não consegui listar os grupos do número operacional agora.');
    } finally { setCarregandoGrupos(false); }
  };

  const editarGrupo = (kind: ClientGroupKind) => {
    setEditando(kind);
    setEscolhido(groupJids[kind]);
    void carregarGrupos();
  };

  const gravarGrupo = async (kind: ClientGroupKind, jid: string) => {
    const proximo = { ...groupJids, [kind]: jid };
    setGravandoGrupo(true);
    try {
      await patch({ ...groupsPatch(proximo) });
      setGroupJids(proximo);
      setEditando(null);
      toast.success(jid ? 'Grupo gravado.' : 'Cadastro do grupo limpo — volta a valer o nome do grupo.');
    } catch {
      toast.error('Falha ao gravar o grupo de WhatsApp.');
    } finally { setGravandoGrupo(false); }
  };

  const mudarDemo = async (ligar: boolean) => {
    if (ligar && !(await confirmar(pedidoLigarDemo(cliente)))) return false;
    await patch({ demo_mode: ligar });
    setDemo(ligar);
    return true;
  };

  // Semear: cria a imobiliária fictícia inteira. O servidor recusa com o modo demonstração desligado.
  const semear = async () => {
    if (!(await confirmar(pedidoSemearDemo(cliente)))) return;
    setSemeando(true);
    setInfo(null);
    try {
      const r = await api.post(`/super/pooled_tenants/${cliente.id}/demo_seed`, { dry_run: false });
      const d = r.data?.data || {};
      setInfo(
        `Pronto: ${d.equipe} pessoas, ${d.imoveis} imóveis, ${d.leads} leads, ${d.cards} cards` +
        (d.caixa?.whatsapp_real ? ' — dentro do número de WhatsApp conectado.' : ' — numa caixa própria (conecte o chip e semeie de novo para o histórico ficar no número real).'),
      );
    } catch (e) {
      setInfo(null);
      toast.error(motivoDoErro(e) || 'Falha ao semear a demonstração.');
    } finally { setSemeando(false); }
  };

  const gravarFotos = async () => {
    setGravandoFotos(true);
    try {
      const lista = fotos.split('\n').map((u) => u.trim()).filter(Boolean);
      await patch({ demo_photo_urls: lista });
      setInfo(`${lista.length} foto(s) guardada(s). Semeie de novo para a carteira usá-las.`);
    } catch {
      toast.error('Falha ao salvar as fotos da demonstração.');
    } finally { setGravandoFotos(false); }
  };

  const auditar = async () => {
    setAuditando(true);
    try {
      const r = await api.get(`/super/pooled_tenants/${cliente.id}/demo_audit`);
      setAuditoria(r.data?.data || null);
    } catch (e) {
      toast.error(motivoDoErro(e) || 'Falha ao vistoriar a demonstração.');
    } finally { setAuditando(false); }
  };

  const recomecar = async () => {
    setInfo(null);
    try {
      const r = await api.post(`/super/pooled_tenants/${cliente.id}/demo_reset`, { confirm_slug: cliente.slug });
      const d = r.data?.data?.semeadura || {};
      setInfo(`Recomeçada: ${d.leads} leads, ${d.cards} cards, ${d.visitas} visitas, ${d.propostas} propostas.`);
    } catch (e) {
      toast.error(motivoDoErro(e) || 'Falha ao recomeçar a demonstração.');
    } finally { setRecomecando(false); }
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <section aria-labelledby="funil" className={SECAO}>
        <h2 id="funil" className={TITULO_SECAO}>O que entra no funil (padrão do cliente)</h2>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          Padrão herdado pelas pipelines que não têm regra própria. Cada pipeline pode sobrescrever isso em Pipelines &gt; editar &gt; Entrada de leads.
        </p>
        <div className="flex flex-col gap-3">
          {PIPE_SOURCES.map((p) => (
            <Chave key={p.key} rotulo={p.label} descricao={p.desc} ligada={fontes.current.includes(p.key)} aoMudar={(v) => mudarFonte(p.key, v)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="grupos" className={SECAO}>
        <h2 id="grupos" className={`flex items-center gap-2 ${TITULO_SECAO}`}><MessageCircle className="h-4 w-4" /> Grupos WhatsApp</h2>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          {nameRuleHint(cliente.name)} Cadastrar aqui só é preciso quando o nome do grupo foge desse padrão — e o cadastro vence o nome.
        </p>
        <div className="flex flex-col gap-2">
          {(['reminder', 'logs'] as ClientGroupKind[]).map((kind) => {
            const meta = GROUP_KIND_LABEL[kind];
            const atual = groupLabel(groupJids[kind], waGroups, kind);
            const emEdicao = editando === kind;
            const lista = waGroups ? sortGroupsForPicker(waGroups, cliente.name) : [];
            const foraDaLista = !!groupJids[kind] && waGroups !== null && !waGroups.some((g) => g.jid === groupJids[kind]);
            return (
              <div key={kind} className="rounded-md bg-muted/50 px-2.5 py-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{meta.hint}</div>
                    {!emEdicao && (
                      <div className={`mt-1 truncate text-xs ${atual.source === 'nome' ? 'italic text-muted-foreground' : atual.source === 'fora' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                        title={groupJids[kind] || undefined}>
                        {atual.text}
                      </div>
                    )}
                    {!emEdicao && atual.warning && <div className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">{atual.warning}</div>}
                  </div>
                  {!emEdicao && (
                    <Button size="sm" variant="outline" onClick={() => editarGrupo(kind)} disabled={gravandoGrupo}>
                      {groupJids[kind] ? 'Trocar' : 'Definir'}
                    </Button>
                  )}
                </div>
                {emEdicao && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {erroDeGrupos && <div className="text-xs text-amber-600 dark:text-amber-400">{erroDeGrupos}</div>}
                    <Seletor aria-label={`Grupo: ${meta.label}`} value={escolhido} onChange={(e) => setEscolhido(e.target.value)} disabled={carregandoGrupos} className="w-full">
                      <option value="">
                        {carregandoGrupos ? 'Carregando grupos do número operacional...'
                          : kind === 'reminder' ? '— sem cadastro (reconhecer pelo nome do grupo) —' : '— sem cadastro —'}
                      </option>
                      {/* O grupo gravado que sumiu da lista continua escolhível: sumir com ele faria o Salvar gravar vazio sem ninguém ver. */}
                      {foraDaLista && <option value={groupJids[kind]}>{groupJids[kind]} (gravado, fora da lista)</option>}
                      {lista.map((g) => <option key={g.jid} value={g.jid}>{g.name}</option>)}
                    </Seletor>
                    {waGroups !== null && waGroups.length === 0 && !carregandoGrupos && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">O número operacional não devolveu grupo nenhum.</div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => void gravarGrupo(kind, escolhido)} disabled={gravandoGrupo || carregandoGrupos}>Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditando(null)} disabled={gravandoGrupo}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <KitBoasVindasBloco tenantId={cliente.id} />

      <section aria-labelledby="atendimento" className={`${SECAO} flex flex-col gap-4`}>
        <h2 id="atendimento" className={TITULO_SECAO}>Atendimento</h2>
        <Chave rotulo="Isolamento por corretor"
          descricao="Cada corretor só vê os leads dele na caixa e em Contatos, mesmo dividindo um número. Gerente e admin continuam vendo tudo. Desligue só se o time atende a caixa em conjunto de propósito."
          ligada={cliente.broker_isolation ?? (s.broker_isolation !== false)}
          aoMudar={async (v) => { await patch({ broker_isolation: v }); }} />
        <Chave rotulo="Caixa só de campanha"
          descricao="A caixa mostra só conversas que entraram em algum funil ou iniciadas na mão pelo painel. Quem foi barrado pelas origens acima (WhatsApp orgânico, form do site) some da caixa também, não só do funil. Ligue para o corretor não ver mensagem de conhecido; deixe desligado para ele ver tudo e só o funil filtrar."
          ligada={cliente.campaign_only_inbox === true}
          aoMudar={async (v) => { await patch({ campaign_only_inbox: v }); }} />
      </section>

      <section aria-labelledby="demo" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 xl:col-span-2">
        <h2 id="demo" className={`mb-3 ${TITULO_SECAO}`}>Demonstração</h2>
        <Chave rotulo="Modo demonstração"
          descricao="Só para o CRM que usamos em call de venda. Com a chave ligada, este cliente só manda WhatsApp para quem escreveu para o número dele primeiro, e não manda e-mail nenhum — assim os leads fictícios da demonstração nunca recebem follow-up, funil ou aviso de gestor. Na tela nada muda: a mensagem aparece como enviada na conversa."
          ligada={demo} aoMudar={mudarDemo} />
        {demo && (
          <div className="mt-3 flex flex-col gap-3 border-t border-amber-500/30 pt-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Semear demonstração</div>
                <div className="text-xs text-muted-foreground">
                  Cria a imobiliária fictícia inteira — equipe, carteira, leads, conversas e funil — com datas de hoje. Conecte o WhatsApp antes, para o histórico nascer dentro do número real.
                </div>
              </div>
              <Button size="sm" onClick={() => void semear()} disabled={semeando}>Semear</Button>
            </div>
            {info && <div className="text-xs text-emerald-600 dark:text-emerald-400">{info}</div>}

            <div className="border-t border-amber-500/30 pt-3">
              <label htmlFor="demo-fotos" className="mb-1 block text-xs font-medium">Fotos da carteira (um endereço por linha)</label>
              <p className="mb-1.5 text-[11px] text-muted-foreground">
                O gerador não inventa foto de imóvel. Suba as suas num endereço público e cole os links aqui — ficam guardados e sobrevivem ao recomeço.
              </p>
              <textarea id="demo-fotos" value={fotos} onChange={(e) => setFotos(e.target.value)} rows={3}
                placeholder="https://.../casa-1.jpg" className={`${CAMPO} font-mono text-xs`} />
              <Button size="sm" variant="outline" className="mt-1.5" onClick={() => void gravarFotos()} disabled={gravandoFotos}>Salvar fotos</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-amber-500/30 pt-3">
              <Button size="sm" variant="outline" onClick={() => void auditar()} disabled={auditando}>Conferir saúde</Button>
              <Button size="sm" variant="destructive" onClick={() => setRecomecando(true)}>Recomeçar demo</Button>
              <span className="text-[11px] text-muted-foreground">Recomeçar não desconecta o WhatsApp.</span>
            </div>

            {auditoria && (
              <div className="text-xs">
                <span className={auditoria.saude === 'verde' ? 'text-emerald-600 dark:text-emerald-400'
                  : auditoria.saude === 'amarelo' ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'}>
                  {auditoria.saude === 'verde' ? '● Pronta para apresentar'
                    : auditoria.saude === 'amarelo' ? '● Falta exemplo em alguma tela nova'
                      : '● O painel abriria com bloco vazio'}
                </span>
                {!!auditoria.painel?.vazios?.length && (
                  <div className="mt-1 text-muted-foreground">Blocos vazios no painel: {auditoria.painel.vazios.join(', ')}</div>
                )}
                {!!auditoria.entidades_sem_exemplo?.length && (
                  <div className="mt-1 text-muted-foreground">
                    Sem dado de exemplo: {auditoria.entidades_sem_exemplo.slice(0, 12).join(', ')}
                    {auditoria.entidades_sem_exemplo.length > 12 && ` e mais ${auditoria.entidades_sem_exemplo.length - 12}`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmarDigitando aberto={recomecando} titulo={`Recomeçar a demonstração de ${cliente.name}?`}
        descricao="Apaga leads, conversas, funil, visitas e propostas, e gera tudo de novo com datas de hoje. O WhatsApp continua conectado."
        esperado={cliente.slug} rotuloDaAcao="Recomeçar"
        aoConfirmar={recomecar} aoFechar={() => setRecomecando(false)} />
      {dialogoDeConfirmacao}
    </div>
  );
}
