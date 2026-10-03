import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Abas from '@/components/base/Abas';
import { useCan } from '@/hooks/useCan';
import { useCaptacoesNovas } from '@/features/properties/proprietarios/useCaptacoesNovas';
import ListaDeProprietarios from './ListaDeProprietarios';
import NovasCaptacoes from './NovasCaptacoes';

// ── GESTÃO DE PROPRIETÁRIOS (Imóveis entrega 3, 03/10/2026) ─────────────────
// Duas abas: Proprietários (a lista) e Novas captações (pedidos do formulário
// "Anuncie seu imóvel" do site). A segunda só para quem lê captações; com uma
// aba só, a fileira de abas não aparece (como o Bolsão do corretor).
type Aba = 'proprietarios' | 'captacoes';
const ABA_DE_CAPTACOES = 'captacoes';

export default function GestaoDeProprietarios() {
  const can = useCan();
  const veCaptacoes = can('property_capture_requests', 'read');
  const [params, setParams] = useSearchParams();
  const aba: Aba = veCaptacoes && params.get('aba') === ABA_DE_CAPTACOES ? 'captacoes' : 'proprietarios';
  const { tem, marcarComoVistas } = useCaptacoesNovas(veCaptacoes);

  // Abrir a aba (clicando ou pelo link ?aba=captacoes) apaga a bolinha.
  useEffect(() => {
    if (aba === 'captacoes') void marcarComoVistas();
  }, [aba, marcarComoVistas]);

  const trocarAba = (chave: string) =>
    setParams(antes => {
      const novos = new URLSearchParams(antes);
      if (chave === 'captacoes') novos.set('aba', ABA_DE_CAPTACOES); else novos.delete('aba');
      return novos;
    }, { replace: true });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <h1 className="text-2xl font-bold leading-tight">Gestão de proprietários</h1>
        {veCaptacoes && (
          <Abas
            className="mt-4"
            rotulo="Gestão de proprietários"
            ativa={aba}
            aoTrocar={trocarAba}
            abas={[
              { chave: 'proprietarios', rotulo: 'Proprietários' },
              { chave: 'captacoes', rotulo: 'Novas captações', marcador: tem },
            ]}
          />
        )}
        {aba === 'captacoes' ? <NovasCaptacoes /> : <ListaDeProprietarios />}
      </div>
    </div>
  );
}
