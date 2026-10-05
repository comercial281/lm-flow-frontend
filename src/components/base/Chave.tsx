import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/ds';
import { isForbiddenError } from '@/services/core/forbidden';
import { cn } from '@/lib/utils';

// ── CHAVE DA CASA: LIGAR/DESLIGAR ────────────────────────────────────────────
//
// A regra (Fase 3, GLOSSARIO.md): **chave = efeito na hora**. Quem vira a chave
// já ligou ou desligou; não existe "Salvar" depois. Opção que espera o Salvar
// de um formulário é caixinha, nunca chave. Assim a pessoa aprende uma coisa só.
//
// O que ela faz por quem usa:
//   - diz o efeito (rótulo) e o estado em texto ("Ligado"/"Desligado"), não só cor;
//   - vira na hora e, se o servidor recusar, VOLTA sozinha e diz por quê;
//   - não aceita um segundo clique enquanto o primeiro não voltou;
//   - `aoMudar` pode perguntar antes (confirmação, janela com campos) e devolver
//     `false` pra desistir: volta sem aviso nenhum.

export interface ChaveProps {
  /** O efeito, em frase: "Mandar lembrete no WhatsApp". Vira o nome acessível. */
  rotulo: string;
  descricao?: string;
  ligada: boolean;
  /** Salva. Devolva `false` pra desistir (a chave volta, sem aviso). Erro = volta e avisa. */
  aoMudar: (proximo: boolean) => Promise<boolean | void>;
  desabilitada?: boolean;
  /** 'o' → Ligado/Desligado (padrão) · 'a' → Ligada/Desligada */
  genero?: 'o' | 'a';
  /** Em linha de tabela: o rótulo não aparece, mas continua sendo o nome da chave. */
  semRotuloVisivel?: boolean;
  /** Quem chama já avisa por conta própria (ex.: toast com Desfazer): não mostra o "Ligado". Erro continua avisando. */
  semAviso?: boolean;
  className?: string;
}

export const MENSAGEM_ERRO_CHAVE = 'Não deu pra salvar. Tente de novo.';
export const MENSAGEM_RECUSA_CHAVE = 'Seu cargo não pode mudar isto. Quem libera é o administrador da conta.';

function mensagemDoErro(erro: unknown): string {
  if (isForbiddenError(erro)) return MENSAGEM_RECUSA_CHAVE;
  const dados = (erro as { response?: { data?: { message?: unknown; error?: unknown } } })?.response?.data;
  const doServidor = typeof dados?.message === 'string' ? dados.message : typeof dados?.error === 'string' ? dados.error : '';
  return doServidor || MENSAGEM_ERRO_CHAVE;
}

export default function Chave({
  rotulo,
  descricao,
  ligada,
  aoMudar,
  desabilitada = false,
  genero = 'o',
  semRotuloVisivel = false,
  semAviso = false,
  className,
}: ChaveProps) {
  const id = useId();
  const [valor, setValor] = useState(ligada);
  const [pendente, setPendente] = useState(false);
  // Trava síncrona: o estado `pendente` só chega no próximo render, e dois
  // cliques no mesmo quadro passariam os dois.
  const ocupada = useRef(false);

  useEffect(() => {
    if (!ocupada.current) setValor(ligada);
  }, [ligada]);

  const estado = (v: boolean) => `${v ? 'Ligad' : 'Desligad'}${genero}`;

  const trocar = async (proximo: boolean) => {
    if (ocupada.current || desabilitada) return;
    ocupada.current = true;
    setPendente(true);
    setValor(proximo);
    try {
      const resposta = await aoMudar(proximo);
      if (resposta === false) setValor(!proximo);
      else if (!semAviso) toast.success(estado(proximo));
    } catch (erro) {
      setValor(!proximo);
      toast.error(mensagemDoErro(erro));
    } finally {
      ocupada.current = false;
      setPendente(false);
    }
  };

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      {!semRotuloVisivel && (
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {rotulo}
          </label>
          {descricao && <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>}
        </div>
      )}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground" aria-hidden="true">
          {estado(valor)}
        </span>
        <Switch
          id={id}
          checked={valor}
          onCheckedChange={trocar}
          disabled={desabilitada || pendente}
          aria-label={rotulo}
        />
      </div>
    </div>
  );
}
