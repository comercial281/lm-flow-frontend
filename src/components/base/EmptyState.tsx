import type { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import PrimaryActionButton from './PrimaryActionButton';

// ── ESTADO VAZIO: QUATRO CASOS, NUNCA CONFUNDIDOS ───────────────────────────
//
// Regra (Fase 3, GLOSSARIO.md):
//   'vazio'        ainda não tem nada → diz pra que serve, botão de criar, exemplo
//   'semResultado' a busca/filtro não achou → botão de limpar filtros
//   'erro'         não carregou → botão de tentar de novo
//   sem acesso     → NÃO é aqui: é o NoAccessState (Fase 1)
// ERRO NUNCA APARECE COMO LISTA VAZIA: "Nenhum lembrete criado ainda" em cima
// de uma falha de rede manda o gestor criar de novo o que já existe.
//
// DUAS MEDIDAS (escolha do dono em 10/10/2026, GLOSSARIO.md → peça 7):
//   'grande'   (padrão) ícone, título, explicação e botão: a lista principal da tela
//   'compacto' caixa tracejada com a frase e a ação em link roxo ao lado: dentro
//              de bloco, cartão, aba do card do lead, painel lateral ou janela
// Os três tipos valem nos dois tamanhos. Substitui o "Nenhum…" solto num <p>
// cinza, que a trava `vazioSolto` do conferir-padrao conta.

interface EmptyStateProps {
  /** Padrão 'vazio'. Os outros dois já trazem título, frase e botão. */
  tipo?: 'vazio' | 'semResultado' | 'erro';
  /** Padrão 'grande'. 'compacto' é a caixa tracejada pra dentro de bloco, aba ou janela. */
  tamanho?: 'grande' | 'compacto';
  icon?: LucideIcon;
  /** Texto, ou texto com um link no meio (ReactNode). */
  title?: ReactNode;
  description?: ReactNode;
  /** Só no 'vazio': um caso imobiliário de verdade ("Lembrar o corretor da visita de amanhã"). */
  exemplo?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link';
    className?: string;
    disabled?: boolean;
    tooltip?: string;
  };
  /** 'erro': obrigatório na prática — sem ele não há como sair do erro. */
  aoTentarDeNovo?: () => void;
  /** 'semResultado' */
  aoLimparFiltros?: () => void;
  className?: string;
}

export const TEXTO_ERRO = {
  title: 'Não deu pra carregar',
  description: 'Pode ser a internet ou o servidor. O que já existe continua salvo.',
  acao: 'Tentar de novo',
};
export const TEXTO_SEM_RESULTADO = {
  title: 'Nada encontrado',
  description: 'Nenhum resultado com essa busca ou esses filtros.',
  acao: 'Limpar filtros',
};

export default function EmptyState({
  tipo = 'vazio',
  tamanho = 'grande',
  icon: Icon,
  title,
  description,
  exemplo,
  action,
  aoTentarDeNovo,
  aoLimparFiltros,
  className,
}: EmptyStateProps) {
  const padrao = tipo === 'erro' ? TEXTO_ERRO : tipo === 'semResultado' ? TEXTO_SEM_RESULTADO : null;
  const titulo = title ?? padrao?.title ?? '';
  const frase = description ?? padrao?.description ?? '';
  const acao: EmptyStateProps['action'] =
    action ??
    (tipo === 'erro' && aoTentarDeNovo
      ? { label: TEXTO_ERRO.acao, onClick: aoTentarDeNovo, variant: 'outline' }
      : tipo === 'semResultado' && aoLimparFiltros
        ? { label: TEXTO_SEM_RESULTADO.acao, onClick: aoLimparFiltros, variant: 'outline' }
        : undefined);
  const comExemplo = tipo === 'vazio' && !!exemplo;

  if (tamanho === 'compacto') {
    // Na medida compacta a frase padrão do erro/sem resultado sai: o título e a
    // ação dizem tudo ("Não deu pra carregar. Tentar de novo").
    const fraseCompacta = description ?? (padrao ? '' : frase);
    // Título seguido de frase ou link ganha ponto, pra não emendar ("Não deu pra carregar. Tentar de novo").
    // O ponto fica fora do <span> do título, pra quem procura o título ache ele inteiro.
    const pontoDoTitulo =
      (fraseCompacta || acao) && typeof titulo === 'string' && titulo && !/[.!?…:]$/.test(titulo) ? '.' : '';
    return (
      <div
        role={tipo === 'erro' ? 'alert' : undefined}
        className={cn(
          'rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        <p>
          {titulo && <span>{titulo}</span>}
          {pontoDoTitulo}
          {fraseCompacta && <> <span>{fraseCompacta}</span></>}
          {acao && (
            <>
              {' '}
              <button
                type="button"
                onClick={acao.onClick}
                disabled={acao.disabled}
                title={acao.tooltip}
                className="font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                {acao.label}
              </button>
            </>
          )}
        </p>
        {comExemplo && (
          <p className="mt-1 text-xs text-muted-foreground/80">
            Exemplo: <span className="italic">{exemplo}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      role={tipo === 'erro' ? 'alert' : undefined}
      className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}
    >
      {Icon && (
        <div className="mb-6">
          <Icon className="h-16 w-16 text-muted-foreground/60" />
        </div>
      )}

      <h3 className="text-xl font-semibold text-foreground mb-2">{titulo}</h3>

      {frase ? (
        <p className={cn('text-muted-foreground max-w-md', comExemplo ? 'mb-2' : 'mb-6')}>{frase}</p>
      ) : (
        (comExemplo || acao) && <div className="mb-4" />
      )}

      {comExemplo && (
        <p className="text-sm text-muted-foreground/80 max-w-md mb-6">
          Exemplo: <span className="italic">{exemplo}</span>
        </p>
      )}

      {acao && (
        <PrimaryActionButton
          label={acao.label}
          onClick={acao.onClick}
          size="default"
          variant={acao.variant}
          className={acao.className}
          disabled={acao.disabled}
          tooltip={acao.tooltip}
        />
      )}
    </div>
  );
}
