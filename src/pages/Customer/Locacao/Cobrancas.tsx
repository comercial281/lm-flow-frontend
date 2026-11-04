import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { hojeEmSaoPaulo, plural } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import ListaDeBoletos from './ListaDeBoletos';
import { Falha, Titulo } from './comum';
import { mesMais, rotuloDoMes, useCarga } from './usoComum';

export default function Cobrancas() {
  const [ref, setRef] = useState(() => hojeEmSaoPaulo().slice(0, 7));
  const [gerando, setGerando] = useState(false);
  const mes = useCarga(() => locacaoService.cobrancasDoMes(ref), `mes-${ref}`);
  const atrasados = useCarga(() => locacaoService.cobrancasAtrasadas(), 'atrasados');

  const recarregar = () => { mes.recarregar(); atrasados.recarregar(); };

  const gerar = async () => {
    setGerando(true);
    try {
      const { geradas } = await locacaoService.gerarCobrancas(ref);
      if (geradas > 0) toast.success(geradas === 1 ? '1 boleto gerado.' : `${geradas} boletos gerados.`);
      else toast.info('Nenhum boleto novo para gerar neste mês.');
      recarregar();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra gerar os boletos.'));
    } finally {
      setGerando(false);
    }
  };

  if (mes.erro) return <Falha erro={mes.erro} aoTentar={mes.recarregar} />;

  const doMes = mes.dados?.cobrancas ?? [];
  const semBoleto = mes.dados?.sem_boleto ?? 0;
  const vencidosDeOutrosMeses = (atrasados.dados ?? []).filter(c => c.ref !== ref);

  return (
    <div className="grid gap-6">
      {vencidosDeOutrosMeses.length > 0 && (
        <section className="grid gap-3">
          <Titulo>Atrasados de meses anteriores</Titulo>
          <ListaDeBoletos cobrancas={vencidosDeOutrosMeses} aoMudar={recarregar} />
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setRef(mesMais(ref, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="min-w-44 text-center text-base font-semibold">Vencem em {rotuloDoMes(ref)}</h2>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setRef(mesMais(ref, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {semBoleto > 0 && (
          <Aviso
            tom="atencao"
            titulo={`${plural(semBoleto, 'contrato ainda não tem', 'contratos ainda não têm')} boleto neste mês`}
            acao={<Button size="sm" disabled={gerando} onClick={() => void gerar()}>Gerar boletos</Button>}
          >
            Os boletos saem sozinhos 10 dias antes do vencimento. Gere agora se quiser adiantar.
          </Aviso>
        )}

        {!mes.dados ? (
          <Carregando linhas={4} rotulo="Carregando boletos…" />
        ) : doMes.length === 0 ? (
          <EmptyState tamanho="compacto" title="Nenhum boleto neste mês" description="Quando os boletos forem gerados, eles aparecem aqui." />
        ) : (
          <ListaDeBoletos cobrancas={doMes} aoMudar={recarregar} />
        )}
      </section>
    </div>
  );
}
