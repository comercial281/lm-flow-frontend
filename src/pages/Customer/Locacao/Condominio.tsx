import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { dinheiro, hojeEmSaoPaulo, lerDinheiro } from '@/lib/formato';
import { imovelCurto } from '@/features/locacao/contratoDoc';
import { locacaoService } from '@/features/locacao/locacaoService';
import { LEI_CONDOMINIO, PARECE_EXTRAORDINARIA } from '@/features/locacao/textos';
import type { Contrato } from '@/features/locacao/tipos';
import { Falha, Titulo } from './comum';
import { rotuloDoMes, useCarga } from './usoComum';

interface Linha { desc: string; valor: string; tipo: 'ord' | 'ext' }

const LINHA_NOVA: Linha = { desc: '', valor: '', tipo: 'ord' };

/** Lançar o boleto do condomínio de um imóvel: o que é ordinário vai pro inquilino, o extraordinário fica com o proprietário. */
export default function Condominio() {
  const lancados = useCarga(() => locacaoService.condominios(), 'condominios');
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratoId, setContratoId] = useState('');
  const [competencia, setCompetencia] = useState(() => hojeEmSaoPaulo().slice(0, 7));
  const [linhas, setLinhas] = useState<Linha[]>([{ ...LINHA_NOVA }]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    locacaoService.contratos({ status: 'ativo' }).then(c => { if (vivo) setContratos(c); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  const mudar = (i: number, p: Partial<Linha>) => setLinhas(l => l.map((x, j) => {
    if (j !== i) return x;
    const proxima = { ...x, ...p };
    // Ao digitar a descrição, sugere o tipo — a pessoa pode trocar depois.
    if (p.desc !== undefined) proxima.tipo = PARECE_EXTRAORDINARIA.test(p.desc) ? 'ext' : 'ord';
    return proxima;
  }));

  const total = useMemo(() => linhas.reduce((acc, l) => acc + (lerDinheiro(l.valor) ?? 0), 0), [linhas]);
  const ordinarias = useMemo(() => linhas.filter(l => l.tipo === 'ord').reduce((acc, l) => acc + (lerDinheiro(l.valor) ?? 0), 0), [linhas]);
  const completas = linhas.filter(l => l.desc.trim() && (lerDinheiro(l.valor) ?? 0) > 0);

  const lancar = async () => {
    if (!contratoId || completas.length === 0) return;
    setSalvando(true);
    try {
      await locacaoService.lancarCondominio({
        contrato_id: contratoId,
        competencia,
        linhas: completas.map(l => ({ desc: l.desc.trim(), valor: lerDinheiro(l.valor) ?? 0, tipo: l.tipo })),
      });
      toast.success('Condomínio lançado.');
      setLinhas([{ ...LINHA_NOVA }]);
      lancados.recarregar();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra lançar o condomínio.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <Titulo>Lançar boleto do condomínio</Titulo>
        <Aviso tom="info" compacto>{LEI_CONDOMINIO}</Aviso>
        <Card className="gap-4 p-4">
          <GradeDaJanela>
            <CampoDaJanela rotulo="Imóvel" htmlFor="cond-imovel" colunas={3}>
              <Seletor id="cond-imovel" value={contratoId} onChange={e => setContratoId(e.target.value)}>
                <option value="">Escolha o imóvel</option>
                {contratos.map(c => <option key={c.id} value={c.id}>{imovelCurto(c.imovel_descricao)} · {c.inquilino_nome}</option>)}
              </Seletor>
            </CampoDaJanela>
            <CampoDaJanela rotulo="Mês do condomínio" htmlFor="cond-mes">
              <Input id="cond-mes" type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} />
            </CampoDaJanela>
          </GradeDaJanela>

          <div className="grid gap-2">
            {linhas.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_8rem_9rem_auto] items-center gap-2 max-sm:grid-cols-1">
                <Input aria-label="Descrição da despesa" placeholder="Ex.: Taxa ordinária, fundo de reserva" value={l.desc} onChange={e => mudar(i, { desc: e.target.value })} />
                <Input aria-label="Valor" inputMode="decimal" placeholder="0,00" value={l.valor} onChange={e => mudar(i, { valor: e.target.value })} />
                <Seletor aria-label="Quem paga" value={l.tipo} onChange={e => mudar(i, { tipo: e.target.value as 'ord' | 'ext' })}>
                  <option value="ord">Inquilino paga</option>
                  <option value="ext">Proprietário paga</option>
                </Seletor>
                <Button variant="ghost" size="icon" aria-label="Tirar esta linha" disabled={linhas.length === 1} onClick={() => setLinhas(x => x.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div>
              <Button variant="outline" size="sm" onClick={() => setLinhas(l => [...l, { ...LINHA_NOVA }])}><Plus className="mr-1 h-4 w-4" />Adicionar despesa</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              Total {dinheiro(total)} · vai no boleto do inquilino {dinheiro(ordinarias)}
            </p>
            <Button disabled={salvando || !contratoId || completas.length === 0} onClick={() => void lancar()}>Lançar condomínio</Button>
          </div>
        </Card>
      </section>

      <section className="grid gap-3">
        <Titulo>Já lançados</Titulo>
        {lancados.erro ? (
          <Falha erro={lancados.erro} aoTentar={lancados.recarregar} />
        ) : !lancados.dados ? (
          <Carregando linhas={3} rotulo="Carregando lançamentos…" />
        ) : lancados.dados.length === 0 ? (
          <EmptyState tamanho="compacto" title="Nada lançado ainda" description="Quando você lançar o condomínio de um imóvel, ele aparece aqui." />
        ) : (
          <Card className="gap-0 divide-y divide-border/60 p-1">
            {lancados.dados.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{imovelCurto(c.imovel_descricao)}</p>
                  <p className="truncate text-xs text-muted-foreground">{rotuloDoMes(c.competencia)}</p>
                </div>
                <span className="text-xs text-muted-foreground">Inquilino {dinheiro(c.ordinarias)} · Proprietário {dinheiro(c.extraordinarias)}</span>
                <span className="text-sm font-medium tabular-nums">{dinheiro(c.ordinarias + c.extraordinarias)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
