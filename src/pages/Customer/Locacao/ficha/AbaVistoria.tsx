import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Checkbox, Input } from '@/components/ui/ds';
import BarraSalvar from '@/components/base/BarraSalvar';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data, dinheiro, hojeEmSaoPaulo, lerDinheiro } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { ESTADOS_DE_VISTORIA, NOTA_DO_ESTADO } from '@/features/locacao/textos';
import type { Chaves, ChavesRegistro, ComodoDeVistoria, Contrato, ItemDaSaida, Vistoria } from '@/features/locacao/tipos';
import { Selo, Titulo } from '../comum';

const CHAVES_VAZIAS: Chaves = { entrega: { assinado: false }, devolucao: { assinado: false } };
const VISTORIA_VAZIA: Vistoria = { entrada: { concluida: false, comodos: [] }, saida: { concluida: false, itens: {} } };

/** Foto do celular vira miniatura de até 1000 px (JPEG), pra caber no cadastro sem pesar. */
function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('leitura'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('imagem'));
      img.onload = () => {
        const escala = Math.min(1, 1000 / Math.max(img.width, img.height));
        const tela = document.createElement('canvas');
        tela.width = Math.round(img.width * escala);
        tela.height = Math.round(img.height * escala);
        tela.getContext('2d')?.drawImage(img, 0, 0, tela.width, tela.height);
        resolve(tela.toDataURL('image/jpeg', 0.7));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}

function FormularioDeChaves({ titulo, valor, aoMudar, dataPadrao }: { titulo: string; valor: ChavesRegistro; aoMudar: (v: ChavesRegistro) => void; dataPadrao: string }) {
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
  const id = titulo.replace(/\W+/g, '-');
  return (
    <section className="grid gap-3">
      <Titulo>{titulo}</Titulo>
      <Card className="gap-4 p-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={valor.assinado} onCheckedChange={v => aoMudar({ ...valor, assinado: v === true, data: v === true ? valor.data ?? dataPadrao : valor.data })} />
          Termo assinado
        </label>
        <GradeDaJanela>
          <CampoDaJanela rotulo="Data" htmlFor={`${id}-data`}>
            <Input id={`${id}-data`} type="date" value={valor.data ?? ''} onChange={e => aoMudar({ ...valor, data: e.target.value || null })} />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Jogos de chave" htmlFor={`${id}-jogos`}>
            <Input id={`${id}-jogos`} inputMode="numeric" value={valor.jogos ?? ''} onChange={e => aoMudar({ ...valor, jogos: num(e.target.value) })} />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Chaves por jogo" htmlFor={`${id}-porjogo`}>
            <Input id={`${id}-porjogo`} inputMode="numeric" value={valor.porJogo ?? ''} onChange={e => aoMudar({ ...valor, porJogo: num(e.target.value) })} />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Controles e cartões" htmlFor={`${id}-controles`} ajuda="Portão, garagem, acesso.">
            <Input id={`${id}-controles`} inputMode="numeric" value={valor.controles ?? ''} onChange={e => aoMudar({ ...valor, controles: num(e.target.value) })} />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Quem recebeu" htmlFor={`${id}-recebeu`} colunas={2}>
            <Input id={`${id}-recebeu`} value={valor.recebeu ?? ''} onChange={e => aoMudar({ ...valor, recebeu: e.target.value })} />
          </CampoDaJanela>
          <CampoDaJanela rotulo="Observações" htmlFor={`${id}-obs`} colunas={2}>
            <Input id={`${id}-obs`} value={valor.obs ?? ''} onChange={e => aoMudar({ ...valor, obs: e.target.value })} />
          </CampoDaJanela>
        </GradeDaJanela>
      </Card>
    </section>
  );
}

