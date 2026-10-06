// src/pages/SuperAdmin/PooledClients/Cliente/AbaContrato.tsx
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, RadioGroup, RadioGroupItem } from '@/components/ui/ds';
import { clientesService } from '@/services/superAdmin/clientesService';
import { pacotesService } from '@/services/superAdmin/pacotesService';
import { dinheiro, numero, plural } from '@/lib/formato';
import type { PacoteDaLista } from '@/types/admin/pacotes';
import type { ClientePooled } from '@/types/admin/clientes';
import { resumoDeMudancas, type DiffDoCliente } from '../Pacotes/resumoDeMudancas';
import { groupJidsFrom, groupsPatch } from '../clientGroups';
import { validarLimites } from '../limites';
import { GRADE_CAMPOS, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';
import { lerReais } from '../receita';
import type { PropsDaAba } from './Pagina';

// Contrato do cliente. Pacote (trocar / voltar ao pacote, com prévia), Receita (tipo e valor que conta, para a margem
// de Custos) e os três limites (números de WhatsApp, franquia de
// leads da IA, preço do excedente). O PATCH reenvia os grupos de WhatsApp: o
// servidor faz compact! nessas chaves e uma omissão apagaria os grupos.

export default function AbaContrato({ cliente, aoMudar, recarregar }: PropsDaAba) {
  // `key` pelos limites: se o cliente mudar por fora (ex.: troca de pacote), os campos recomeçam dele.
  const chave = `${cliente.max_whatsapp_channels}|${cliente.ai_leads_included}|${cliente.ai_lead_overage_price_brl}`;
  const s = cliente.settings ?? {};
  const chaveDaReceita = `${s.client_kind ?? ''}|${s.revenue_source ?? ''}|${s.revenue_brl ?? ''}`;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <BlocoDoPacote cliente={cliente} aoMudar={aoMudar} />
        <BlocoDeReceita key={chaveDaReceita} cliente={cliente} aoMudar={aoMudar} />
      </div>
      <FormularioDeLimites key={chave} cliente={cliente} aoMudar={aoMudar} recarregar={recarregar} />
    </div>
  );
}

const TIPOS = [{ valor: 'avulso', rotulo: 'Avulso' }, { valor: 'performance', rotulo: 'Performance' }];

// Receita do cliente (06/10/2026): quanto ele vale por mês, para a margem de Custos.
// "Cota do plano" é o preço do pacote lido na hora (trocar de pacote leva a cota junto);
// sem pacote com preço, a opção fica desabilitada com o motivo. Voltar à cota não
// apaga o valor digitado: o servidor guarda, aqui ele só não é reenviado.
// Zero digitado é receita zero; vazio é "sem receita" (null).
function BlocoDeReceita({ cliente, aoMudar }: Pick<PropsDaAba, 'cliente' | 'aoMudar'>) {
  const s = cliente.settings ?? {};
  const preco = cliente.package?.price_brl ?? null;
  const [tipo, setTipo] = useState<string>(s.client_kind ?? '');
  const [fonte, setFonte] = useState<string>(s.revenue_source ?? '');
  const [valor, setValor] = useState<string>(s.revenue_brl == null ? '' : numero(s.revenue_brl, 2));
  const [salvando, setSalvando] = useState(false);

  const lido = lerReais(valor);
  const erroDoValor = fonte === 'manual' && lido === undefined ? 'Digite um valor, como 1.500,00 (vazio = sem receita).' : null;
  const semCota = preco == null;
  const motivoSemCota = cliente.package ? `O pacote ${cliente.package.name} não tem preço do plano.` : 'O cliente não tem pacote.';

  const salvar = async () => {
    if (erroDoValor) return;
    setSalvando(true);
    try {
      const atualizado = await clientesService.atualizar(cliente.id, {
        name: cliente.name,
        ...groupsPatch(groupJidsFrom(cliente.settings ?? {})),
        client_kind: tipo || null,
        revenue_source: fonte || null,
        ...(fonte === 'manual' ? { revenue_brl: lido ?? null } : {}),
      });
      aoMudar({ ...cliente, ...atualizado });
      toast.success('Receita salva.');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra salvar.');
    } finally { setSalvando(false); }
  };

  return (
    <section aria-labelledby="receita" className={SECAO}>
      <h2 id="receita" className={TITULO_SECAO}>Receita</h2>
      <p className={SUBTITULO_SECAO}>Quanto o cliente vale por mês. Entra na margem de Custos.</p>
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <Label htmlFor="rec-tipo">Tipo</Label>
          <Seletor id="rec-tipo" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 w-full">
            <option value="">Não definido</option>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </Seletor>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Valor que conta</legend>
          <RadioGroup value={fonte} onValueChange={setFonte} className="mt-2 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <RadioGroupItem id="rec-cota" value="package" disabled={semCota} aria-describedby={semCota ? 'rec-cota-motivo' : undefined} />
              <div>
                <Label htmlFor="rec-cota" className={semCota ? 'text-muted-foreground' : undefined}>
                  {semCota ? 'Cota do plano' : `Cota do plano: ${cliente.package!.name} — ${dinheiro(preco)}/mês`}
                </Label>
                {semCota && <p id="rec-cota-motivo" className="text-xs text-muted-foreground">{motivoSemCota}</p>}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem id="rec-manual" value="manual" />
              <Label htmlFor="rec-manual">Valor digitado</Label>
            </div>
          </RadioGroup>
          {fonte === 'manual' && (
            <div className="mt-3">
              <Label htmlFor="rec-valor">Valor por mês (R$)</Label>
              <Input id="rec-valor" inputMode="decimal" placeholder="sem receita" value={valor} aria-invalid={!!erroDoValor}
                aria-describedby={erroDoValor ? 'rec-valor-erro' : undefined} onChange={(e) => setValor(e.target.value)} />
              {erroDoValor && <p id="rec-valor-erro" className="mt-1 text-xs text-destructive">{erroDoValor}</p>}
            </div>
          )}
          {fonte === 'package' && semCota && (
            <p className="mt-2 text-xs text-destructive">Sem preço no pacote, o cliente fica sem receita na margem.</p>
          )}
        </fieldset>
      </div>
      <Button className="mt-5" disabled={salvando || !!erroDoValor} onClick={() => void salvar()}>Salvar receita</Button>
    </section>
  );
}

