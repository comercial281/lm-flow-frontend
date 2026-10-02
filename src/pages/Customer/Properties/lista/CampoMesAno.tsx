// src/pages/Customer/Properties/lista/CampoMesAno.tsx
// Previsão de entrega em duas listas (Mês e Ano), compondo o mesmo 'AAAA-MM'.
// Era <input type="month">, que o Firefox e o Safari do computador mostram como
// texto livre: o servidor descartava o que não entendia e a previsão salva sumia.
// Mês sem ano (ou ano sem mês) vale '' (sem previsão), mas a escolha feita fica
// na tela até a pessoa completar a outra.
import { useEffect, useState } from 'react';
import { Seletor } from '@/components/base/Seletor';
import { MESES_DO_ANO, anosDaPrevisao, juntarMesAno, separarMesAno } from '@/features/properties/listingKind';

const campo = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export default function CampoMesAno({ valor, aoMudar, rotulo }: {
  valor: string; aoMudar: (v: string) => void; rotulo: string;
}) {
  const [escolha, setEscolha] = useState(() => separarMesAno(valor));

  // Valor trocado por fora (abriu outro imóvel): a escolha volta a ser a dele.
  useEffect(() => {
    if (juntarMesAno(escolha.ano, escolha.mes) !== valor) setEscolha(separarMesAno(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const mudar = (parte: Partial<typeof escolha>) => {
    const nova = { ...escolha, ...parte };
    setEscolha(nova);
    aoMudar(juntarMesAno(nova.ano, nova.mes));
  };
  const anos = anosDaPrevisao(new Date().getFullYear(), escolha.ano || undefined);

  return (
    <div className="mt-1 grid grid-cols-2 gap-2">
      <Seletor aria-label={`Mês da ${rotulo}`} value={escolha.mes} onChange={e => mudar({ mes: e.target.value })} className={campo}>
        <option value="">—</option>
        {MESES_DO_ANO.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
      </Seletor>
      <Seletor aria-label={`Ano da ${rotulo}`} value={escolha.ano} onChange={e => mudar({ ano: e.target.value })} className={campo}>
        <option value="">—</option>
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </Seletor>
    </div>
  );
}
