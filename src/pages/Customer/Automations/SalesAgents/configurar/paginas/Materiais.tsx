// Materiais (Tarefa 74): o que ela pode mandar, da casa e de cada imóvel, com o "quando mandar". Entrega BLOCOS
// (a moldura é o Card da página). Chaves e regra do book gravam na hora pelo `gravar`; o material (documento) é do
// agente e grava pela janela, com Salvar. Spec da fase 6, §Materiais e §Localização como pino.
//
// ⚠️ As chaves Book, Fotos e vídeo e Localização são do AGENTE: aparecem em cada imóvel, mas valem pra todos.
// ⚠️ O pino tem chave própria (`location_pin_enabled`, C33): "Fotos e vídeo" desligado não tira o pino. Quem decide
// se ele sai é o servidor; `pinoPode` só espelha a regra pra explicar na tela.
// ⚠️ Material de outro imóvel não aparece: o vínculo é o `property_codes` do documento, e o servidor não solta mais
// arquivo restrito (o "resgate" saiu).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FileText, Film, ImageIcon, Link2, MapPin, Paperclip, Upload, type LucideIcon } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import Aviso from '@/components/base/Aviso';
import Chave from '@/components/base/Chave';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { cn } from '@/lib/utils';
import { salesAgentsService, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { campanhasService } from '@/services/campanhas/campanhasService';
import { tipoDoImovel, type ListingKind } from '@/features/properties/listingKind';
import { juntarImoveis, materiaisDaCasa, materiaisPorImovel, pinoPode, porQueOPinoNaoSai, QUANDO_PADRAO, type ImovelDaPagina } from '@/features/salesAgents/materiais';
import { DOC_ACCEPT, docUploadError } from '../../docUpload';
import JanelaDoMaterial, { JanelaDaRegraDoBook, JanelaDoLink } from './JanelaDoMaterial';
import type { PropsDaPagina } from '../paginas';

const TIPO: Record<ListingKind, string> = { development: 'Empreendimento', resale: 'Revenda', auction: 'Leilão' };
const SEM_REGRA = 'Sem "quando mandar": ela usa o próprio juízo.';
const MAXIMO_DE_CAMPANHAS = 30;

function iconeDe(d: SalesAgentDocument): LucideIcon {
  return d.source_type === 'url' ? Link2 : d.media_kind === 'image' ? ImageIcon : d.media_kind === 'video' ? Film : FileText;
}

function Linha({ icone: Icone, titulo, selo, quando, aviso, acao }: {
  icone: LucideIcon; titulo: string; selo?: string; quando?: string | null; aviso?: ReactNode; acao?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icone className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0 space-y-0.5 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          <span>{titulo}</span>
          {selo && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{selo}</span>}
        </p>
        {quando === undefined ? null : quando
          ? <p><span className="text-muted-foreground">Quando mandar: </span><span>{quando}</span></p>
          : <p className="text-muted-foreground">{SEM_REGRA}</p>}
        {aviso && <div className="text-xs text-muted-foreground">{aviso}</div>}
      </div>
      <div className="flex items-center gap-2">{acao}</div>
    </li>
  );
}

function NovoMaterial({ rotulo, rotuloDoArquivo, ocupado, aoArquivo, aoLink }: {
  rotulo: string; rotuloDoArquivo: string; ocupado: boolean; aoArquivo: (f: File) => void; aoLink: () => void;
}) {
  const seletor = useRef<HTMLInputElement>(null);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={ocupado}>{rotulo}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => seletor.current?.click()}><Upload className="h-4 w-4" aria-hidden /> Subir arquivo</DropdownMenuItem>
          <DropdownMenuItem onSelect={aoLink}><Link2 className="h-4 w-4" aria-hidden /> Colar um link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={seletor} type="file" className="hidden" accept={DOC_ACCEPT} aria-label={rotuloDoArquivo}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) aoArquivo(f); e.target.value = ''; }} />
    </>
  );
}

type Janela = { tipo: 'material'; doc: SalesAgentDocument } | { tipo: 'book' } | { tipo: 'link'; codigo?: string } | null;

