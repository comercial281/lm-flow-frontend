// Campo de texto que grava AO SAIR (decisão 13, 06/10/2026), nunca a cada tecla:
// gravar por tecla mandaria um PATCH por letra e comeria o que a pessoa ainda está
// digitando. Também grava quando o campo SOME com edição pendente (trocou de
// página pelo endereço, o Voltar do navegador): o React não dispara o blur no
// desmonte. Fechar a aba com o campo editado pergunta pelo navegador
// (`beforeunload`), sem o "Sair sem salvar?" da casa, que saiu das páginas da IA.
import { useEffect, useRef, useState } from 'react';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';

export function useTextoNaHora(salvo: string, aoGravar: (texto: string) => unknown) {
  const [valor, setValor] = useState(salvo);
  const atual = useRef(salvo);
  const base = useRef(salvo);
  const editando = useRef(false);
  const gravarRef = useRef(aoGravar);
  gravarRef.current = aoGravar;

  useEffect(() => {
    base.current = salvo;
    if (!editando.current) { atual.current = salvo; setValor(salvo); }
  }, [salvo]);

  const sair = () => {
    editando.current = false;
    if (atual.current === base.current) return;
    base.current = atual.current;
    void gravarRef.current(atual.current);
  };

  useEffect(() => () => { if (editando.current) sair(); }, []);

  const [sujo, setSujo] = useState(false);
  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sujo]);

  const mudar = (v: string) => {
    editando.current = true;
    atual.current = v;
    setValor(v);
    setSujo(v !== base.current);
  };
  const aoSair = () => { sair(); setSujo(false); };
  return { valor, mudar, aoSair };
}

export interface TextoNaHoraProps {
  id: string;
  rotulo: string;
  salvo: string;
  aoGravar: (texto: string) => unknown;
  tipo?: 'linha' | 'varias' | 'numero' | 'hora';
  ajuda?: string;
  aviso?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  className?: string;
  classeDoControle?: string;
}

export default function TextoNaHora({ id, rotulo, salvo, aoGravar, tipo = 'linha', ajuda, aviso, placeholder, rows = 3, maxLength, min, max, className, classeDoControle }: TextoNaHoraProps) {
  const { valor, mudar, aoSair } = useTextoNaHora(salvo, aoGravar);
  if (tipo === 'varias') {
    return (
      <CampoTextoLongo id={id} rotulo={rotulo} valor={valor} aoMudar={mudar} onBlur={aoSair} ajuda={ajuda} aviso={aviso}
        placeholder={placeholder} rows={rows} maxLength={maxLength} className={className} classeDoControle={classeDoControle} />
    );
  }
  return (
    <CampoTexto id={id} rotulo={rotulo} valor={valor} aoMudar={mudar} onBlur={aoSair} ajuda={ajuda} aviso={aviso}
      placeholder={placeholder} maxLength={maxLength} min={min} max={max} className={className} classeDoControle={classeDoControle}
      type={tipo === 'numero' ? 'number' : tipo === 'hora' ? 'time' : 'text'}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
  );
}
