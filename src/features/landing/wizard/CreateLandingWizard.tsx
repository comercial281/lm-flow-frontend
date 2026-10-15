import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, Check, LayoutTemplate, Loader2, Megaphone } from 'lucide-react';
import { labelsService } from '@/services/contacts/labelsService';
import { landingPageService } from '@/services/landingPages/landingPageService';
import { landingTemplatesService, type LandingTemplateDTO } from '@/services/landingPages/landingTemplatesService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { safeParsePageBlocks } from '@/features/landing/blocks';
// Mesmo conversor da lista e do editor: o endereço mostrado aqui tem que ser
// idêntico ao que a página vai receber ao publicar.
import { slugifyLandingName } from '@/features/landing/manage/landingUrl';
import { Seletor } from '@/components/base/Seletor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { MODELOS_DE_ANUNCIO, modeloSugerido, type ModeloDeAnuncioId } from '@/features/landing/modelos/modelosDeAnuncio';
import { Button, Input } from '@/components/ui/ds';
import { CampoDaJanela, ESCOLHA, GrupoDaJanela } from '@/components/base/janela';
import { cn } from '@/lib/utils';

interface Opt {
  id: string;
  label: string;
}

type Base = 'blank' | 'property' | 'template' | 'modelo';

/** O que dizer quando o imóvel escolhido combina mais com outro modelo. */
const FRASE_SUGESTAO: Record<ModeloDeAnuncioId, string> = {
  aluguel: 'Este imóvel é de aluguel. O modelo Aluguel combina mais.',
  lancamento: 'Este imóvel é um empreendimento. O modelo Lançamento combina mais.',
  revenda: 'Este imóvel é de revenda. O modelo Revenda combina mais.',
};

/**
 * Campo de lista do passo 3 (pipeline, coluna, tag). Fora do componente do
 * assistente de propósito: declarado dentro do render, era um componente novo a
 * cada redesenho, o React desmontava e montava de novo e a lista do produto
 * aberta fechava sozinha. Não se chama `Select` para não confundir com o Select
 * do design system.
 */
function CampoDeLista({ id, label, value, onChange, options, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder: string;
}) {
  return (
    <CampoDaJanela rotulo={label} htmlFor={id}>
      <Seletor id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </Seletor>
    </CampoDaJanela>
  );
}

/** Cartão de escolha do passo 1: contorno + roxo claro quando marcado. */
const CARTAO = 'h-auto flex-col items-start justify-start gap-1 whitespace-normal p-3 text-left font-normal';
/** Linha de resultado da busca (imóvel, modelo salvo). */
const LINHA = 'h-auto w-full justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal';

/**
 * Assistente de criação de landing (Fatia 1): monta a landing já reusando o que
 * existe — em branco ou de um imóvel + nome + destino do lead (pipeline/coluna/
 * tag) — cria, aplica o roteamento e abre o editor. As etapas mais pesadas
 * (quiz+qualificação, automação/roleta/lembrete/instância, Pixel/CAPI, páginas
 * de resultado, templates) entram nas próximas fatias.
 */
