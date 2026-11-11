// A janela da página (Task 9, 10/11/2026): esquerda = configuração (como a janela de Campanhas), direita = a ligação com a página de fora.
// ⚠️ "Quem assume": sempre mandamos os DOIS campos (um deles null); o servidor valida o estado final. Nada escolhido = Ninguém.
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label as UILabel,
} from '@/components/ui/ds';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import Aviso from '@/components/base/Aviso';
import Chave from '@/components/base/Chave';
import EtiquetasDeEscolha from '@/components/base/EtiquetasDeEscolha';
import { Seletor } from '@/components/base/Seletor';
import CampoQuemAssume, { escolhaDe, type QuemAssume } from '@/components/roleta/CampoQuemAssume';
import { SeletorDeImoveis } from '@/components/properties/SeletorDeImoveis';
import { useAuthStore } from '@/store/authStore';
import { useCan } from '@/hooks/useCan';
import type { RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { externalLeadPagesService, type PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';
import LigacaoComAPagina, { mensagemDoErro, campoDoErro } from './LigacaoComAPagina';

export interface RecursosDaJanela {
  funis: { id: string; name: string }[];
  etapas: Record<string, { id: string; name: string }[]>;
  /** null = lista recusada/falhou. */
  equipe: { id: string; name: string; whatsapp?: string | null }[] | null;
  roletas: RoletaConfig[] | null;
}

const campo = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm';
const FIXA = 'site';

// Campo do servidor (details.field) -> id do campo na tela.
const CAMPO_NA_TELA: Record<string, string> = {
  pipeline_id: 'destino_funil', stage_id: 'destino_etapa', roleta_config_id: 'quem_assume', default_assignee_id: 'quem_assume', name: 'nome_da_pagina',
};

/** Etiqueta curta que nasce com a página nova: o nome em minúsculas, até 30 letras. */
export const etiquetaCurtaDe = (nome: string): string => nome.trim().toLowerCase().slice(0, 30).trim();

const FRASE_QUEM_ASSUME = {
  roleta: 'O lead é oferecido a um corretor da fila assim que chega. Ele recebe o aviso no WhatsApp e vira o responsável quando aceita. Lead que já tem responsável não volta pro sorteio.',
  corretor: 'Todo lead desta página entra com este corretor como responsável. Ele recebe o aviso no WhatsApp na hora.',
  ninguem: 'O lead entra no funil sem responsável, pra gestão distribuir na mão.',
};

export default function JanelaDaPagina({ pagina, recursos, aoFechar, aoMudou }: {
  pagina: PaginaDeSite | null;
  recursos: RecursosDaJanela;
  aoFechar: () => void;
  /** Criou, salvou, apagou ou trocou: a lista recarrega. */
  aoMudou: () => void;
}) {
  const can = useCan();
  const podeEditar = can('portals', 'update');
  const usuario = useAuthStore((s) => s.currentUser) as { id?: string; whatsapp_number?: string | null } | null;
  const [atual, setAtual] = useState<PaginaDeSite | null>(pagina);
  const [nome, setNome] = useState(pagina?.name ?? '');
  const [funil, setFunil] = useState(pagina?.pipeline_id ?? '');
  const [etapa, setEtapa] = useState(pagina?.stage_id ?? '');
  const [quem, setQuem] = useState<QuemAssume>({ default_assignee_id: pagina?.default_assignee_id ?? null, roleta_config_id: pagina?.roleta_config_id ?? null });
  const [imovel, setImovel] = useState<string[]>(pagina?.property_id ? [pagina.property_id] : []);
  const [etiquetas, setEtiquetas] = useState<string[]>((pagina?.labels ?? []).filter((l) => l !== FIXA));
  // Página nova com as etiquetas intocadas: a segunda etiqueta acompanha o nome (editável e removível).
  const [etiquetasMexidas, setEtiquetasMexidas] = useState(false);
  const etiquetasVistas = !atual && !etiquetasMexidas ? [etiquetaCurtaDe(nome)].filter(Boolean) : etiquetas;
  const [ativaAoCriar, setAtivaAoCriar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [campoDoErroNoServidor, setCampoDoErro] = useState<string | null>(null);
  const avisoDoErro = useRef<HTMLDivElement>(null);
  const [apagando, setApagando] = useState(false);

  const telefone = recursos.equipe?.find((u) => String(u.id) === String(usuario?.id))?.whatsapp || usuario?.whatsapp_number || '';

  const foco = (id: string) => { document.getElementById(id)?.focus(); };

  // Erro novo: traz o aviso pra vista (o miolo rola no celular) e leva o foco ao campo que o servidor apontou.
  // Roda depois do render com `salvando` falso: campo dentro de fieldset desabilitado não recebe foco.
  useEffect(() => {
    if (!erro || salvando) return;
    avisoDoErro.current?.scrollIntoView?.({ block: 'nearest' });
    const alvo = campoDoErroNoServidor ? CAMPO_NA_TELA[campoDoErroNoServidor] : null;
    if (alvo) foco(alvo);
  }, [erro, campoDoErroNoServidor, salvando]);

  // Mudou algo que ainda não foi salvo? O lead de teste usa o que está salvo.
  const naoSalvo = useMemo(() => {
    if (!atual) return false;
    const guardadas = (atual.labels ?? []).filter((l) => l !== FIXA);
    return nome.trim() !== atual.name || funil !== (atual.pipeline_id ?? '') || etapa !== (atual.stage_id ?? '')
      || (quem.roleta_config_id ?? null) !== (atual.roleta_config_id ?? null) || (quem.default_assignee_id ?? null) !== (atual.default_assignee_id ?? null)
      || (imovel[0] ?? null) !== (atual.property_id ?? null) || guardadas.join('\u0000') !== etiquetas.join('\u0000');
  }, [atual, nome, funil, etapa, quem, imovel, etiquetas]);

  const salvar = async () => {
    setErro(null); setCampoDoErro(null);
    if (!podeEditar) return;
    if (!nome.trim()) { setErro('Dê um nome para a página.'); foco('nome_da_pagina'); return; }
    if (!funil) { setErro('Escolha o funil.'); foco('destino_funil'); return; }
    if (!etapa) { setErro('Escolha a etapa.'); foco('destino_etapa'); return; }
    const corpo = {
      name: nome.trim(),
      pipeline_id: funil,
      stage_id: etapa,
      roleta_config_id: quem.roleta_config_id,
      default_assignee_id: quem.default_assignee_id,
      property_id: imovel[0] ?? null,
      labels: [FIXA, ...etiquetasVistas],
    };
    setSalvando(true);
    try {
      if (atual) {
        const nova = await externalLeadPagesService.salvar(atual.id, corpo);
        setAtual(nova ?? atual);
        toast.success('Página salva.');
      } else {
        const nova = await externalLeadPagesService.criar({ ...corpo, active: ativaAoCriar });
        setAtual(nova);
        setEtiquetas(etiquetasVistas); setEtiquetasMexidas(true);
        toast.success('Página criada. Agora cole o endereço na página.');
      }
      aoMudou();
    } catch (e) {
      setCampoDoErro(campoDoErro(e));
      setErro(mensagemDoErro(e, 'Não deu pra salvar. Tente de novo.'));
    } finally { setSalvando(false); }
  };

  const apagar = async () => {
    if (!atual || !podeEditar) return;
    setSalvando(true);
    try {
      await externalLeadPagesService.apagar(atual.id);
      toast.success('Página excluída.');
      aoMudou();
      aoFechar();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não deu pra excluir. Tente de novo.'));
      setApagando(false);
    } finally { setSalvando(false); }
  };

  const ligar = async (proximo: boolean) => {
    if (!atual || !podeEditar) return false;
    const nova = await externalLeadPagesService.salvar(atual.id, { active: proximo });
    setAtual({ ...atual, active: nova?.active ?? proximo });
    aoMudou();
  };

  const trocouEndereco = (url: string) => {
    setAtual((a) => (a ? { ...a, endpoint_url: url } : a));
    aoMudou();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent size="wide" className="flex flex-col overflow-hidden max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle>{atual ? atual.name : 'Nova página'}</DialogTitle>
            {atual && <Chave rotulo="Página ativa" genero="a" ligada={atual.active} aoMudar={ligar} desabilitada={!podeEditar} />}
          </div>
          <DialogDescription>Quem preencher o formulário da página entra no funil e com o corretor que você escolher.</DialogDescription>
        </DialogHeader>

        <div data-testid="miolo-da-janela" className="relative -mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1">
          {erro && <div ref={avisoDoErro}><Aviso tom="erro" compacto className="mb-2">{erro}</Aviso></div>}
          {!podeEditar && <Aviso tom="neutro" compacto className="mb-2">Você pode ver esta página, mas não mudar. Quem edita é o gerente ou o administrador.</Aviso>}
          <div className="grid min-w-0 grid-cols-1 gap-6 py-2 lg:grid-cols-[7fr_5fr]">
            <section aria-label="Configuração da página" className="grid min-w-0 content-start gap-5">
              <fieldset disabled={salvando || !podeEditar} className="m-0 grid min-w-0 content-start gap-5 border-0 p-0">
                <GrupoDaJanela titulo="Página">
                  <CampoDaJanela rotulo="Nome da página" htmlFor="nome_da_pagina" obrigatorio
                    ajuda="Vira a origem do lead no card e no Painel.">
                    <Input id="nome_da_pagina" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: LP Centro, formulário do site" />
                  </CampoDaJanela>
                </GrupoDaJanela>

                <GrupoDaJanela titulo="Para onde vai">
                  <GradeDaJanela>
                    <CampoDaJanela rotulo="Funil" htmlFor="destino_funil" obrigatorio colunas={funil ? 2 : 4}>
                      <Seletor id="destino_funil" value={funil} className={campo}
                        onChange={(e) => { setFunil(e.target.value); setEtapa(''); }}>
                        <option value="">Escolha um funil</option>
                        {recursos.funis.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Seletor>
                    </CampoDaJanela>
                    {funil && (
                      <CampoDaJanela rotulo="Etapa" htmlFor="destino_etapa" obrigatorio colunas={2}>
                        <Seletor id="destino_etapa" value={etapa} className={campo} onChange={(e) => setEtapa(e.target.value)}>
                          <option value="">Escolha uma etapa</option>
                          {(recursos.etapas[funil] ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Seletor>
                      </CampoDaJanela>
                    )}
                  </GradeDaJanela>
                </GrupoDaJanela>

                <GrupoDaJanela titulo="Quem assume">
                  <CampoDaJanela rotulo="Quem assume o lead" htmlFor="quem_assume"
                    ajuda="O corretor recebe todo lead desta página. A roleta oferece cada lead ao próximo da fila. Sem escolha, o lead entra sem responsável.">
                    <CampoQuemAssume id="quem_assume" aria-label="Quem assume o lead" value={quem} onChange={setQuem}
                      pessoas={recursos.equipe ? recursos.equipe.map((u) => ({ id: u.id, nome: u.name })) : null}
                      roletas={recursos.roletas} />
                  </CampoDaJanela>
                  <p className="text-xs text-muted-foreground">
                    {escolhaDe(quem)?.aba === 'roleta' ? FRASE_QUEM_ASSUME.roleta : escolhaDe(quem)?.aba === 'corretor' ? FRASE_QUEM_ASSUME.corretor : FRASE_QUEM_ASSUME.ninguem}
                  </p>
                </GrupoDaJanela>

                <GrupoDaJanela titulo="O que esta página vende">
                  <CampoDaJanela rotulo="Imóvel (opcional)" htmlFor="imovel_da_pagina"
                    ajuda="Liga o interesse no imóvel ao lead. Se o imóvel manda o lead direto pro responsável, ele vale.">
                    <SeletorDeImoveis id="imovel_da_pagina" selecionados={imovel} max={1} sugestaoQ={null} aoMudar={setImovel} />
                  </CampoDaJanela>
                </GrupoDaJanela>

                <GrupoDaJanela titulo="Etiquetas">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 items-center rounded-full border border-border bg-muted/40 px-2.5 text-xs font-medium">{FIXA}</span>
                    <span className="text-xs text-muted-foreground">sempre vai com o lead</span>
                  </div>
                  <EtiquetasDeEscolha rotulo="Etiquetas da página" semNome opcoes={[]} escolhidas={[]} aoMudar={() => {}}
                    proprias={etiquetasVistas}
                    aoTirarPropria={(t) => { setEtiquetasMexidas(true); setEtiquetas(etiquetasVistas.filter((x) => x !== t)); }}
                    adicionar={{ rotulo: 'Nova etiqueta', placeholder: '+ Etiqueta', maxLength: 60, aoAdicionar: (t) => { setEtiquetasMexidas(true); setEtiquetas(etiquetasVistas.includes(t) || t === FIXA ? etiquetasVistas : [...etiquetasVistas, t]); } }} />
                </GrupoDaJanela>

                {!atual && (
                  <GrupoDaJanela titulo="Estado">
                    <div className="flex items-center gap-2">
                      <Checkbox id="ativa_ao_criar" checked={ativaAoCriar} onCheckedChange={(v) => setAtivaAoCriar(v === true)} />
                      <UILabel htmlFor="ativa_ao_criar" className="cursor-pointer">Ativa</UILabel>
                    </div>
                  </GrupoDaJanela>
                )}
              </fieldset>
            </section>

            <section aria-label="Ligação com a página" data-testid="coluna-direita" className="grid min-w-0 content-start gap-5">
              {atual ? (
                <LigacaoComAPagina key={atual.id} pagina={atual} telefoneInicial={telefone} podeEditar={podeEditar} naoSalvo={naoSalvo} aoTrocouEndereco={trocouEndereco} />
              ) : (
                <Aviso tom="neutro" compacto>Depois de criar, o endereço pra colar na página aparece aqui, com os últimos envios e o lead de teste.</Aviso>
              )}
            </section>
          </div>
        </div>

        {apagando && podeEditar && (
          <Aviso tom="atencao" compacto acao={
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="destructive" onClick={() => void apagar()} disabled={salvando}>Excluir mesmo</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setApagando(false)} disabled={salvando}>Voltar</Button>
            </div>
          }>O endereço para de receber lead na hora. Os leads que já entraram ficam.</Aviso>
        )}

        <DialogFooter>
          {atual && !apagando && podeEditar && (
            <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={() => setApagando(true)}>Excluir página</Button>
          )}
          <Button variant="outline" onClick={aoFechar}>{atual ? 'Fechar' : 'Cancelar'}</Button>
          {podeEditar && <Button onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando...' : atual ? 'Salvar' : 'Criar'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
