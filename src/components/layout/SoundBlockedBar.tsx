import { VolumeX } from 'lucide-react';
import Faixa from '@/components/base/Faixa';
import { clearSoundBlocked, playLeadAlert, useSoundBlocked } from '@/lib/plantaoSound/leadAlert';

// Som do Plantão (11/11/2026): o navegador recusa som até a primeira interação
// com a página. Esta faixa só aparece DEPOIS de uma recusa de verdade (chegou
// lead e o Chegou não tocou); o dono vetou faixa que aparece para todo mundo.
// O clique nela já é a interação que o navegador pede, e o som toca ali mesmo.
export default function SoundBlockedBar() {
  const bloqueado = useSoundBlocked();
  if (!bloqueado) return null;

  return (
    <Faixa tom="atencao" icone={VolumeX}>
      <button
        type="button"
        className="cursor-pointer text-left underline-offset-2 hover:underline"
        onClick={() => {
          clearSoundBlocked();
          void playLeadAlert();
        }}
      >
        O navegador bloqueou o som do plantão. Clique aqui pra ligar.
      </button>
    </Faixa>
  );
}