export default function AbaVistoria({ contrato: c, aoMudar }: { contrato: Contrato; aoMudar: (c: Contrato) => void }) {
  const hoje = hojeEmSaoPaulo();
  const origemChaves = useMemo(() => ({ ...CHAVES_VAZIAS, ...(c.chaves ?? {}) }), [c.chaves]);
  const origemVistoria = useMemo<Vistoria>(() => ({
    entrada: { ...VISTORIA_VAZIA.entrada, ...(c.vistoria?.entrada ?? {}) },
    saida: { ...VISTORIA_VAZIA.saida, ...(c.vistoria?.saida ?? {}) },
  }), [c.vistoria]);
  const [chaves, setChaves] = useState<Chaves>(origemChaves);
  const [vistoria, setVistoria] = useState<Vistoria>(origemVistoria);
  const [salvando, setSalvando] = useState(false);
  const [fotoDe, setFotoDe] = useState<{ ci: number; ii: number } | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => { setChaves(origemChaves); setVistoria(origemVistoria); }, [origemChaves, origemVistoria]);

  const mexeuChaves = JSON.stringify(chaves) !== JSON.stringify(origemChaves);
  const mexeuVistoria = JSON.stringify(vistoria) !== JSON.stringify(origemVistoria);

  const salvar = async () => {
    setSalvando(true);
    try {
      let atual = c;
      if (mexeuChaves) atual = await locacaoService.salvarChaves(c.id, chaves);
      if (mexeuVistoria) atual = await locacaoService.salvarVistoria(c.id, vistoria);
      aoMudar(atual);
      toast.success('Salvo.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra salvar.'));
    } finally {
      setSalvando(false);
    }
  };

  const mudarComodo = (ci: number, p: Partial<ComodoDeVistoria>) =>
    setVistoria(v => ({ ...v, entrada: { ...v.entrada, comodos: v.entrada.comodos.map((x, i) => (i === ci ? { ...x, ...p } : x)) } }));
  const mudarItem = (ci: number, ii: number, p: Partial<ComodoDeVistoria['itens'][number]>) =>
    mudarComodo(ci, { itens: vistoria.entrada.comodos[ci].itens.map((x, i) => (i === ii ? { ...x, ...p } : x)) });

  const aoEscolherFoto = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f || !fotoDe) return;
    try {
      const url = await reduzirFoto(f);
      const item = vistoria.entrada.comodos[fotoDe.ci].itens[fotoDe.ii];
      mudarItem(fotoDe.ci, fotoDe.ii, { fotos: [...(item.fotos ?? []), url] });
    } catch {
      toast.error('Não deu pra ler a foto. Tente outra.');
    }
  };

  const mudarSaida = (chave: string, p: Partial<ItemDaSaida>) =>
    setVistoria(v => ({ ...v, saida: { ...v.saida, itens: { ...v.saida.itens, [chave]: { ...(v.saida.itens[chave] ?? {}), ...p } } } }));

  const totalDanos = Object.values(vistoria.saida.itens).filter(i => i.decisao === 'dano').reduce((s, i) => s + (i.custo ?? 0), 0);
  const entrada = vistoria.entrada;
  const saida = vistoria.saida;

  return (
    <div className="grid gap-6">
      <FormularioDeChaves titulo="1. Entrega das chaves" valor={chaves.entrega} dataPadrao={hoje} aoMudar={v => setChaves(x => ({ ...x, entrega: v }))} />

      <section className="grid gap-3">
        <Titulo
          acao={(
            <div className="flex items-center gap-2">
              {entrada.concluida && <Selo sev="ok">Concluída{entrada.data ? ` em ${data(entrada.data)}` : ''}</Selo>}
              <Button size="sm" variant="outline" onClick={() => setVistoria(v => ({ ...v, entrada: { ...v.entrada, comodos: [...v.entrada.comodos, { nome: '', itens: [{ nome: '' }] }] } }))}>
                <Plus className="mr-1 h-4 w-4" />Adicionar cômodo
              </Button>
            </div>
          )}
        >
          2. Vistoria de entrada
        </Titulo>

        {entrada.comodos.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">Ainda sem cômodos. Adicione sala, quartos, cozinha e o que mais tiver no imóvel, e marque o estado de cada item.</Card>
        )}

        {entrada.comodos.map((cm, ci) => (
          <Card key={ci} className="gap-3 p-4">
            <div className="flex items-center gap-2">
              <Input aria-label="Nome do cômodo" placeholder="Ex.: Sala" value={cm.nome} onChange={e => mudarComodo(ci, { nome: e.target.value })} />
              <Button variant="ghost" size="icon" aria-label="Tirar este cômodo" onClick={() => setVistoria(v => ({ ...v, entrada: { ...v.entrada, comodos: v.entrada.comodos.filter((_, i) => i !== ci) } }))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {cm.itens.map((it, ii) => (
              <div key={ii} className="grid grid-cols-[1fr_9rem_auto] items-start gap-2 max-sm:grid-cols-1">
                <div className="grid gap-1.5">
                  <Input aria-label="Item" placeholder="Ex.: Piso, parede, porta" value={it.nome} onChange={e => mudarItem(ci, ii, { nome: e.target.value })} />
                  <Input aria-label="Observação" placeholder="Observação (riscos, manchas, defeitos)" value={it.obs ?? ''} onChange={e => mudarItem(ci, ii, { obs: e.target.value })} />
                  {(it.fotos?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {it.fotos?.map((f, fi) => (
                        <button key={fi} type="button" aria-label="Tirar esta foto" className="h-14 w-14 overflow-hidden rounded-md border border-border" onClick={() => mudarItem(ci, ii, { fotos: it.fotos?.filter((_, k) => k !== fi) })}>
                          <img src={f} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Seletor aria-label="Estado" value={it.estado ?? ''} onChange={e => mudarItem(ci, ii, { estado: e.target.value || null })}>
                  <option value="">Estado</option>
                  {ESTADOS_DE_VISTORIA.map(s => <option key={s} value={s}>{s}</option>)}
                </Seletor>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="Anexar foto" onClick={() => { setFotoDe({ ci, ii }); arquivo.current?.click(); }}><Camera className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Tirar este item" disabled={cm.itens.length === 1} onClick={() => mudarComodo(ci, { itens: cm.itens.filter((_, k) => k !== ii) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            <div>
              <Button variant="outline" size="sm" onClick={() => mudarComodo(ci, { itens: [...cm.itens, { nome: '' }] })}><Plus className="mr-1 h-4 w-4" />Adicionar item</Button>
            </div>
          </Card>
        ))}
        <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={ev => void aoEscolherFoto(ev)} />

        {entrada.comodos.length > 0 && (
          <Card className="gap-4 p-4">
            <GradeDaJanela>
              <CampoDaJanela rotulo="Feita por" htmlFor="vist-ent-por" colunas={2}>
                <Input id="vist-ent-por" value={entrada.feita_por ?? ''} onChange={e => setVistoria(v => ({ ...v, entrada: { ...v.entrada, feita_por: e.target.value } }))} />
              </CampoDaJanela>
              <CampoDaJanela rotulo="Data" htmlFor="vist-ent-data" colunas={1}>
                <Input id="vist-ent-data" type="date" value={entrada.data ?? ''} onChange={e => setVistoria(v => ({ ...v, entrada: { ...v.entrada, data: e.target.value || null } }))} />
              </CampoDaJanela>
            </GradeDaJanela>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={entrada.concluida} onCheckedChange={v => setVistoria(x => ({ ...x, entrada: { ...x.entrada, concluida: v === true, data: v === true ? x.entrada.data ?? hoje : x.entrada.data } }))} />
              Laudo concluído. A vistoria de saída vai ser comparada com ele.
            </label>
          </Card>
        )}
      </section>

      <FormularioDeChaves titulo="3. Devolução das chaves" valor={chaves.devolucao} dataPadrao={hoje} aoMudar={v => setChaves(x => ({ ...x, devolucao: v }))} />

      <section className="grid gap-3">
        <Titulo acao={saida.concluida ? <Selo sev="ok">Concluída{saida.data ? ` em ${data(saida.data)}` : ''}</Selo> : undefined}>4. Vistoria de saída</Titulo>
        {!entrada.concluida || entrada.comodos.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Conclua a vistoria de entrada primeiro: a saída é comparada item por item com ela.</Card>
        ) : (
          <>
            {entrada.comodos.map(cm => (
              <Card key={cm.nome} className="gap-3 p-4">
                <h3 className="text-sm font-semibold">{cm.nome}</h3>
                {cm.itens.filter(it => it.nome).map(it => {
                  const chave = `${cm.nome}|${it.nome}`;
                  const s = saida.itens[chave] ?? {};
                  const piorou = !!s.estado && !!it.estado && (NOTA_DO_ESTADO[s.estado] ?? 0) < (NOTA_DO_ESTADO[it.estado] ?? 0);
                  return (
                    <div key={chave} className="grid grid-cols-[1fr_8rem_8rem_7rem] items-start gap-2 max-md:grid-cols-1">
                      <div className="grid gap-1">
                        <span className="text-sm font-medium">{it.nome}</span>
                        <span className="text-xs text-muted-foreground">Na entrada: {it.estado ?? 'sem estado'}{it.obs ? ` · ${it.obs}` : ''}</span>
                        <Input aria-label="Observação da saída" placeholder="Observação da saída" value={s.obs ?? ''} onChange={e => mudarSaida(chave, { obs: e.target.value })} />
                      </div>
                      <Seletor aria-label="Estado na saída" value={s.estado ?? ''} onChange={e => mudarSaida(chave, { estado: e.target.value || null })}>
                        <option value="">Estado na saída</option>
                        {ESTADOS_DE_VISTORIA.map(x => <option key={x} value={x}>{x}</option>)}
                      </Seletor>
                      {piorou ? (
                        <Seletor aria-label="Desgaste ou dano" value={s.decisao ?? ''} onChange={e => mudarSaida(chave, { decisao: (e.target.value || null) as ItemDaSaida['decisao'] })}>
                          <option value="">Desgaste ou dano?</option>
                          <option value="desgaste">Desgaste normal</option>
                          <option value="dano">Dano do inquilino</option>
                        </Seletor>
                      ) : <span />}
                      {piorou && s.decisao === 'dano' ? (
                        <Input aria-label="Custo do reparo" inputMode="decimal" placeholder="R$ reparo" value={s.custo ? String(s.custo).replace('.', ',') : ''} onChange={e => mudarSaida(chave, { custo: lerDinheiro(e.target.value) ?? 0 })} />
                      ) : <span />}
                    </div>
                  );
                })}
              </Card>
            ))}
            <Card className="gap-4 p-4">
              <p className="text-sm text-muted-foreground">Danos do inquilino: <span className="font-medium text-foreground">{dinheiro(totalDanos)}</span>. Esse valor entra no acerto de encerramento.</p>
              <GradeDaJanela>
                <CampoDaJanela rotulo="Feita por" htmlFor="vist-sai-por" colunas={2}>
                  <Input id="vist-sai-por" value={saida.feita_por ?? ''} onChange={e => setVistoria(v => ({ ...v, saida: { ...v.saida, feita_por: e.target.value } }))} />
                </CampoDaJanela>
                <CampoDaJanela rotulo="Data" htmlFor="vist-sai-data" colunas={1}>
                  <Input id="vist-sai-data" type="date" value={saida.data ?? ''} onChange={e => setVistoria(v => ({ ...v, saida: { ...v.saida, data: e.target.value || null } }))} />
                </CampoDaJanela>
              </GradeDaJanela>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={saida.concluida} onCheckedChange={v => setVistoria(x => ({ ...x, saida: { ...x.saida, concluida: v === true, data: v === true ? x.saida.data ?? hoje : x.saida.data } }))} />
                Vistoria de saída concluída
              </label>
            </Card>
          </>
        )}
      </section>

      <BarraSalvar visivel={mexeuChaves || mexeuVistoria} salvando={salvando} aoSalvar={() => void salvar()} aoDescartar={() => { setChaves(origemChaves); setVistoria(origemVistoria); }} />
    </div>
  );
}
