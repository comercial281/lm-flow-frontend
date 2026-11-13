import { useMemo, useState, type FormEvent } from 'react';
import { cabecalhosDoSite, ehPrevia, envioFoiPrevia } from '@/features/siteBuilder/public/previa';
import { ehPreviaDoModelo } from '@/features/siteBuilder/public/previaDoModelo';
import { TEXTO_FALHA_DE_ENVIO, textoDoErroDeEnvio } from '@/features/siteBuilder/public/limiteDeEnvios';
import { isValidBrPhone } from '@/lib/brPhone';
import { rotuloTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { API, PROPERTY_TYPE_LABEL, onlyDigits, type SiteInfo } from '../portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Lógica da ficha do Anuncie, a mesma pros dois desenhos (Clássico e
   Moderno): os dois passos, os campos, a validação do telefone, a prévia sem
   envio e o envio SÓ POR E-MAIL (`/site/anuncie`: não cria contato, card nem
   automação — decisão do dono do produto, 16/09/2026).
──────────────────────────────────────────────────────────────────────────── */

export const FINALIDADES = ['Residencial', 'Comercial', 'Rural'];
export const NEGOCIOS = ['Venda', 'Locação', 'Venda e locação'];

export function useFichaDoAnuncie(tenant: string | undefined, site: SiteInfo, wa: string | null | undefined) {
  const [step, setStep] = useState<1 | 2>(1);
  const [sent, setSent] = useState(false);
  // Envio feito na prévia: o servidor não criou nada, e a tela não finge que criou.
  const [enviadoNaPrevia, setEnviadoNaPrevia] = useState(false);
  const [sending, setSending] = useState(false);
  // Frase do envio que falhou (null = sem erro). No limite de envios é a do servidor.
  const [failed, setFailed] = useState<string | null>(null);

  // Passo 1 — o imóvel
  const [finalidade, setFinalidade] = useState('');
  const [tipo, setTipo] = useState('');
  const [negocio, setNegocio] = useState('');
  const [condominioNome, setCondominioNome] = useState('');
  const [condominioValor, setCondominioValor] = useState('');
  const [aceitaFinanciamento, setAceitaFinanciamento] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [areaTotal, setAreaTotal] = useState('');
  const [areaUtil, setAreaUtil] = useState('');
  const [dormitorios, setDormitorios] = useState('');
  const [suites, setSuites] = useState('');
  const [vagasCobertas, setVagasCobertas] = useState('');
  const [vagasDescobertas, setVagasDescobertas] = useState('');
  const [valorPretendido, setValorPretendido] = useState('');
  const [caracteristicas, setCaracteristicas] = useState('');

  // Passo 2 — quem está oferecendo
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [telefoneErr, setTelefoneErr] = useState(false);
  const [email, setEmail] = useState('');

  const tipoOptions = useMemo(
    // Sem rótulos repetidos (Cobertura, Terreno… aparecem com duas chaves).
    () => Object.entries(PROPERTY_TYPE_LABEL).filter(([, l], i, a) => a.findIndex(x => x[1] === l) === i).map(([v, l]) => [v, l] as [string, string]),
    [],
  );

  const page = site.anuncie;
  const waText = page?.whatsapp_text || 'Olá! Quero anunciar meu imóvel com vocês.';
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}?text=${encodeURIComponent(waText)}` : null;

  const goToOwner = (e: FormEvent) => {
    e.preventDefault();
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant || !nome.trim()) return;
    if (!isValidBrPhone(telefone)) { setTelefoneErr(true); return; }
    // Prévia do modelo: o servidor não sabe dela, então nada é enviado.
    if (ehPreviaDoModelo(site)) {
      setFailed(null);
      setEnviadoNaPrevia(true);
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSending(true);
    setFailed(null);
    try {
      const res = await fetch(`${API}/api/public/v1/site/anuncie`, {
        method: 'POST',
        headers: cabecalhosDoSite(tenant, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          lead: {
            name: nome.trim(), phone: telefone, email: email.trim() || null,
            source: 'site',
            form_data: {
              finalidade, tipo: tipo ? rotuloTipo(tipo) : '', negocio,
              endereco, condominio_nome: condominioNome, condominio_valor: condominioValor,
              area_total: areaTotal, area_util: areaUtil,
              dormitorios, suites,
              vagas_cobertas: vagasCobertas, vagas_descobertas: vagasDescobertas,
              aceita_financiamento: aceitaFinanciamento,
              valor_pretendido: valorPretendido,
              caracteristicas,
              proprietario_nome: nome.trim(),
              proprietario_telefone: telefone,
              proprietario_email: email.trim(),
            },
          },
        }),
      });
      if (!res.ok) {
        setFailed(await textoDoErroDeEnvio(res, TEXTO_FALHA_DE_ENVIO));
        return;
      }
      setEnviadoNaPrevia(ehPrevia(site) || (await envioFoiPrevia(res)));
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // A ficha é longa: some com ela e a pessoa não preenche de novo. O erro
      // aparece e o botão volta, com tudo o que ela escreveu no lugar.
      setFailed(TEXTO_FALHA_DE_ENVIO);
    } finally {
      setSending(false);
    }
  };

  return {
    step, setStep, sent, enviadoNaPrevia, sending, failed, goToOwner, submit, tipoOptions, page, waHref,
    finalidade, setFinalidade, tipo, setTipo, negocio, setNegocio, condominioNome, setCondominioNome,
    condominioValor, setCondominioValor, aceitaFinanciamento, setAceitaFinanciamento, endereco, setEndereco,
    areaTotal, setAreaTotal, areaUtil, setAreaUtil, dormitorios, setDormitorios, suites, setSuites,
    vagasCobertas, setVagasCobertas, vagasDescobertas, setVagasDescobertas, valorPretendido, setValorPretendido,
    caracteristicas, setCaracteristicas, nome, setNome, telefone, setTelefone, telefoneErr, setTelefoneErr, email, setEmail,
  };
}

export type FichaDoAnuncie = ReturnType<typeof useFichaDoAnuncie>;
