import { useState } from 'react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';

// "DE QUEM É" (Automações, 23/10/2026): a escolha do gestor ao criar, no lugar
// dos dois botões "Nova pessoal" / "Nova da equipe". O corretor não vê a janela
// (cria a dele direto). Mesma pergunta do "Novo follow-up".

export type DeQuem = 'equipe' | 'meu';

export interface OpcaoDeQuem {
  rotulo: string;
  descricao: string;
}

export interface PedidoDeQuem {
  titulo: string;
  descricao?: string;
  acao: string;
  inicial: DeQuem;
  equipe: OpcaoDeQuem;
  meu: OpcaoDeQuem;
  aoConfirmar: (team: boolean) => Promise<void>;
}

export function JanelaDeQuemE({ pedido, aoFechar }: { pedido: PedidoDeQuem; aoFechar: () => void }) {
  const [deQuem, setDeQuem] = useState<DeQuem>(pedido.inicial);
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    setSalvando(true);
    try {
      await pedido.aoConfirmar(deQuem === 'equipe');
    } finally {
      setSalvando(false);
      aoFechar();
    }
  };

  return (
    <Dialog open onOpenChange={aberta => { if (!aberta && !salvando) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pedido.titulo}</DialogTitle>
          <DialogDescription>{pedido.descricao ?? 'De quem é?'}</DialogDescription>
        </DialogHeader>
        <CartoesDeEscolha<DeQuem>
          rotulo="De quem é"
          valor={deQuem}
          aoEscolher={setDeQuem}
          opcoes={[
            { valor: 'equipe', ...pedido.equipe },
            { valor: 'meu', ...pedido.meu },
          ]}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void confirmar()} disabled={salvando}>{pedido.acao}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
