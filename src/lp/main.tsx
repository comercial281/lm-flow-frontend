/**
 * Entrada ENXUTA da landing de anúncio (/lp/:tenant/:slug e as páginas de
 * resultado). Servida pelo `lp.html`, para onde o Vercel manda todo /lp/*.
 *
 * POR QUE ISTO EXISTE
 * A landing morava dentro do app do CRM: quem abria o anúncio no celular
 * baixava o CRM inteiro (mais de 1 MB de código, 370 KB de estilo, três
 * famílias de fonte, o service worker, o i18n, o Sentry) antes de a página
 * sequer pedir o conteúdo dela ao servidor. PageSpeed 52 no celular, e é o
 * caminho por onde a verba de anúncio entra.
 *
 * Aqui entra SÓ o que a landing usa: React, os blocos da landing e o estilo
 * deles. Sem roteador (o caminho é lido à mão), sem contextos do CRM, sem
 * service worker. O conteúdo é pedido ainda no HTML (ver lp.html) e consumido
 * por `landingLoader`.
 *
 * ARMADILHA: não importar nada de `@/components/layout`, `@/contexts`,
 * `@/services` ou do design system aqui — cada import desses puxa o CRM de
 * volta pro pacote da landing, e o defeito é MUDO (a página continua
 * funcionando, só volta a ser lenta). O spec `lpEntry.spec.ts` confere o
 * tamanho do que sai no build.
 */
import { createRoot } from 'react-dom/client';
import './lp.css';
import { LandingApp } from './LandingApp';

createRoot(document.getElementById('root')!).render(<LandingApp />);
