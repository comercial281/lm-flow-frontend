import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui/ds';

// ── SUBSTITUTO DO window.confirm ─────────────────────────────────────────────
//
// POR QUE ISTO EXISTE
// O projeto tinha 26 `window.confirm` espalhados por 21 arquivos. A caixinha do
// navegador congela a aba inteira, ignora o tema, ignora a fonte e mostra o
// endereço do site no cabeçalho — em tela vendida como produto, quebra a ilusão
// na hora.
//
// Trocar um por um significava, em CADA arquivo: criar estado, escrever o
// Dialog, guardar o que estava sendo confirmado e religar o botão. Vinte e uma
// vezes o mesmo desenho é onde a abstração se paga — e nem uma vez antes.
//
// POR QUE HOOK, E NÃO UM PROVIDER NO App.tsx
// Provider seria uma peça a mais no meio da árvore inteira do aplicativo, e o
// App.tsx é arquivo de encontro entre várias frentes de trabalho. Este hook não
// tem estado global: cada tela que o usa carrega o próprio diálogo.
//
// COMO SE USA
//   const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
//
//   const excluir = async () => {
//     if (!(await confirmar({
//       titulo: 'Excluir imóvel',
//       descricao: 'Esta ação não pode ser desfeita.',
//       rotuloDaAcao: 'Excluir',
//       destrutivo: true,
//     }))) return;
//     ...
//   };
//
//   return (<> ...a tela... {dialogoDeConfirmacao} </>);
//
// A chamada devolve `Promise<boolean>`, igual ao `window.confirm` devolvia
// boolean — então o corpo de quem chama quase não muda: só ganha o `await`.

export interface PedidoDeConfirmacao {
  titulo: string;
  /** Aceita texto ou JSX, pra poder destacar o nome do que vai ser apagado. */
  descricao?: React.ReactNode;
  rotuloDaAcao?: string;
  rotuloDeCancelar?: string;
  /** Pinta o botão de vermelho. Use pra tudo que apaga ou não tem volta. */
  destrutivo?: boolean;
}

interface Retorno {
  confirmar: (pedido: PedidoDeConfirmacao) => Promise<boolean>;
  dialogoDeConfirmacao: React.ReactNode;
}

export function useConfirmacao(): Retorno {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null);
  // Guarda o `resolve` da Promise que quem chamou está esperando. Fica em ref, e
  // não em estado, porque trocar de valor aqui não deve causar render.
  const responder = useRef<((resposta: boolean) => void) | null>(null);

  const confirmar = useCallback((novoPedido: PedidoDeConfirmacao) => {
    // Se já havia um diálogo aberto esperando resposta, ele é respondido com
    // `false` antes de ser substituído — Promise pendurada pra sempre é
    // vazamento, e quem chamou ficaria travado sem nunca saber por quê.
    responder.current?.(false);
    setPedido(novoPedido);
    return new Promise<boolean>(resolve => {
      responder.current = resolve;
    });
  }, []);

  // Se a tela sumir com um pedido no ar, quem chamou fica esperando uma Promise
  // que ninguém mais vai resolver — o `await confirmar(...)` nunca volta e o
  // resto da função nunca roda. Acontece de verdade em menu flutuante que se
  // fecha ao clicar fora: o clique que abre o diálogo é o mesmo que desmonta
  // quem está esperando. Desmontou, a resposta é `false` — que é exatamente o
  // que o `window.confirm` devolvia quando a pessoa desistia.
  useEffect(
    () => () => {
      responder.current?.(false);
      responder.current = null;
    },
    [],
  );

  const fechar = useCallback((resposta: boolean) => {
    responder.current?.(resposta);
    responder.current = null;
    setPedido(null);
  }, []);

  const dialogoDeConfirmacao = (
    <Dialog open={!!pedido} onOpenChange={aberto => { if (!aberto) fechar(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pedido?.titulo}</DialogTitle>
          {pedido?.descricao !== undefined && (
            <DialogDescription>{pedido.descricao}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => fechar(false)}>
            {pedido?.rotuloDeCancelar ?? 'Cancelar'}
          </Button>
          <Button
            variant={pedido?.destrutivo ? 'destructive' : 'default'}
            onClick={() => fechar(true)}
          >
            {pedido?.rotuloDaAcao ?? 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirmar, dialogoDeConfirmacao };
}
