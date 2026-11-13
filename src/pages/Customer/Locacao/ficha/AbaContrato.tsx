import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSignature, Printer, RotateCcw, Save } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { locacaoService } from '@/features/locacao/locacaoService';
import { CLASSES_DO_CONTRATO, contarLacunas, contratoDoc, imovelCurto, nomeDoArquivo } from '@/features/locacao/contratoDoc';
import { htmlSeguro } from '@/lib/htmlSeguro';
import { ctBlocos } from '@/features/locacao/ctBlocos';
import type { Contrato, PessoaQualificada, Qualificacao } from '@/features/locacao/tipos';
import { Falha, Titulo } from '../comum';
import { useCarga } from '../usoComum';
import './documento.css';

const STATUS_DA_ASSINATURA: Record<string, string> = {
  pending: 'Esperando as assinaturas',
  signed: 'Assinado por todos',
  rejected: 'Recusado',
  canceled: 'Cancelado',
};

function PessoaCampos({ prefixo, rotulo, valor, aoMudar }: { prefixo: string; rotulo: string; valor: PessoaQualificada; aoMudar: (v: PessoaQualificada) => void }) {
  return (
    <>
      <CampoDaJanela rotulo={`${rotulo}: nacionalidade, estado civil, profissão`} htmlFor={`${prefixo}-qual`} colunas={2}>
        <Input id={`${prefixo}-qual`} placeholder="Ex.: brasileiro, casado, empresário" value={valor.qual ?? ''} onChange={e => aoMudar({ ...valor, qual: e.target.value })} />
      </CampoDaJanela>
      <CampoDaJanela rotulo={`${rotulo}: RG`} htmlFor={`${prefixo}-rg`}>
        <Input id={`${prefixo}-rg`} value={valor.rg ?? ''} onChange={e => aoMudar({ ...valor, rg: e.target.value })} />
      </CampoDaJanela>
      <CampoDaJanela rotulo={`${rotulo}: endereço`} htmlFor={`${prefixo}-end`} colunas={4}>
        <Input id={`${prefixo}-end`} value={valor.end ?? ''} onChange={e => aoMudar({ ...valor, end: e.target.value })} />
      </CampoDaJanela>
    </>
  );
}

