import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@/components/ui/ds';

// ── SUBSTITUTO DO window.prompt ──────────────────────────────────────────────
//
// POR QUE ISTO EXISTE
// É o irmão do useConfirmacao, pelo mesmo motivo e com o mesmo desenho: a
// caixinha do navegador congela a aba, ignora o tema, ignora a fonte e mostra o
// endereço do site no cabeçalho. Só que o `prompt` é pior que o `confirm` — ele
// ainda por cima desenha um campo de texto do sistema operacional no meio de um
// produto que tem campo de texto próprio.
//
// A diferença de contrato: o `confirm` devolve boolean, o `prompt` devolve a
// string digitada ou `null` quando a pessoa desiste. `perguntar` devolve
// `Promise<string | null>` — mesmo contrato, então o corpo de quem chama só
// ganha o `await`.
//
// COMO SE USA
//   const { perguntar, dialogoDePergunta } = usePergunta();
//
//   const criarPasta = async () => {
//     const nome = await perguntar({ titulo: 'Nova pasta', rotuloDoCampo: 'Nome' });
//     if (!nome) return;
//     ...
//   };
//
//   return (<> ...a tela... {dialogoDePergunta} </>);
//
// O QUE ELE FAZ QUE A CAIXINHA NÃO FAZIA
//   - Enter envia, Esc cancela (a caixinha fazia isso; o Dialog precisou ser
//     ensinado, e é por isso que existe o <form> aqui dentro).
//   - Texto em branco não passa: o botão fica desabilitado. A caixinha deixava
//     confirmar vazio, e todo chamador repetia o mesmo `if (!nome?.trim())`.
//     Aqui a resposta já vem aparada, ou vem `null`.

export interface PedidoDePergunta {
  titulo: string;
  descricao?: React.ReactNode;
  /** Rótulo do campo. Sem ele o campo fica com `aria-label` no título. */
  rotuloDoCampo?: string;
  valorInicial?: string;
  placeholder?: string;
  rotuloDaAcao?: string;
  rotuloDeCancelar?: string;
}

interface Retorno {
  /** Devolve o texto aparado, ou `null` se a pessoa cancelou — igual ao window.prompt. */
  perguntar: (pedido: PedidoDePergunta) => Promise<string | null>;
  dialogoDePergunta: React.ReactNode;
}

export function usePergunta(): Retorno {
  const [pedido, setPedido] = useState<PedidoDePergunta | null>(null);
  const [texto, setTexto] = useState('');
  // Guarda o `resolve` de quem está esperando. Em ref, não em estado: trocar de
  // valor aqui não deve causar render.
  const responder = useRef<((resposta: string | null) => void) | null>(null);

  const perguntar = useCallback((novoPedido: PedidoDePergunta) => {
    // Pedido antigo ainda no ar é respondido com `null` antes de ser
    // substituído — Promise pendurada pra sempre é vazamento, e quem chamou
    // ficaria travado sem nunca saber por quê.
    responder.current?.(null);
    setPedido(novoPedido);
    setTexto(novoPedido.valorInicial ?? '');
    return new Promise<string | null>(resolve => {
      responder.current = resolve;
    });
  }, []);

  // Se a tela sumir com uma pergunta no ar, quem chamou fica esperando uma
  // Promise que ninguém mais vai resolver. Desmontou, a resposta é `null` — que
  // é o que o window.prompt devolvia quando a pessoa desistia.
  useEffect(
    () => () => {
      responder.current?.(null);
      responder.current = null;
    },
    [],
  );

  const fechar = useCallback((resposta: string | null) => {
    responder.current?.(resposta);
    responder.current = null;
    setPedido(null);
    setTexto('');
  }, []);

  const aparado = texto.trim();

  const dialogoDePergunta = (
    <Dialog open={!!pedido} onOpenChange={aberto => { if (!aberto) fechar(null); }}>
      <DialogContent>
        {/* O <form> é o que faz o Enter enviar. Sem ele, o Dialog engole a
            tecla e a pessoa fica clicando no botão — a caixinha do navegador
            aceitava Enter, e perder isso seria trocar por algo pior. */}
        <form
          onSubmit={evento => {
            evento.preventDefault();
            if (aparado) fechar(aparado);
          }}
        >
          <DialogHeader>
            <DialogTitle>{pedido?.titulo}</DialogTitle>
            {pedido?.descricao !== undefined && (
              <DialogDescription>{pedido.descricao}</DialogDescription>
            )}
          </DialogHeader>

          <div className="grid gap-2 py-4">
            {pedido?.rotuloDoCampo && (
              <Label htmlFor="campo-da-pergunta">{pedido.rotuloDoCampo}</Label>
            )}
            <Input
              id="campo-da-pergunta"
              autoFocus
              value={texto}
              placeholder={pedido?.placeholder}
              aria-label={pedido?.rotuloDoCampo ?? pedido?.titulo}
              onChange={evento => setTexto(evento.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => fechar(null)}>
              {pedido?.rotuloDeCancelar ?? 'Cancelar'}
            </Button>
            <Button type="submit" disabled={!aparado}>
              {pedido?.rotuloDaAcao ?? 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { perguntar, dialogoDePergunta };
}
