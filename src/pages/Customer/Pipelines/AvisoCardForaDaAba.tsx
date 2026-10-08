import { X } from 'lucide-react';
import IconActionButton from '@/components/base/IconActionButton';

// O link (?card=) aponta pra um card que não está no quadro carregado: foi
// arquivado, é de outra aba ou foi tirado do funil. Faixa que não bloqueia o
// quadro (E0, 07/10/2026). A Parte 4 troca isto pela busca do card por id.
export default function AvisoCardForaDaAba({ aoFechar }: { aoFechar: () => void }) {
  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 sm:mx-6"
    >
      <span>Este lead não está nesta aba.</span>
      <IconActionButton label="Fechar aviso" variant="ghost" onClick={aoFechar} icon={<X className="h-4 w-4" />} />
    </div>
  );
}