export default function CreateLandingWizard({
  siteId,
  onClose,
}: {
  siteId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [creating, setCreating] = useState(false);

  // Passo 1 — base
  const [base, setBase] = useState<Base>('blank');
  const [propQuery, setPropQuery] = useState('');
  const [propResults, setPropResults] = useState<Property[]>([]);
  const [propLoading, setPropLoading] = useState(false);
  const [property, setProperty] = useState<Property | null>(null);
  // base = modelo
  const [modeloId, setModeloId] = useState<ModeloDeAnuncioId>('revenda');
  // base = template
  const [templates, setTemplates] = useState<LandingTemplateDTO[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');

  // Passo 2 — nome
  const [name, setName] = useState('');

  // Passo 3 — destino
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [stages, setStages] = useState<Opt[]>([]);
  const [labels, setLabels] = useState<Opt[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [labelId, setLabelId] = useState('');
  const [routingLoading, setRoutingLoading] = useState(false);

  const slug = useMemo(() => slugifyLandingName(name), [name]);

  // Busca de imóveis (debounce simples) quando base = property.
  useEffect(() => {
    if (base !== 'property' && base !== 'modelo') return;
    // Lista fechada até a pessoa digitar: sem texto, nem busca.
    if (!propQuery.trim()) { setPropResults([]); setPropLoading(false); return; }
    let active = true;
    setPropLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await propertiesService.list({ q: propQuery.trim(), per_page: 8 });
        if (active) setPropResults(res.data);
      } finally {
        if (active) setPropLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [base, propQuery]);

  // Carrega os templates ao escolher "De um template" (uma vez).
  useEffect(() => {
    if (base !== 'template' || templates.length || templatesLoading) return;
    let active = true;
    setTemplatesLoading(true);
    (async () => {
      try {
        const list = await landingTemplatesService.list();
        if (active) setTemplates(list);
      } finally {
        if (active) setTemplatesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // templatesLoading NÃO entra nas deps: setá-lo dentro do effect re-dispararia
    // o effect e cancelaria o próprio fetch (active=false), travando "Carregando".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, templates.length]);

  // Carrega pipelines + tags ao entrar no passo 3 (uma vez).
  useEffect(() => {
    if (step !== 3 || pipelines.length) return;
    let active = true;
    setRoutingLoading(true);
    (async () => {
      try {
        // Pelo serviço de etiquetas, nunca pela rota crua: a lista é
        // PAGINADA (20 por página por padrão), e quem tem mais que isso via o
        // seletor de Tag cortado no meio do alfabeto, sem nada dizendo por quê.
        const [pRes, lRes] = await Promise.all([pipelinesService.getPipelines({ include_items: false }), labelsService.getLabels()]);
        if (!active) return;
        const ps = (pRes?.data ?? []) as Array<{ id: string; name: string }>;
        setPipelines(ps.map((p) => ({ id: p.id, label: p.name })));
        setLabels((lRes.data ?? []).map((l) => ({ id: String(l.id), label: l.title })));
      } finally {
        if (active) setRoutingLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [step, pipelines.length]);

  const onPipeline = async (pid: string) => {
    setPipelineId(pid);
    setStageId('');
    setStages([]);
    if (!pid) return;
    const res = await pipelinesService.getPipelineStages(pid);
    const ss = (res?.data ?? []) as Array<{ id: string; name: string }>;
    setStages(ss.map((s) => ({ id: s.id, label: s.name })));
  };

  const pickProperty = (p: Property) => {
    setProperty(p);
    setPropQuery('');
    if (!name.trim()) setName(p.title);
  };

  // Modelos salvos: só aparecem quando a pessoa digita, e poucos de cada vez.
  const modelosSalvos = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return [];
    return templates.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [templates, templateQuery]);
  const modeloSalvo = templates.find((t) => t.id === templateId) ?? null;

  const sugerido = property ? modeloSugerido(property) : null;

  const canNext =
    step === 1
      ? base === 'blank' || ((base === 'property' || base === 'modelo') && !!property) || (base === 'template' && !!templateId)
      : step === 2
        ? !!name.trim()
        : true;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      let lp;
      const modelo = MODELOS_DE_ANUNCIO.find((m) => m.id === modeloId);
      if (base === 'modelo' && property && modelo) {
        // Sempre página nova: um imóvel pode ter mais de uma de anúncio (teste A/B).
        lp = await landingPageService.createForProperty(siteId, {
          propertyId: property.id,
          title: name.trim(),
          brandMode: 'development',
          blocks: modelo.blocos(),
          theme: modelo.tema,
        });
      } else if (base === 'property' && property) {
        lp = await landingPageService.getOrCreateForProperty(siteId, {
          propertyId: property.id,
          title: name.trim(),
          brandMode: 'development',
        });
      } else if (base === 'template' && templateId) {
        // Cria em branco e aplica os blocos + tema do template.
        lp = await landingPageService.createBlank(siteId, name.trim());
        const tpl = templates.find((t) => t.id === templateId);
        if (tpl) {
          await landingPageService.saveBlocks(
            siteId,
            lp.dto.id,
            safeParsePageBlocks(tpl.content_blocks),
            tpl.theme ?? undefined,
          );
        }
      } else {
        lp = await landingPageService.createBlank(siteId, name.trim());
      }

      if (pipelineId || labelId) {
        await landingPageService
          .saveRouting(siteId, lp.dto.id, {
            lead_pipeline_id: pipelineId || null,
            lead_stage_id: stageId || null,
            lead_label_id: labelId || null,
          })
          .catch(() => toast.error('Página criada, mas o destino do lead não foi salvo. Ajuste na lista.'));
      }

      toast.success('Página criada! Abrindo o editor…');
      navigate(`/landings/${lp.dto.id}`);
    } catch {
      toast.error('Erro ao criar a página');
      setCreating(false);
    }
  };

  return (
    // Janela da casa. Nem clique fora nem Esc fecham (como antes: perderiam o que já
    // foi escolhido nos passos); o X e o Cancelar fecham.
    <Dialog open onOpenChange={(aberta) => { if (!aberta) onClose(); }}>
      <DialogContent
        className="flex flex-col gap-0 overflow-hidden p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Criar com assistente</DialogTitle>
          <DialogDescription>Passo {step} de 3</DialogDescription>
        </DialogHeader>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="grid gap-6">
              <GrupoDaJanela titulo="Modelos prontos">
                <div className="grid grid-cols-3 gap-3">
                  {MODELOS_DE_ANUNCIO.map((m) => {
                    const ativo = base === 'modelo' && modeloId === m.id;
                    const cores = [m.tema.bgStart, m.tema.primary, m.tema.accent, m.tema.cardBg];
                    return (
                      <Button
                        key={m.id}
                        type="button"
                        variant="outline"
                        aria-pressed={ativo}
                        onClick={() => { setBase('modelo'); setModeloId(m.id); }}
                        className={cn(CARTAO, ESCOLHA)}
                      >
                        <span className="flex h-2 w-full overflow-hidden rounded-full">
                          {cores.map((c, i) => (
                            <span key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
                          ))}
                        </span>
                        <span className="text-sm font-medium">{m.nome}</span>
                        <span className="text-xs text-muted-foreground">{m.frase}</span>
                      </Button>
                    );
                  })}
                </div>
              </GrupoDaJanela>

              <GrupoDaJanela titulo="Ou comece de">
                <div className="grid grid-cols-3 gap-3">
                  <Button type="button" variant="outline" aria-pressed={base === 'blank'} onClick={() => setBase('blank')} className={cn(CARTAO, ESCOLHA)}>
                    <Megaphone className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Em branco</span>
                    <span className="text-xs text-muted-foreground">Blocos padrão.</span>
                  </Button>
                  <Button type="button" variant="outline" aria-pressed={base === 'property'} onClick={() => setBase('property')} className={cn(CARTAO, ESCOLHA)}>
                    <Building2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">De um imóvel</span>
                    <span className="text-xs text-muted-foreground">Dados do imóvel.</span>
                  </Button>
                  <Button type="button" variant="outline" aria-pressed={base === 'template'} onClick={() => setBase('template')} className={cn(CARTAO, ESCOLHA)}>
                    <LayoutTemplate className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">De um modelo salvo</span>
                    <span className="text-xs text-muted-foreground">Uma página que você guardou.</span>
                  </Button>
                </div>
              </GrupoDaJanela>

              {base === 'template' && (
                <GrupoDaJanela titulo="Modelo salvo">
                  {templatesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando modelos…
                    </div>
                  ) : templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum modelo salvo ainda. Salve uma página pela lista (botão "Salvar como modelo").
                    </p>
                  ) : (
                    <>
                      {modeloSalvo && (
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2"><Check className="h-4 w-4 flex-none text-primary" /><span className="truncate">{modeloSalvo.name}</span></span>
                        </div>
                      )}
                      {!templateQuery.trim() && (
                        <p className="text-xs text-muted-foreground">{templates.length} {templates.length === 1 ? 'modelo salvo' : 'modelos salvos'}. Digite pra buscar.</p>
                      )}
                      <CampoDaJanela rotulo={modeloSalvo ? 'Escolher outro modelo' : 'Buscar modelo'} htmlFor="assistente-busca-modelo">
                        <Input id="assistente-busca-modelo" value={templateQuery} onChange={(e) => setTemplateQuery(e.target.value)}
                          placeholder="Digite o nome do modelo" />
                      </CampoDaJanela>
                      {modelosSalvos.length > 0 && (
                        <div className="grid gap-1.5">
                          {modelosSalvos.map((t) => (
                            <Button key={t.id} type="button" variant="outline" aria-pressed={templateId === t.id}
                              onClick={() => { setTemplateId(t.id); setTemplateQuery(''); }} className={cn(LINHA, ESCOLHA)}>
                              <span className="min-w-0 truncate text-sm">{t.name}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                      {templateQuery.trim() && modelosSalvos.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum modelo com esse nome.</p>
                      )}
                    </>
                  )}
                </GrupoDaJanela>
              )}

              {(base === 'property' || base === 'modelo') && (
                <GrupoDaJanela titulo="Imóvel">
                  {base === 'modelo' && sugerido && sugerido !== modeloId && (
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{FRASE_SUGESTAO[sugerido]}</span>
                      <button
                        type="button"
                        onClick={() => setModeloId(sugerido)}
                        className="font-semibold text-primary hover:underline"
                      >
                        Trocar
                      </button>
                    </p>
                  )}
                  {property && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 flex-none text-primary" />
                      <span className="min-w-0 truncate">{property.title}</span>
                      <span className="flex-none font-mono text-xs text-muted-foreground">{property.code}</span>
                    </div>
                  )}
                  <CampoDaJanela rotulo={property ? 'Escolher outro imóvel' : 'Buscar imóvel'} htmlFor="assistente-busca-imovel">
                    <Input id="assistente-busca-imovel" value={propQuery} onChange={(e) => setPropQuery(e.target.value)}
                      placeholder="Buscar imóvel por título ou código" />
                  </CampoDaJanela>
                  {propQuery.trim() && (
                    <div className="grid gap-1.5">
                      {propLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                        </div>
                      ) : propResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
                      ) : (
                        propResults.map((p) => (
                          <Button
                            key={p.id}
                            type="button"
                            variant="outline"
                            aria-pressed={property?.id === p.id}
                            onClick={() => pickProperty(p)}
                            className={cn(LINHA, ESCOLHA)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{p.title}</span>
                              <span className="block truncate font-mono text-xs text-muted-foreground">
                                {p.code}{p.address_city ? ` · ${p.address_city}` : ''}{p.display_price ? ` · ${p.display_price}` : ''}
                              </span>
                            </span>
                          </Button>
                        ))
                      )}
                    </div>
                  )}
                </GrupoDaJanela>
              )}
            </div>
          )}

          {step === 2 && (
            <GrupoDaJanela titulo="Nome da página">
              <CampoDaJanela rotulo="Nome da página" htmlFor="assistente-nome" obrigatorio
                ajuda={<>O endereço da página vai terminar em <span className="font-mono">/{slug || '...'}</span>. Você confirma o nome final ao publicar.</>}>
                <Input
                  id="assistente-nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Campanha Lançamento Setembro"
                />
              </CampoDaJanela>
            </GrupoDaJanela>
          )}

          {step === 3 && (
            <GrupoDaJanela titulo="Para onde vai o lead">
              <p className="text-xs text-muted-foreground">Opcional. Dá pra ajustar depois.</p>
              {routingLoading ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : (
                <>
                  <CampoDeLista id="assistente-funil" label="Funil" value={pipelineId} onChange={onPipeline} options={pipelines} placeholder="Sem funil (só vira contato)" />
                  {pipelineId && (
                    <CampoDeLista id="assistente-etapa" label="Etapa" value={stageId} onChange={setStageId} options={stages} placeholder="Escolha a etapa" />
                  )}
                  <CampoDeLista id="assistente-etiqueta" label="Etiqueta" value={labelId} onChange={setLabelId} options={labels} placeholder="Sem etiqueta" />
                </>
              )}
            </GrupoDaJanela>
          )}
        </div>

        {/* footer */}
        <DialogFooter className="sm:items-center sm:justify-between">
          <Button
            variant="outline"
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as 1 | 2 | 3))}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            >
              Próximo
            </Button>
          ) : (
            <Button
              type="button"
              disabled={creating || !name.trim()}
              onClick={handleCreate}
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar página
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