export default function AbaContrato({ contrato: c, aoMudar }: { contrato: Contrato; aoMudar: (c: Contrato) => void }) {
  const { dados: cfg, erro, recarregar } = useCarga(() => locacaoService.config(), 'config');
  const folha = useRef<HTMLDivElement>(null);
  const [qual, setQual] = useState<Qualificacao>(c.qualificacao ?? {});
  const [lacunas, setLacunas] = useState(0);
  const [editou, setEditou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const qualOriginal = useMemo(() => JSON.stringify(c.qualificacao ?? {}), [c.qualificacao]);
  const mexeuQual = JSON.stringify(qual) !== qualOriginal;

  const pintar = useCallback((html: string) => {
    if (!folha.current) return;
    // Texto salvo é escrito pela equipe (qualquer cargo que edita o contrato):
    // passa pelo limpador, mantendo só as classes que o documento usa.
    folha.current.innerHTML = htmlSeguro(html, { classes: CLASSES_DO_CONTRATO });
    setLacunas(contarLacunas(html));
    setEditou(false);
  }, []);

  // Primeira carga: o texto salvo, ou o que sai do cadastro quando ainda não existe.
  useEffect(() => {
    if (!cfg) return;
    pintar(c.documento_html || contratoDoc({ ...c, qualificacao: qual }, cfg));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só repinta ao carregar a config ou trocar o contrato
  }, [cfg, c.id]);

  if (erro) return <Falha erro={erro} aoTentar={recarregar} />;
  if (!cfg) return <Carregando linhas={6} rotulo="Montando o contrato…" />;

  const aoDigitar = () => {
    setEditou(true);
    setLacunas(contarLacunas(folha.current?.innerHTML ?? ''));
  };

  const refazer = async () => {
    if (editou || c.documento_html) {
      const ok = await confirmar({
        titulo: 'Refazer o texto do contrato',
        descricao: 'O texto volta a ser montado a partir do cadastro e o que foi escrito à mão se perde.',
        rotuloDaAcao: 'Refazer o texto',
        destrutivo: true,
      });
      if (!ok) return;
    }
    pintar(contratoDoc({ ...c, qualificacao: qual }, cfg));
    setEditou(true);
  };

  const salvar = async () => {
    if (!folha.current) return;
    setSalvando(true);
    try {
      let atual = c;
      if (mexeuQual) atual = await locacaoService.salvarContrato(c.id, { qualificacao: qual });
      atual = await locacaoService.salvarDocumento(c.id, folha.current.innerHTML, ctBlocos(folha.current));
      aoMudar(atual);
      setEditou(false);
      toast.success('Contrato salvo.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra salvar o contrato.'));
    } finally {
      setSalvando(false);
    }
  };

  const baixarWord = async () => {
    setBaixando(true);
    try {
      if (editou && folha.current) await locacaoService.salvarDocumento(c.id, folha.current.innerHTML, ctBlocos(folha.current));
      const blob = await locacaoService.baixarDocx(c.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nomeDoArquivo(imovelCurto(c.imovel_descricao))}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setEditou(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra gerar o arquivo do Word.'));
    } finally {
      setBaixando(false);
    }
  };

  const enviar = async () => {
    if (lacunas > 0) {
      toast.error(`Ainda faltam ${lacunas} ${lacunas === 1 ? 'campo' : 'campos'} em amarelo. Preencha antes de enviar.`);
      return;
    }
    const ok = await confirmar({
      titulo: 'Enviar para assinatura',
      descricao: `O contrato vai para ${c.proprietario_nome} e ${c.inquilino_nome} assinarem pelo celular ou computador.`,
      rotuloDaAcao: 'Enviar para assinatura',
    });
    if (!ok) return;
    setEnviando(true);
    try {
      if (folha.current) await locacaoService.salvarDocumento(c.id, folha.current.innerHTML, ctBlocos(folha.current));
      aoMudar(await locacaoService.enviarParaAssinatura(c.id));
      setEditou(false);
      toast.success('Contrato enviado para assinatura.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra enviar para assinatura.'));
    } finally {
      setEnviando(false);
    }
  };

  const statusAssinatura = c.autentique_document_status ? STATUS_DA_ASSINATURA[c.autentique_document_status] ?? c.autentique_document_status : null;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 locacao-fora-da-impressao">
        <Titulo>Dados que o cadastro não tem</Titulo>
        <Card className="gap-4 p-4">
          <GradeDaJanela>
            <PessoaCampos prefixo="q-prop" rotulo="Proprietário" valor={qual.prop ?? {}} aoMudar={v => setQual({ ...qual, prop: v })} />
            <PessoaCampos prefixo="q-inq" rotulo="Inquilino" valor={qual.inq ?? {}} aoMudar={v => setQual({ ...qual, inq: v })} />
            <CampoDaJanela rotulo="Cidade do contrato" htmlFor="q-cidade">
              <Input id="q-cidade" value={qual.cidade ?? ''} onChange={e => setQual({ ...qual, cidade: e.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Matrícula do imóvel" htmlFor="q-matricula">
              <Input id="q-matricula" value={qual.matricula ?? ''} onChange={e => setQual({ ...qual, matricula: e.target.value })} />
            </CampoDaJanela>
            <CampoDaJanela rotulo="Complemento do endereço" htmlFor="q-compl">
              <Input id="q-compl" value={qual.compl ?? ''} onChange={e => setQual({ ...qual, compl: e.target.value })} />
            </CampoDaJanela>
            {c.garantia.tipo === 'fianca' && (
              <CampoDaJanela rotulo="Fiador (nome completo e documento)" htmlFor="q-fiador">
                <Input id="q-fiador" value={qual.fiador ?? ''} onChange={e => setQual({ ...qual, fiador: e.target.value })} />
              </CampoDaJanela>
            )}
          </GradeDaJanela>
          {mexeuQual && (
            <Aviso tom="info" compacto acao={<Button size="sm" variant="outline" onClick={() => void refazer()}>Refazer o texto com estes dados</Button>}>
              Você mudou os dados. O texto abaixo só os usa depois de refeito.
            </Aviso>
          )}
        </Card>
      </section>

      <section className="grid gap-3">
        <Titulo
          acao={(
            <div className="locacao-fora-da-impressao flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void refazer()}><RotateCcw className="mr-1 h-4 w-4" />Refazer</Button>
              <Button size="sm" variant="outline" disabled={baixando} onClick={() => void baixarWord()}><Download className="mr-1 h-4 w-4" />Baixar em Word</Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Baixar em PDF</Button>
              <Button size="sm" variant="outline" disabled={salvando || !(editou || mexeuQual)} onClick={() => void salvar()}><Save className="mr-1 h-4 w-4" />Salvar</Button>
              <Button size="sm" disabled={enviando} onClick={() => void enviar()}><FileSignature className="mr-1 h-4 w-4" />Enviar para assinatura</Button>
            </div>
          )}
        >
          Contrato
        </Titulo>

        <div className="locacao-fora-da-impressao grid gap-2">
          {statusAssinatura && <Aviso tom={c.autentique_document_status === 'signed' ? 'sucesso' : 'info'} compacto>{statusAssinatura}.</Aviso>}
          {lacunas > 0 ? (
            <Aviso tom="atencao" compacto>
              {lacunas === 1 ? 'Falta 1 campo' : `Faltam ${lacunas} campos`} em amarelo. Clique no texto e escreva por cima, ou preencha os dados acima e refaça o texto.
            </Aviso>
          ) : (
            <Aviso tom="sucesso" compacto>Nenhum campo em branco. Você pode clicar em qualquer parte do texto para editar.</Aviso>
          )}
        </div>

        <div
          ref={folha}
          className="locacao-documento"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Texto do contrato"
          onInput={aoDigitar}
        />
      </section>
      {dialogoDeConfirmacao}
    </div>
  );
}
