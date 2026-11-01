// Condução · Abertura (onda 3; bloco da Condução na Tarefa 72, 01/11/2026). Primeira mensagem
// (Automática / Com texto de base), imagem e áudio de abertura e de onde o lead veio quando ela
// não sabe. As variações por campanha (`openings`) saíram daqui: moram em Campanhas e gatilhos.
//
// ⚠️ "Com texto de base": o texto é MODELO, não literal (roteiro de hoje; o "texto
// exato" foi cortado pelo dono em 05/10). Vale quando o lead escreve primeiro.
import { useEffect, useRef, useState } from 'react';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { CampoDeMidia } from '../CampoDeMidia';
import TextoNaHora from '../TextoNaHora';
import type { PropsDaPagina } from '../paginas';

type Modo = 'auto' | 'base';

export default function Abertura({ agent, gravar }: PropsDaPagina) {
  const [modo, setModo] = useState<Modo>(agent.greeting ? 'base' : 'auto');

  // ⚠️ "Automática" SEMPRE grava o null (o gravar não manda nada se já estava
  // vazio): o texto que acabou de ser digitado pode não ter chegado na IA lida
  // ainda, e "só limpar se tiver texto" deixava o texto gravado com a tela dizendo
  // Automática. E grava num efeito, não no clique: o campo do texto some com o
  // modo e, sem blur, grava o que tinha AO DESMONTAR — a limpeza do desmonte roda
  // antes dos efeitos novos, então o null vem depois e ganha.
  const modoAnterior = useRef(modo);
  useEffect(() => {
    if (modoAnterior.current === 'base' && modo === 'auto') void gravar({ greeting: null });
    modoAnterior.current = modo;
  }, [modo, gravar]);
  return (
    <Secoes>
      <Secao titulo="Abertura" descricao="A boas-vindas padrão: como ela abre a conversa com quem veio do anúncio. Se um fluxo falou antes, ela lê e continua. Lead de formulário recebe a mensagem da automação.">
        <BotoesDeEscolha<Modo> rotulo="Primeira mensagem" valor={modo}
          opcoes={[{ valor: 'auto', rotulo: 'Automática' }, { valor: 'base', rotulo: 'Com texto de base' }]} aoEscolher={setModo} />
        {modo === 'base' && (
          <TextoNaHora id="abertura-texto" tipo="varias" rows={3} rotulo="Texto de base" salvo={agent.greeting ?? ''}
            ajuda="Ela usa o seu texto como modelo, trocando pelo nome do lead e pelo anúncio."
            aoGravar={(v) => gravar({ greeting: v.trim() ? v : null })} />
        )}
        <TextoNaHora id="abertura-origem" rotulo="Quando não souber o anúncio, ela diz que o lead veio de" salvo={agent.default_origin ?? ''}
          placeholder="nosso anúncio do Instagram" aoGravar={(v) => gravar({ default_origin: v.trim() ? v : null })} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoDeMidia id="abertura-imagem" agentId={agent.id} tipo="image" rotulo="Imagem de abertura" valor={agent.opening_image_url}
            aoMudar={(url) => void gravar({ opening_image_url: url })} />
          <CampoDeMidia id="abertura-audio" agentId={agent.id} tipo="audio" rotulo="Áudio de abertura" valor={agent.opening_audio_url}
            aoMudar={(url) => void gravar({ opening_audio_url: url })} />
        </div>
      </Secao>
    </Secoes>
  );
}
