import type { ComponentProps, ReactNode } from 'react';
import { Input, Label as UILabel, Textarea } from '@/components/ui/ds';
import { cn } from '@/lib/utils';

// Campo das telas do Meu site: rótulo visível ligado ao controle (htmlFor/id),
// ajuda embaixo e, quando houver, aviso âmbar ou erro vermelho. Os controles são
// maiores que o padrão do app (≈ 44px, texto 16px): o painel é usado por quem não
// mexe em sistema todo dia, e o campo pequeno e colado era a queixa do dono.

/** Altura e texto de todo controle de uma linha do Meu site (Input, Seletor, telefone). */
export const CLASSE_DO_CAMPO = 'h-11 text-base md:text-base';

interface CampoProps {
  /** O mesmo `id` vai no controle (children): é ele que liga o rótulo. */
  id: string;
  rotulo: ReactNode;
  ajuda?: ReactNode;
  /** Aviso que não impede salvar (âmbar). */
  aviso?: ReactNode;
  /** Erro (vermelho). */
  erro?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Ids das mensagens embaixo do campo, pra quem monta o controle à mão ligar o `aria-describedby`. */
export function descricaoDoCampo(id: string, p: { ajuda?: ReactNode; aviso?: ReactNode; erro?: ReactNode }) {
  const ids = [p.ajuda && `${id}-ajuda`, p.aviso && `${id}-aviso`, p.erro && `${id}-erro`].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function Campo({ id, rotulo, ajuda, aviso, erro, className, children }: CampoProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <UILabel htmlFor={id} className="text-sm font-medium">{rotulo}</UILabel>
      {children}
      {ajuda && <p id={`${id}-ajuda`} className="text-sm text-muted-foreground">{ajuda}</p>}
      {aviso && <p id={`${id}-aviso`} className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
      {erro && <p id={`${id}-erro`} className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}

type PropsDoInput = Omit<ComponentProps<typeof Input>, 'id' | 'value' | 'onChange'>;

interface CampoTextoProps extends Omit<CampoProps, 'children'>, PropsDoInput {
  /** Classes do campo em si (o `className` vai na volta dele). */
  classeDoControle?: string;
  valor: string;
  aoMudar: (valor: string) => void;
}

/** Campo de uma linha. */
export function CampoTexto({ id, rotulo, ajuda, aviso, erro, className, classeDoControle, valor, aoMudar, ...input }: CampoTextoProps) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} aviso={aviso} erro={erro} className={className}>
      <Input
        {...input}
        id={id}
        value={valor}
        onChange={e => aoMudar(e.target.value)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricaoDoCampo(id, { ajuda, aviso, erro })}
        className={cn(CLASSE_DO_CAMPO, classeDoControle)}
      />
    </Campo>
  );
}

type PropsDoTextarea = Omit<ComponentProps<typeof Textarea>, 'id' | 'value' | 'onChange'>;

interface CampoTextoLongoProps extends Omit<CampoProps, 'children'>, PropsDoTextarea {
  classeDoControle?: string;
  valor: string;
  aoMudar: (valor: string) => void;
}

/** Campo de várias linhas. */
export function CampoTextoLongo({ id, rotulo, ajuda, aviso, erro, className, classeDoControle, valor, aoMudar, ...area }: CampoTextoLongoProps) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} aviso={aviso} erro={erro} className={className}>
      <Textarea
        {...area}
        id={id}
        value={valor}
        onChange={e => aoMudar(e.target.value)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricaoDoCampo(id, { ajuda, aviso, erro })}
        className={cn('text-base md:text-base', classeDoControle)}
      />
    </Campo>
  );
}
