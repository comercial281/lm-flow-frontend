import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  brokerAssignmentsService,
  type BrokerAssignmentDetail,
} from '@/services/roletaConfig/brokerAssignmentsService';
import { offerFor, type OfferLookup } from '@/components/roleta/pendingOffersMatch';

// As ofertas da roleta esperando ESTE corretor, uma vez só para o app inteiro.
//
// Antes o poll morava dentro da faixa amarela. Agora a mesma lista alimenta a
// faixa, o selo "Aguardando seu aceite" no card do funil e na lista, o bloco do
// card aberto e a faixa da conversa — quatro lugares perguntando "tenho oferta
// para este lead?" a uma resposta só. Cada um com o próprio poll seria quatro
// requisições por minuto e quatro chances de discordarem.
//
// Sem provider (testes, telas fora do layout), o hook devolve lista vazia e
// nada é desenhado — a UI de oferta é opcional por construção.
const REFRESH_MS = 60_000;

interface PendingOffersValue {
  offers: BrokerAssignmentDetail[];
  loaded: boolean;
  offerFor: (lookup: OfferLookup) => BrokerAssignmentDetail | undefined;
  accept: (id: string) => Promise<BrokerAssignmentDetail>;
  refuse: (id: string) => Promise<BrokerAssignmentDetail>;
  refresh: () => Promise<void>;
}

const noop = async () => {
  throw new Error('PendingOffersProvider ausente');
};

const PendingOffersContext = createContext<PendingOffersValue>({
  offers: [],
  loaded: false,
  offerFor: () => undefined,
  accept: noop,
  refuse: noop,
  refresh: async () => undefined,
});

export function PendingOffersProvider({ children }: { children: ReactNode }) {
  const [offers, setOffers] = useState<BrokerAssignmentDetail[]>([]);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await brokerAssignmentsService.listMine();
      if (alive.current) setOffers(list);
    } catch {
      // Falha aqui não pode atrapalhar o app: some e tenta de novo no próximo
      // ciclo. Leitura de fundo não grita.
      if (alive.current) setOffers([]);
    } finally {
      if (alive.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  // Depois de aceitar/recusar a lista muda na hora: esperar o próximo ciclo
  // deixaria o selo "Aguardando seu aceite" um minuto no ar sobre um lead que
  // já é do corretor.
  const accept = useCallback(async (id: string) => {
    const result = await brokerAssignmentsService.accept(id);
    setOffers(prev => prev.filter(o => o.id !== id));
    void refresh();
    return result;
  }, [refresh]);

  const refuse = useCallback(async (id: string) => {
    const result = await brokerAssignmentsService.refuse(id);
    setOffers(prev => prev.filter(o => o.id !== id));
    void refresh();
    return result;
  }, [refresh]);

  const value = useMemo<PendingOffersValue>(() => ({
    offers,
    loaded,
    offerFor: (lookup: OfferLookup) => offerFor(offers, lookup),
    accept,
    refuse,
    refresh,
  }), [offers, loaded, accept, refuse, refresh]);

  return <PendingOffersContext.Provider value={value}>{children}</PendingOffersContext.Provider>;
}

export function usePendingOffers(): PendingOffersValue {
  return useContext(PendingOffersContext);
}