export default function Materiais({ agent, gravar, irPara }: PropsDaPagina) {
  const [docs, setDocs] = useState<SalesAgentDocument[] | null>(null);
  const [erroDosDocs, setErroDosDocs] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Os imóveis da página: o principal, os com material, os das campanhas e os que a pessoa foi buscando.
  const [opcoes, setOpcoes] = useState<Property[]>([]);
  const [opcoesProntas, setOpcoesProntas] = useState(false);
  const [daCampanha, setDaCampanha] = useState<Property[]>([]);
  const [extras, setExtras] = useState<ImovelDaPagina[]>([]);
  const [achados, setAchados] = useState<Record<string, ImovelDaPagina | null>>({});
  const pedidos = useRef(new Set<string>());

  const carregarDocs = useCallback(async () => {
    try {
      setDocs(await salesAgentsService.listDocuments(agent.id));
      setErroDosDocs(false);
    } catch {
      setErroDosDocs(true);
    }
  }, [agent.id]);
  useEffect(() => { void carregarDocs(); }, [carregarDocs]);

  useEffect(() => {
    let vivo = true;
    propertiesService.list({ status: 'active', per_page: 100 })
      .then((r) => { if (vivo) setOpcoes(r.data ?? []); })
      .catch(() => {})
      .finally(() => { if (vivo) setOpcoesProntas(true); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    campanhasService.lista({ salesAgentId: agent.id })
      .then(async (itens) => {
        const ids = [...new Set(itens.flatMap((i) => i.property_ids ?? []))].slice(0, MAXIMO_DE_CAMPANHAS);
        const imoveis = await Promise.all(ids.map((id) => propertiesService.get(id).catch(() => null)));
        if (vivo) setDaCampanha(imoveis.filter((p): p is Property => !!p));
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [agent.id]);

  const codigoDosDocs = useMemo(() => [...new Set((docs ?? []).filter((d) => d.sendable).flatMap((d) => d.property_codes ?? []))], [docs]);
  const principal = agent.default_property_code ?? '';
  const conhecidos = useMemo(() => {
    const m = new Map<string, ImovelDaPagina>();
    juntarImoveis(daCampanha, extras, opcoes).forEach((i) => m.set(i.code, i));
    return m;
  }, [daCampanha, extras, opcoes]);

  // Código que ainda não veio de nenhuma lista: busca no cadastro. Não achou = o imóvel não está entre os imóveis.
  useEffect(() => {
    if (!docs || !opcoesProntas) return;
    [principal, ...codigoDosDocs].filter(Boolean).forEach((code) => {
      if (conhecidos.has(code) || pedidos.current.has(code)) return;
      pedidos.current.add(code);
      propertiesService.list({ q: code, per_page: 5 })
        .then((r) => setAchados((a) => ({ ...a, [code]: (r.data ?? []).find((p) => p.code === code) ?? null })))
        .catch(() => setAchados((a) => ({ ...a, [code]: null })));
    });
  }, [docs, opcoesProntas, principal, codigoDosDocs, conhecidos]);

  const imoveis = useMemo(() => {
    const doCodigo = (code: string): ImovelDaPagina | null => {
      const achado = conhecidos.get(code) ?? achados[code];
      if (achado) return achado;
      return achados[code] === null ? { code, title: code } : null; // sem `id` = o cadastro não achou
    };
    const base = [principal, ...codigoDosDocs].filter(Boolean).map(doCodigo).filter((i): i is ImovelDaPagina => !!i);
    return juntarImoveis(base, daCampanha, extras);
  }, [conhecidos, achados, principal, codigoDosDocs, daCampanha, extras]);

  const escolhaveis = opcoes.filter((o) => !imoveis.some((i) => i.code === o.code));
  const verOutro = (code: string) => {
    const p = opcoes.find((o) => o.code === code);
    if (p) setExtras((e) => juntarImoveis(e, [p]));
  };

  // --- criar material ---
  const abrirNovo = async (criado: SalesAgentDocument, codigo?: string) => {
    const doc = (await salesAgentsService.updateDocument(agent.id, criado.id, { sendable: true, ...(codigo ? { property_codes: [codigo] } : {}) })) ?? criado;
    await carregarDocs();
    setJanela({ tipo: 'material', doc });
  };
  const subir = async (file: File, codigo?: string) => {
    if (ocupado) return;
    const erro = docUploadError(file);
    if (erro) { toast.error(erro); return; }
    setOcupado('0');
    try {
      const criado = await salesAgentsService.uploadFileDocument(agent.id, file, undefined, (p) => setOcupado(String(p)));
      await abrirNovo(criado, codigo);
    } catch {
      toast.error('Não deu pra subir o arquivo. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  };
  const criarLink = async (link: { title: string; url: string }, codigo?: string) => {
    const criado = await salesAgentsService.criarLink(agent.id, link);
    setJanela(null);
    if (codigo) await abrirNovo(criado, codigo);
    else { await carregarDocs(); setJanela({ tipo: 'material', doc: criado }); }
  };

  const regraDoBook = (agent.book_send_rule ?? '').trim();
  const porImovel = materiaisPorImovel(docs ?? [], imoveis);
  const casa = materiaisDaCasa(docs ?? []);

  const linhaDoDoc = (d: SalesAgentDocument, selo?: string) => (
    <Linha key={d.id} icone={iconeDe(d)} titulo={d.title} selo={selo} quando={(d.send_when ?? '').trim()}
      acao={<Button type="button" variant="ghost" size="sm" aria-label={`Editar ${d.title}`} onClick={() => setJanela({ tipo: 'material', doc: d })}>Editar</Button>} />
  );

  const cabecalhoDoImovel = (i: ImovelDaPagina) => (
    <div className="flex flex-wrap items-center gap-2">
      <b className="text-sm">{i.title}</b>
      {i.id ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{TIPO[tipoDoImovel(i)]}</span> : null}
      {i.title !== i.code && <span className="text-xs text-muted-foreground">{i.code}</span>}
    </div>
  );

  const linhaDoPino = (i: ImovelDaPagina) => {
    const porQue = porQueOPinoNaoSai(i, agent);
    if (!pinoPode(i, agent)) {
      return (
        <Linha icone={MapPin} titulo="Localização" quando={QUANDO_PADRAO.pino}
          aviso={(
            <span className="space-y-1">
              <span className="block">{porQue}</span>
              {agent.ai_limits?.address && tipoDoImovel(i) === 'development' && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => irPara('conducao')}>Abrir Condução</Button>
              )}
            </span>
          )} />
      );
    }
    return (
      <Linha icone={MapPin} titulo="Localização" selo="do cadastro" quando={QUANDO_PADRAO.pino}
        aviso="Sai como pino no mapa, com o nome do imóvel e o bairro."
        acao={<Chave rotulo="Mandar a localização" semRotuloVisivel semAviso ligada={agent.location_pin_enabled !== false}
          aoMudar={(v) => gravar({ location_pin_enabled: v })} />} />
    );
  };

  const grupoDoImovel = (i: ImovelDaPagina) => {
    const materiais = porImovel[i.code] ?? [];
    const cadastro = !!i.id;
    return (
      <div key={i.code} role="group" aria-label={i.title} className="space-y-2">
        {cabecalhoDoImovel(i)}
        <ul className="grid gap-2">
          {cadastro ? (
            <>
              {i.has_book && (
                <Linha icone={FileText} titulo="Book" selo="do cadastro" quando={regraDoBook}
                  aviso={i.book_file_name ?? undefined}
                  acao={(
                    <>
                      <Button type="button" variant="ghost" size="sm" aria-label="Editar a regra do book" onClick={() => setJanela({ tipo: 'book' })}>Editar</Button>
                      <Chave rotulo="Mandar o book" semRotuloVisivel semAviso ligada={agent.send_property_book_enabled !== false}
                        aoMudar={(v) => gravar({ send_property_book_enabled: v })} />
                    </>
                  )} />
              )}
              <Linha icone={ImageIcon} titulo="Fotos e vídeo" selo="do cadastro" quando={QUANDO_PADRAO.fotos}
                acao={<Chave rotulo="Mandar fotos e vídeo" semRotuloVisivel semAviso ligada={agent.rich_media_enabled !== false}
                  aoMudar={(v) => gravar({ rich_media_enabled: v })} />} />
              {i.virtual_tour_url && <Linha icone={Link2} titulo="Tour virtual" selo="do cadastro" quando={QUANDO_PADRAO.tour} aviso={i.virtual_tour_url} />}
              {linhaDoPino(i)}
            </>
          ) : (
            <li className="text-xs text-muted-foreground">Este imóvel não está entre os imóveis do cadastro. Só o material ligado a ele aparece.</li>
          )}
          {materiais.map((d) => linhaDoDoc(d))}
        </ul>
        <NovoMaterial rotulo="+ Material deste imóvel" rotuloDoArquivo={`Escolher arquivo de ${i.title}`} ocupado={!!ocupado}
          aoArquivo={(f) => void subir(f, i.code)} aoLink={() => setJanela({ tipo: 'link', codigo: i.code })} />
      </div>
    );
  };

  return (
    <Secoes>
      <Secao titulo="Da casa" descricao="O que vale pra qualquer conversa.">
        <div role="region" aria-label="Da casa" className="space-y-3">
          {erroDosDocs ? (
            <EmptyState tipo="erro" aoTentarDeNovo={() => void carregarDocs()} />
          ) : docs === null ? (
            <Carregando variante="cartoes" linhas={2} rotulo="Carregando os materiais" />
          ) : casa.length === 0 ? (
            <EmptyState icon={Paperclip} title="Sem material da casa ainda" description="Apresentação, site, tabela: o que ela pode mandar em qualquer conversa." className="py-6" />
          ) : (
            <ul className="grid gap-2">{casa.map((d) => linhaDoDoc(d))}</ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <NovoMaterial rotulo="+ Material da casa" rotuloDoArquivo="Escolher arquivo da casa" ocupado={!!ocupado}
              aoArquivo={(f) => void subir(f)} aoLink={() => setJanela({ tipo: 'link' })} />
            {ocupado !== null && <span role="status" className="text-xs text-muted-foreground">{`Subindo o arquivo… ${ocupado}%`}</span>}
          </div>
        </div>
      </Secao>

      <Secao titulo="De cada imóvel" descricao="Ligado ao imóvel, só vai quando ele está na conversa. As chaves de Book, Fotos e vídeo e Localização valem pra todos os imóveis.">
        {docs !== null && imoveis.map(grupoDoImovel)}
        {docs !== null && imoveis.length === 0 && <p className="text-sm text-muted-foreground">Ainda sem imóvel na lista. Escolha um abaixo, ou ligue um material a um imóvel.</p>}
        <Campo id="materiais-outro" rotulo="Ver outro imóvel" ajuda="Só acrescenta o imóvel à lista desta página. Não muda nada na IA.">
          <Seletor id="materiais-outro" className={cn(CLASSE_DO_CAMPO, 'w-full')} value="" onChange={(e) => { if (e.target.value) verOutro(e.target.value); }}>
            <option value="">Escolha um imóvel…</option>
            {escolhaveis.map((o) => <option key={o.code} value={o.code}>{o.code} · {o.title}</option>)}
          </Seletor>
        </Campo>
        <Aviso tom="info" titulo="Quem decide o momento:">
          a própria IA, que escolhe a cada mensagem o que mandar desta lista. O "quando mandar" é o que ela lê pra acertar.
        </Aviso>
      </Secao>

      {janela?.tipo === 'material' && (
        <JanelaDoMaterial agentId={agent.id} doc={janela.doc} aoFechar={() => setJanela(null)}
          aoSalvo={() => { setJanela(null); void carregarDocs(); }} />
      )}
      {janela?.tipo === 'book' && (
        <JanelaDaRegraDoBook regra={regraDoBook} aoFechar={() => setJanela(null)} gravar={(regra) => gravar({ book_send_rule: regra })} />
      )}
      {janela?.tipo === 'link' && (
        <JanelaDoLink aoFechar={() => setJanela(null)} aoCriar={(l) => criarLink(l, janela.codigo)} />
      )}
    </Secoes>
  );
}
