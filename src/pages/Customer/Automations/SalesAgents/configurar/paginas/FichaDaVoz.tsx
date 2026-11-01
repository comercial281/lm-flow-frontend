// Os quatro campos da ficha de quem fala (Tarefa 71): quem fala, ele ou ela, nome e como se
// apresenta. Serve à ficha da CASA e à de cada NÚMERO. No número, "Igual à casa" tira o campo
// da ficha própria (ele volta a herdar) e o que a casa diz aparece de sugestão nos textos.
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import type { QuemFala, Voz } from '@/services/salesAgents/salesAgentsService';
import { ROTULO_DA_VOZ } from '@/features/salesAgents/fichas';
import TextoNaHora from '../TextoNaHora';

export interface FichaDaVozProps {
  /** Prefixo dos ids (uma ficha por cartão). */
  idBase: string;
  /** O que está gravado NESTA ficha (a do número, ou a da casa). */
  voz: Voz;
  /** Só no número: a casa, pra sugerir e pra opção "Igual à casa". */
  casa?: Voz;
  aoMudar: (campo: Partial<Voz>) => unknown;
}

const IGUAL = 'Igual à casa';

export default function FichaDaVoz({ idBase, voz, casa, aoMudar }: FichaDaVozProps) {
  const noNumero = !!casa;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id={`${idBase}-kind`} rotulo="Quem fala">
        <Seletor id={`${idBase}-kind`} className={`${CLASSE_DO_CAMPO} w-full`} value={voz.kind ?? ''}
          onChange={(e) => aoMudar({ kind: (e.target.value || undefined) as QuemFala | undefined })}>
          {noNumero && <option value="">{IGUAL}</option>}
          {(Object.keys(ROTULO_DA_VOZ) as QuemFala[]).map((k) => <option key={k} value={k}>{ROTULO_DA_VOZ[k]}</option>)}
        </Seletor>
      </Campo>
      <Campo id={`${idBase}-gender`} rotulo="Ele ou ela">
        <Seletor id={`${idBase}-gender`} className={`${CLASSE_DO_CAMPO} w-full`} value={voz.gender ?? ''}
          onChange={(e) => aoMudar({ gender: (e.target.value || undefined) as Voz['gender'] })}>
          {noNumero && <option value="">{IGUAL}</option>}
          <option value="ela">Ela</option>
          <option value="ele">Ele</option>
        </Seletor>
      </Campo>
      <TextoNaHora id={`${idBase}-name`} rotulo="Nome" salvo={voz.name ?? ''} maxLength={60}
        placeholder={casa?.name ? `${casa.name} (da casa)` : 'sem nome'}
        aoGravar={(v) => aoMudar({ name: v.trim() || undefined })} />
      <TextoNaHora id={`${idBase}-intro`} rotulo="Como se apresenta" salvo={voz.intro ?? ''} maxLength={200}
        placeholder={casa?.intro ? 'Igual à casa' : 'ex.: sou a Ana, corretora'}
        ajuda="Uma linha, até 200 caracteres."
        aoGravar={(v) => aoMudar({ intro: v.trim() || undefined })} />
    </div>
  );
}
