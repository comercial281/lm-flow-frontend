// Funil e follow-up (Tarefa 72, 01/11/2026): onde o card fica em cada momento (Funil) e o que ela
// faz quando o lead some (retomada e follow-up numa linha do tempo), numa página só. A chave
// "Esta IA só faz follow-up" (`followup_only`) vem primeiro, porque muda o que o resto significa.
import { Secao, Secoes } from '@/components/base/Secao';
import LinhaComChave from '@/components/base/LinhaComChave';
import type { PropsDaPagina } from '../paginas';
import Funil from './Funil';
import Followup from './Followup';

export default function FunilEFollowup(props: PropsDaPagina) {
  const { agent, gravar } = props;
  return (
    <>
      <Secoes>
        <Secao titulo="Só follow-up" descricao="Pra uma IA que não atende ao vivo: ela só vai atrás de quem parou de responder.">
          <LinhaComChave rotulo="Esta IA só faz follow-up" descricao="Ela não responde ao lead na hora; entra só pra retomar e entregar pro follow-up."
            ligada={!!agent.followup_only} aoMudar={(v) => gravar({ followup_only: v })} />
        </Secao>
      </Secoes>
      <Funil {...props} />
      <Followup {...props} />
    </>
  );
}