type Previa = { changes: DiffDoCliente; undone: number };

// Pacote do cliente. Trocar ou voltar ao pacote DESFAZ os ajustes manuais: a prévia mostra o que muda e quantos ajustes somem.
function BlocoDoPacote({ cliente, aoMudar }: Pick<PropsDaAba, 'cliente' | 'aoMudar'>) {
  const [modo, setModo] = useState<'trocar' | 'voltar' | null>(null);
  const diferencas = cliente.package_diff_count ?? 0;
  return (
    <section aria-labelledby="pacote" className={SECAO}>
      <h2 id="pacote" className={TITULO_SECAO}>Pacote</h2>
      <p className="mt-3 text-sm">
        {cliente.package ? cliente.package.name : 'Personalizado'}
        {cliente.package && diferencas > 0 && <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">{plural(diferencas, 'diferença', 'diferenças')} do pacote</span>}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setModo('trocar')}>Trocar pacote</Button>
        {cliente.package && diferencas > 0 && <Button variant="outline" onClick={() => setModo('voltar')}>Voltar ao pacote</Button>}
      </div>
      {modo && <DialogoDoPacote key={modo} modo={modo} cliente={cliente} aoMudar={aoMudar} aoFechar={() => setModo(null)} />}
    </section>
  );
}

function DialogoDoPacote({ modo, cliente, aoMudar, aoFechar }: { modo: 'trocar' | 'voltar'; cliente: ClientePooled; aoMudar: (c: ClientePooled) => void; aoFechar: () => void }) {
  const [pacotes, setPacotes] = useState<PacoteDaLista[]>([]);
  const [erroDaLista, setErroDaLista] = useState(false);
  const [erroDaPrevia, setErroDaPrevia] = useState(false);
  const [escolhido, setEscolhido] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const seq = useRef(0);

  // seq: resposta de uma prévia antiga (escolher p2 e logo p3) é ignorada.
  const verPrevia = async (pkg?: string) => {
    const minha = ++seq.current;
    setCarregando(true); setPrevia(null); setErroDaPrevia(false);
    try {
      const r = modo === 'trocar' ? await clientesService.trocarPacote(cliente.id, pkg!, true) : await clientesService.voltarAoPacote(cliente.id, true);
      if (minha === seq.current) setPrevia({ changes: r.changes as DiffDoCliente, undone: r.undone });
    } catch {
      if (minha === seq.current) setErroDaPrevia(true);
    } finally { if (minha === seq.current) setCarregando(false); }
  };

  const carregarPacotes = () => {
    setErroDaLista(false);
    pacotesService.listar().then(setPacotes).catch(() => setErroDaLista(true));
  };

  useEffect(() => {
    if (modo === 'voltar') { void verPrevia(); return; }
    carregarPacotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = modo === 'trocar' ? await clientesService.trocarPacote(cliente.id, escolhido, false) : await clientesService.voltarAoPacote(cliente.id, false);
      aoMudar({ ...cliente, ...r.cliente });
      toast.success(modo === 'trocar' ? 'Pacote trocado.' : 'Cliente de volta ao pacote.');
      aoFechar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra aplicar.');
    } finally { setAplicando(false); }
  };

  const linhas = previa ? resumoDeMudancas(previa.changes) : [];
  const titulo = modo === 'trocar' ? 'Trocar pacote' : 'Voltar ao pacote';
  const pronto = !!previa && (modo === 'voltar' || !!escolhido);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{modo === 'trocar' ? `Escolha o pacote de ${cliente.name}.` : `${cliente.name} volta a ser igual ao pacote ${cliente.package?.name ?? ''}.`}</DialogDescription>
        </DialogHeader>
        {modo === 'trocar' && (
          <div>
            <Label htmlFor="novo-pacote">Novo pacote</Label>
            <Seletor id="novo-pacote" aria-label="Novo pacote" value={escolhido} onChange={(e) => { setEscolhido(e.target.value); if (e.target.value) void verPrevia(e.target.value); else { seq.current++; setPrevia(null); setErroDaPrevia(false); setCarregando(false); } }}>
              <option value="">Escolher…</option>
              {pacotes.filter((p) => p.id !== cliente.package?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Seletor>
          </div>
        )}
        {erroDaLista && <EmptyState tipo="erro" title="Não deu pra carregar os pacotes." aoTentarDeNovo={carregarPacotes} />}
        {erroDaPrevia && <EmptyState tipo="erro" title="Não deu pra ver o que muda." aoTentarDeNovo={() => void verPrevia(modo === 'trocar' ? escolhido : undefined)} />}
        {carregando && <div aria-busy="true" className="h-12 animate-pulse rounded-lg bg-muted" />}
        {previa && (
          <div className="space-y-2 text-sm">
            {linhas.length > 0 ? <ul className="list-disc pl-5">{linhas.map((l) => <li key={l}>{l}</li>)}</ul> : <p>Nenhuma função ou limite muda.</p>}
            {previa.undone > 0 && <p>{previa.undone === 1 ? 'O 1 ajuste manual deste cliente será desfeito.' : `Os ${previa.undone} ajustes manuais deste cliente serão desfeitos.`}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={!pronto || aplicando} onClick={() => void aplicar()}>{modo === 'trocar' ? 'Trocar' : 'Voltar ao pacote'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormularioDeLimites({ cliente, aoMudar, recarregar }: Pick<PropsDaAba, 'cliente' | 'aoMudar' | 'recarregar'>) {
  const diferentes = new Set<string>((cliente.package_diff?.limits ?? []).map((l) => l.key));
  const marca = (k: string) => diferentes.has(k) ? <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">≠ pacote</span> : null;
  const [numeros, setNumeros] = useState(String(cliente.max_whatsapp_channels ?? 5));
  const [franquia, setFranquia] = useState(cliente.ai_leads_included == null ? '' : String(cliente.ai_leads_included));
  const [preco, setPreco] = useState(String(cliente.ai_lead_overage_price_brl ?? 2.49));
  const [salvando, setSalvando] = useState(false);

  const { erros, valores } = validarLimites({ numeros, franquia, preco });
  const erroNumeros = erros.numeros ?? null;
  const erroFranquia = erros.franquia ?? null;
  const erroPreco = erros.preco ?? null;

  const salvar = async () => {
    if (!valores) return;
    setSalvando(true);
    try {
      const atualizado = await clientesService.atualizar(cliente.id, {
        name: cliente.name,
        ...groupsPatch(groupJidsFrom(cliente.settings ?? {})),
        ...valores,
      });
      aoMudar({ ...cliente, ...atualizado });
      toast.success('Limites salvos.');
      // O PATCH não devolve o diff do pacote: recarrega (silencioso) pra "≠ pacote" e o contador acompanharem.
      void recarregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra salvar.');
    } finally { setSalvando(false); }
  };

  const msg = (id: string, t: string | null) => t ? <p id={id} className="mt-1 text-xs text-destructive">{t}</p> : null;

  return (
    <section aria-labelledby="limites" className={SECAO}>
      <h2 id="limites" className={TITULO_SECAO}>Limites</h2>
      <div className={`mt-4 ${GRADE_CAMPOS}`}>
        <div><Label htmlFor="lim-num">Números de WhatsApp</Label>{marca('max_whatsapp_channels')}
          <Input id="lim-num" inputMode="numeric" aria-invalid={!!erroNumeros} aria-describedby={erroNumeros ? 'lim-num-erro' : undefined} value={numeros} onChange={(e) => setNumeros(e.target.value)} />
          {msg('lim-num-erro', erroNumeros)}
          <p className="mt-1 text-xs text-muted-foreground">0 = ilimitado · em uso: {cliente.whatsapp_channels_used ?? '—'}</p></div>
        <div><Label htmlFor="lim-fr">Franquia de leads da IA</Label>{marca('ai_leads_included')}
          <Input id="lim-fr" inputMode="numeric" placeholder="sem franquia" aria-invalid={!!erroFranquia} aria-describedby={erroFranquia ? 'lim-fr-erro' : undefined} value={franquia} onChange={(e) => setFranquia(e.target.value)} />
          {msg('lim-fr-erro', erroFranquia)}</div>
        <div><Label htmlFor="lim-pr">Preço do excedente (R$)</Label>{marca('ai_lead_overage_price_brl')}
          <Input id="lim-pr" inputMode="decimal" aria-invalid={!!erroPreco} aria-describedby={erroPreco ? 'lim-pr-erro' : undefined} value={preco} onChange={(e) => setPreco(e.target.value)} />
          {msg('lim-pr-erro', erroPreco)}</div>
      </div>
      <Button className="mt-5" disabled={salvando || !valores} onClick={() => void salvar()}>Salvar limites</Button>
    </section>
  );
}
