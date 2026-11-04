import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import Abas, { type Aba } from '@/components/base/Abas';
import Aviso from '@/components/base/Aviso';
import BaseHeader from '@/components/base/BaseHeader';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import Pagina from '@/components/base/Pagina';
import { dataCurta, dinheiro, hojeEmSaoPaulo } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { proximaAcao } from '@/features/locacao/chips';
import type { AbaDaFicha, Cobranca, Contrato } from '@/features/locacao/tipos';
import ListaDeBoletos from './ListaDeBoletos';
import AbaResumo from './ficha/AbaResumo';
import AbaReajuste from './ficha/AbaReajuste';
import AbaVistoria from './ficha/AbaVistoria';
import AbaEncerramento from './ficha/AbaEncerramento';
import AbaContrato from './ficha/AbaContrato';
import { Falha, Titulo } from './comum';

const ABAS: Aba[] = [
  { chave: 'resumo', rotulo: 'Resumo' },
  { chave: 'cobrancas', rotulo: 'Cobranças' },
  { chave: 'reajuste', rotulo: 'Reajuste' },
  { chave: 'chaves', rotulo: 'Vistoria e chaves' },
  { chave: 'encerramento', rotulo: 'Encerramento' },
  { chave: 'contrato', rotulo: 'Contrato' },
];

const TOM_DA_FAIXA = { bad: 'erro', warn: 'atencao', info: 'info', ok: 'sucesso' } as const;

const CHAVES_VALIDAS = new Set(ABAS.map(a => a.chave));

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);

export default function FichaDoContrato() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [busca, setBusca] = useSearchParams();
  const hoje = hojeEmSaoPaulo();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [cobrancas, setCobrancas] = useState<Cobranca[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  const pedida = busca.get('aba') ?? 'resumo';
  const aba: AbaDaFicha = (CHAVES_VALIDAS.has(pedida) ? pedida : 'resumo') as AbaDaFicha;

  const carregar = useCallback(async () => {
    try {
      const [c, cb] = await Promise.all([locacaoService.contrato(id), locacaoService.cobrancasDoContrato(id)]);
      setContrato(c);
      setCobrancas(cb);
      setErro(null);
    } catch (e) {
      setErro(e);
    }
  }, [id]);

  useEffect(() => { setContrato(null); setCobrancas(null); void carregar(); }, [carregar]);

  const trocar = (chave: string) => {
    const prox = new URLSearchParams(busca);
    if (chave === 'resumo') prox.delete('aba'); else prox.set('aba', chave);
    setBusca(prox, { replace: true });
  };

  const atrasadas = useMemo(
    () => (cobrancas ?? []).filter(b => b.status === 'aberta' && b.vencimento < hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [cobrancas, hoje],
  );
  const proxima = useMemo(
    () => (cobrancas ?? []).filter(b => b.status === 'aberta' && b.vencimento >= hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0],
    [cobrancas, hoje],
  );

  const voltar = (
    <Link to="/locacao?aba=contratos" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" />Contratos
    </Link>
  );

  if (erro) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Contrato" />}>
        <Falha erro={erro} aoTentar={() => void carregar()} />
      </Pagina>
    );
  }
  if (!contrato || !cobrancas) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Contrato" />}>
        <Carregando linhas={6} rotulo="Abrindo o contrato…" />
      </Pagina>
    );
  }

  if (!contrato.id) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Contrato" />}>
        <EmptyState tipo="vazio" title="Contrato não encontrado" description="Ele pode ter sido excluído." action={{ label: 'Voltar para os contratos', onClick: () => navigate('/locacao?aba=contratos') }} />
      </Pagina>
    );
  }

  const acao = proximaAcao(
    { ...contrato, em_atraso_qtd: atrasadas.length },
    hoje,
    {
      diasDeAtraso: atrasadas[0] ? diasEntre(atrasadas[0].vencimento, hoje) : 0,
      valorEmAtraso: dinheiro(atrasadas.reduce((s, b) => s + b.total, 0)),
      proximoBoleto: proxima ? { valor: dinheiro(proxima.total), vencimento: dataCurta(proxima.vencimento) } : null,
      dataEncerrado: contrato.saida ? dataCurta(contrato.saida) : undefined,
    },
  );

  const aoMudarContrato = (c: Contrato) => setContrato(c);

  return (
    <Pagina
      acima={voltar}
      cabecalho={(
        <BaseHeader
          title={contrato.imovel_descricao}
          subtitle={`${contrato.inquilino_nome} · proprietário ${contrato.proprietario_nome}${contrato.codigo ? ` · ${contrato.codigo}` : ''}`}
        />
      )}
    >
      <div className="grid gap-5">
        <Aviso
          tom={TOM_DA_FAIXA[acao.sev]}
          titulo={acao.titulo}
          acao={aba !== acao.aba ? <Button size="sm" variant="outline" onClick={() => trocar(acao.aba)}>{acao.rotulo}</Button> : undefined}
        >
          {acao.texto}
        </Aviso>

        <Abas abas={ABAS} ativa={aba} aoTrocar={trocar} rotulo="Partes do contrato" />

        {aba === 'resumo' && <AbaResumo contrato={contrato} hoje={hoje} />}
        {aba === 'cobrancas' && (
          <section className="grid gap-3">
            <Titulo>Boletos deste contrato</Titulo>
            {cobrancas.length === 0
              ? <EmptyState tipo="vazio" tamanho="compacto" title="Ainda não há boleto" description="Os boletos aparecem aqui quando forem gerados, alguns dias antes do vencimento." />
              : <ListaDeBoletos cobrancas={cobrancas} aoMudar={() => void carregar()} mostrarImovel={false} />}
          </section>
        )}
        {aba === 'reajuste' && <AbaReajuste contrato={contrato} aoMudar={aoMudarContrato} />}
        {aba === 'chaves' && <AbaVistoria contrato={contrato} aoMudar={aoMudarContrato} />}
        {aba === 'encerramento' && <AbaEncerramento contrato={contrato} aoMudar={c => { aoMudarContrato(c); void carregar(); }} />}
        {aba === 'contrato' && <AbaContrato contrato={contrato} aoMudar={aoMudarContrato} />}
      </div>
    </Pagina>
  );
}
