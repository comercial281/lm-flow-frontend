import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Abas, { type Aba } from '@/components/base/Abas';
import BaseHeader from '@/components/base/BaseHeader';
import Pagina from '@/components/base/Pagina';
import type { AbaDaFicha, AbaDaLocacao } from '@/features/locacao/tipos';
import AssistenteNovoContrato from './AssistenteNovoContrato';
import Cobrancas from './Cobrancas';
import Condominio from './Condominio';
import Contratos from './Contratos';
import Mensagens from './Mensagens';
import Painel from './Painel';
import Regras from './Regras';
import Repasses from './Repasses';

const ABAS: (Aba & { chave: AbaDaLocacao })[] = [
  { chave: 'painel', rotulo: 'Painel' },
  { chave: 'contratos', rotulo: 'Contratos' },
  { chave: 'cobrancas', rotulo: 'Cobranças' },
  { chave: 'repasses', rotulo: 'Repasses' },
  { chave: 'condominio', rotulo: 'Condomínio' },
  { chave: 'mensagens', rotulo: 'Mensagens' },
  { chave: 'regras', rotulo: 'Regras' },
];

const CHAVES = new Set<string>(ABAS.map(a => a.chave));

export default function Locacao() {
  const navigate = useNavigate();
  const [busca, setBusca] = useSearchParams();
  const [novo, setNovo] = useState(false);

  const pedida = busca.get('aba') ?? 'painel';
  const aba = (CHAVES.has(pedida) ? pedida : 'painel') as AbaDaLocacao;

  const trocar = (chave: string) => {
    const prox = new URLSearchParams();
    if (chave !== 'painel') prox.set('aba', chave);
    setBusca(prox, { replace: true });
  };

  const abrir = (id: string, dentro?: AbaDaFicha) =>
    navigate(`/locacao/contratos/${id}${dentro && dentro !== 'resumo' ? `?aba=${dentro}` : ''}`);

  return (
    <Pagina
      cabecalho={(
        <BaseHeader
          title="Locação"
          subtitle="Contratos, boletos, repasses ao proprietário e reajustes, num lugar só."
          primaryAction={{ label: 'Novo contrato', icon: <Plus className="h-4 w-4" />, onClick: () => setNovo(true) }}
        />
      )}
    >
      <div className="grid gap-5">
        <Abas abas={ABAS} ativa={aba} aoTrocar={trocar} rotulo="Áreas da Locação" />
        {aba === 'painel' && <Painel aoIrParaAba={trocar} aoAbrirContrato={abrir} />}
        {aba === 'contratos' && <Contratos aoAbrir={id => abrir(id)} aoNovo={() => setNovo(true)} />}
        {aba === 'cobrancas' && <Cobrancas />}
        {aba === 'repasses' && <Repasses />}
        {aba === 'condominio' && <Condominio />}
        {aba === 'mensagens' && <Mensagens />}
        {aba === 'regras' && <Regras />}
      </div>
      <AssistenteNovoContrato aberto={novo} aoFechar={() => setNovo(false)} aoCriar={c => { setNovo(false); abrir(c.id); }} />
    </Pagina>
  );
}
