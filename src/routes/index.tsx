import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { isRootTenantHost } from '@/components/layout/config/menuItems';
import { lazyWithRetry } from '@/utils/chunkReload';
// Páginas do menu principal — declaradas em lazyPages.ts (não aqui) pra serem
// reaproveitadas pelo prefetch de rotas (idle warm-up) sem duplicar o import()
// dinâmico em outro arquivo. Ver src/routes/lazyPages.ts,
// src/utils/routePrefetch.ts, src/hooks/useRoutePrefetch.ts.
import {
  Dashboard,
  Contacts,
  ScheduledActions,
  Channels,
  ChatPage,
  Pipelines,
  Bolsao,
  BolsaoBatches,
  Disparos,
  TeamAccess,
  AccountSettings,
  Labels,
  CustomAttributes,
  SiteBuilder,
  Properties,
  CadastroDoImovel,
  GestaoDeProprietarios,
  FichaDoProprietario,
  Visits,
  Proposals,
  Contracts,
  PropertyInterests,
  AutomationsLayout,
  SalesAgents,
  PortalsList,
  DashboardAppPage,
  Tutorials,
  Marketplace,
} from './lazyPages';
import RedirecionaAssistente from '@/pages/Customer/Automations/SalesAgents/RedirecionaAssistente';
import PrivateRoute from './PrivateRoute';
import AcademiaRoute from './AcademiaRoute';
import PublicRoute from './PublicRoute';
import CustomerRoute from './CustomerRoute';
import SmartRedirect from './SmartRedirect';
import RouterGuard from '@/guards/RouterGuard';
import PermissionRoute from './PermissionRoute';
import GlobalEventTracker from '@/components/GlobalEventTracker';

import MainLayout from '@/components/layout/MainLayout';

// Páginas públicas
import Auth from '@/pages/Auth';
import SsoEntry from '@/pages/Auth/SsoEntry';
import AccessInvite from '@/pages/Auth/AccessInvite';
import EmailConfirmation from '@/components/auth/EmailConfirmation';
import ResetPassword from '@/components/auth/ResetPassword';
import InstagramCallback from '@/pages/InstagramCallback';
import GoogleCallback from '@/pages/GoogleCallback';
import GoogleCalendarCallback from '@/pages/GoogleCalendarCallback';
import GoogleSheetsCallback from '@/pages/GoogleSheetsCallback';
import GitHubCallback from '@/pages/GitHubCallback';
import NotionCallback from '@/pages/NotionCallback';
import StripeCallback from '@/pages/StripeCallback';
import LinearCallback from '@/pages/LinearCallback';
import MondayCallback from '@/pages/MondayCallback';
import AtlassianCallback from '@/pages/AtlassianCallback';
import MicrosoftCallback from '@/pages/MicrosoftCallback';
import SurveyResponse from '@/pages/Public/Survey/SurveyResponse';

// Páginas customer — lazy (code-splitting): cada página vira um chunk próprio,
// baixado só quando a rota é acessada. Reduz o bundle inicial (era ~7MB num arquivo).
// (Dashboard, Contacts, ScheduledActions, Channels, ChatPage, Pipelines, Disparos,
// TeamAccess, AccountSettings, Labels, CustomAttributes, SiteBuilder,
// Properties, Visits, Proposals, Contracts,
// PropertyInterests, AutomationsLayout, SalesAgents, PortalsList,
// DashboardAppPage, Tutorials, Marketplace — importadas de
// ./lazyPages, ver import acima.)
const SaasSignup = lazyWithRetry(() => import('@/pages/Auth/SaasSignup'));
const ChannelSettings = lazyWithRetry(() => import('@/pages/Customer/Channels').then(m => ({ default: m.ChannelSettings })));
const NewChannel = lazyWithRetry(() => import('@/pages/Customer/Channels').then(m => ({ default: m.NewChannel })));

const PipelineKanban = lazyWithRetry(() => import('@/pages/Customer/Pipelines/PipelineKanban'));
// Times e Cargos não têm mais rota própria: viraram abas da tela de Equipe, que
// os carrega junto. Só a sub-tela de adicionar gente a um Time continua com rota
// (é navegação interna da lista de Times).
const AddUsers = lazyWithRetry(() => import('@/pages/Customer/Settings/Teams').then(m => ({ default: m.AddUsers })));
const TemplateVariables = lazyWithRetry(() => import('@/pages/Customer/Settings/TemplateVariables').then(m => ({ default: m.TemplateVariables })));
const ConversationFunnels = lazyWithRetry(() => import('@/pages/Customer/Automations/MessageFunnels/ConversationFunnels'));
const FlowAutomationsList = lazyWithRetry(() => import('@/pages/Customer/Automations/FlowBuilder/FlowAutomationsList'));
const FlowAutomationCanvas = lazyWithRetry(() => import('@/pages/Customer/Automations/FlowBuilder/FlowAutomationCanvas'));
const Origem = lazyWithRetry(() => import('@/pages/Customer/Automations/Origem/Origem'));
const WelcomeAutomations = lazyWithRetry(() => import('@/pages/Customer/Settings/WelcomeAutomations').then(m => ({ default: m.WelcomeAutomations })));
const LeadAutomations = lazyWithRetry(() => import('@/pages/Customer/Settings/LeadAutomations').then(m => ({ default: m.LeadAutomations })));
const LeadAdsForms = lazyWithRetry(() => import('@/pages/Customer/Settings/LeadAdsForms'));
const LandingPageEditor = lazyWithRetry(() => import('@/pages/Customer/Properties/LandingPageEditor/LandingPageEditorPage'));
const LandingByIdEditor = lazyWithRetry(() => import('@/pages/Customer/Properties/LandingPageEditor/LandingByIdEditorPage'));
const SimulatorDemo = lazyWithRetry(() => import('@/pages/Customer/Properties/LandingPageEditor/SimulatorDemoPage'));
const LandingPublic = lazyWithRetry(() => import('@/pages/Public/LandingPublicPage'));
const LandingResult = lazyWithRetry(() => import('@/pages/Public/LandingResultPage'));
const ImovelPublic = lazyWithRetry(() => import('@/pages/Public/ImovelPublicPage'));
const PortalHome = lazyWithRetry(() => import('@/pages/Public/PortalHomePage'));
const PortalSearch = lazyWithRetry(() => import('@/pages/Public/PortalSearchPage'));
const PortalBlog = lazyWithRetry(() => import('@/pages/Public/PortalBlogPage'));
const PortalFinanciamento = lazyWithRetry(() => import('@/pages/Public/PortalFinanciamentoPage'));
const PortalAnuncie = lazyWithRetry(() => import('@/pages/Public/PortalAnunciePage'));
const PortalArticle = lazyWithRetry(() => import('@/pages/Public/PortalArticlePage'));
const PortalCustomPage = lazyWithRetry(() => import('@/pages/Public/PortalCustomPage'));
const PortalDetailPage = lazyWithRetry(() => import('../pages/Customer/Settings/Portals/PortalDetailPage'));
// Gate de rota da Área do Admin: só no deploy raiz (app.lmflow.com.br) E com
// acesso de admin (o dono por e-mail OU a equipe cadastrada, via whoami). Em
// subdomínio de cliente ou usuário comum, redireciona — defesa extra além do
// bloqueio server-side (401/403). Enquanto o whoami resolve (só pra não-dono),
// segura numa tela de carregando pra não chutar a equipe antes da hora.
function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAdminAccess();
  if (!isRootTenantHost()) return <Navigate to="/" replace />;
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Clientes → aba Clientes (a lista). As outras abas são rotas próprias desde 01/10/2026.
const PooledClients = lazyWithRetry(() => import('@/pages/SuperAdmin/PooledClients'));
const PushCentral = lazyWithRetry(() => import('@/pages/SuperAdmin/PushCentral'));
const Custos = lazyWithRetry(() => import('@/pages/SuperAdmin/Custos'));
// IA Vendedora → aba Agentes. As outras abas são rotas próprias desde 01/10/2026.
const SuperAgents = lazyWithRetry(() => import('@/pages/SuperAdmin/SuperAgents'));

// Área do Admin — shell próprio (AdminLayout), fora do menu do CRM.
const AdminLayout = lazyWithRetry(() => import('@/components/layout/AdminLayout'));
// Shell da área de membros (Academia do cliente) — sem o CRM em volta.
const MembersLayout = lazyWithRetry(() => import('@/components/layout/MembersLayout'));
const AdminAtencao = lazyWithRetry(() => import('@/pages/Admin/Area/VisaoGeral/Atencao'));
const AdminNumerosDaVisaoGeral = lazyWithRetry(() => import('@/pages/Admin/Area/VisaoGeral/Numeros'));
import AdminPaginaComAbas from '@/components/layout/AdminPaginaComAbas';
import AdminConteudo from '@/pages/Admin/Area/AdminConteudo';
import { ComAbaAntiga, RedirecionaComBusca } from '@/routes/AdminRedirecionamentos';
const AdminLeadsAoVivo = lazyWithRetry(() => import('@/pages/SuperAdmin/LeadsFeed'));
const AdminPacotes = lazyWithRetry(() => import('@/pages/SuperAdmin/PooledClients/Pacotes'));
const AdminPacoteEditor = lazyWithRetry(() => import('@/pages/SuperAdmin/PooledClients/Pacotes/Editor'));
const AdminClientePagina = lazyWithRetry(() => import('@/pages/SuperAdmin/PooledClients/Cliente/Pagina'));
const AdminNumeros = lazyWithRetry(() => import('@/pages/SuperAdmin/NumberOwnership'));
const AdminUsuarios = lazyWithRetry(() => import('@/pages/SuperAdmin/Usuarios'));
const AdminFichaDoUsuario = lazyWithRetry(() => import('@/pages/SuperAdmin/Usuarios/Ficha'));
const AdminLogs = lazyWithRetry(() => import('@/pages/SuperAdmin/Logs'));
const AdminMensagemDeAcesso = lazyWithRetry(() => import('@/pages/SuperAdmin/MensagemDeAcesso'));
const AdminAvisosNaTela = lazyWithRetry(() => import('@/pages/SuperAdmin/PushCentral/NotificationsTab'));
const AdminComunicadoWhatsapp = lazyWithRetry(() => import('@/pages/SuperAdmin/ComunicadoWhatsapp'));
const AdminMenusArquivados = lazyWithRetry(() => import('@/pages/SuperAdmin/PooledClients/ArchivedFeaturesView'));
const AdminSuporteLista = lazyWithRetry(() => import('@/pages/SuperAdmin/Suporte/SuporteLista'));
const AdminSuporteChamado = lazyWithRetry(() => import('@/pages/SuperAdmin/Suporte/SuporteChamado'));
const AdminIaDashboard = lazyWithRetry(() => import('@/pages/SuperAdmin/ResultadosIA'));
const AdminIaConhecimento = lazyWithRetry(() => import('@/pages/SuperAdmin/IaConhecimento'));
const AdminComparacaoIA = lazyWithRetry(() => import('@/pages/SuperAdmin/ComparacaoIA'));
const AdminAvisoDeVisita = lazyWithRetry(() => import('@/pages/SuperAdmin/AiVisitNoticeSection'));
const AdminEquipe = lazyWithRetry(() => import('@/pages/Admin/Area/Equipe'));
const AdminAcademia = lazyWithRetry(() => import('@/pages/Admin/Area/Academia'));
const AdminPlataforma = lazyWithRetry(() => import('@/pages/SuperAdmin/Plataforma'));
const AdminKitBoasVindas = lazyWithRetry(() => import('@/pages/SuperAdmin/KitBoasVindas'));
const AcceptLeadPage = lazyWithRetry(() => import('@/pages/Customer/Roleta/AcceptLeadPage'));
// Roleta: lista de roletas → página por roleta.
const RoletaLista = lazyWithRetry(() => import('@/pages/Customer/Roleta/RoletaLista'));
const RoletaPagina = lazyWithRetry(() => import('@/pages/Customer/Roleta/RoletaPagina'));
const AssignmentSettingsPage = lazyWithRetry(() => import('@/pages/Customer/Settings/AssignmentSettings/AssignmentSettings'));
const FacebookIntegracao = lazyWithRetry(() => import('@/pages/Customer/Settings/Integrations/FacebookIntegracao'));
const IntegracoesEntrada = lazyWithRetry(() => import('@/pages/Customer/Settings/Integrations/IntegracoesEntrada'));
const IntegracoesSistemas = lazyWithRetry(() => import('@/pages/Customer/Settings/Integrations/IntegracoesSistemas'));
const CvcrmConexao = lazyWithRetry(() => import('@/pages/Customer/Settings/Integrations/Cvcrm/CvcrmConexao'));
const Macros = lazyWithRetry(() => import('@/pages/Customer/Settings/Macros').then(m => ({ default: m.Macros })));
const WhatsappReminders = lazyWithRetry(() => import('@/pages/Customer/Settings/WhatsappReminders'));
const EmailTemplateEditor = lazyWithRetry(() => import('@/pages/Customer/Settings/EmailTemplateEditor'));
// import { Overview, Conversations } from '../pages/Customer/Reports';
// import * as Reports from '../pages/Customer/Reports';

// Área de membros (Academia) — experiência em tela cheia, sem o menu do app.
const AcademiaHomePage = lazyWithRetry(() => import('@/pages/Customer/Academia'));
const AcademiaCoursePage = lazyWithRetry(() => import('@/pages/Customer/Academia/CoursePage'));

// Páginas compartilhadas (Tutorials e Marketplace vêm de ./lazyPages, ver import acima)
const Documentation = lazyWithRetry(() => import('@/pages/Shared/Documentation'));
const Profile = lazyWithRetry(() => import('@/pages/Shared/Profile'));

// Página de setup inicial
import Setup from '@/pages/Setup/Setup';
import OnboardingPage from '@/pages/Setup/OnboardingPage';

// Outras páginas
import NotFound from '@/pages/NotFound';
import Unauthorized from '@/pages/Unauthorized';
import PaginaComAbas from '@/components/base/PaginaComAbas';
import MolduraDeIntegracao from '@/pages/Customer/Settings/Integrations/MolduraDeIntegracao';
// Widget é lazy: rota pública de embed em iframe que a esmagadora maioria das
// visitas nunca acessa — não faz sentido pesar o bundle inicial com ela. Já
// cai dentro do <Suspense> global do AppRouter.
const Widget = lazyWithRetry(() => import('@/pages/Widget'));
import AsanaCallback from '@/pages/AsanaCallback';
import HubSpotCallback from '@/pages/HubSpotCallback';
import PayPalCallback from '@/pages/PayPalCallback';
import CanvaCallback from '@/pages/CanvaCallback';
import SupabaseCallback from '@/pages/SupabaseCallback';
// import ChangePassword from '../pages/ChangePassword';

// Elemento da rota de Conversas (compartilhado entre /conversations e
// /conversations/:conversationId). Não tem mais MainLayout/PrivateRoute/CustomerRoute
// próprios — isso agora vem do layout persistente pai (grupo PrivateRoute+CustomerRoute).
const ChatRouteElement = (
  <PermissionRoute resource="conversations" action="read">
    <ChatPage />
  </PermissionRoute>
);

// Fallback padrão do Suspense compartilhado que envolve o <Outlet/> de cada
// grupo de layout persistente — só o CONTEÚDO pisca "Carregando...", nunca o
// menu/header, porque o MainLayout/AdminLayout já commitou fora desse Suspense.
const outletSuspenseFallback = (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const AppRouter = () => {
  return (
    <BrowserRouter>
      <RouterGuard>
        <GlobalEventTracker />
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen w-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          }
        >
        <Routes>
          {/* Redirecionamento inteligente da raiz baseado no tipo de usuário */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <SmartRedirect />
              </PrivateRoute>
            }
          />

          {/* Rotas públicas */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            }
          />

          {/* SaaS: entrada SSO 1-clique (super-admin -> CRM do cliente) */}
          <Route path="/sso" element={<SsoEntry />} />

          {/* Convite de acesso: a pessoa abre o link que recebeu no WhatsApp,
              cria a senha dela e já entra. Rota NUA (sem PublicRoute), como o
              /sso e o /espaco: quem já está logado em outra conta no mesmo
              aparelho precisa alcançar a tela, senão o convite parece morto. */}
          <Route path="/acesso" element={<AccessInvite />} />

          {/* SaaS: cadastro self-serve (apex lmflow.com.br) */}
          <Route
            path="/cadastro"
            element={
              <PublicRoute>
                <SaasSignup />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SaasSignup />
              </PublicRoute>
            }
          />

          <Route
            path="/auth/confirm-email"
            element={
              <PublicRoute>
                <EmailConfirmation />
              </PublicRoute>
            }
          />

          <Route
            path="/auth/confirmation"
            element={
              <PublicRoute>
                <EmailConfirmation />
              </PublicRoute>
            }
          />

          <Route
            path="/auth/reset-password"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />

          <Route
            path="/auth/password/edit"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />

          {/* Instagram OAuth Callback */}
          <Route
            path="/instagram/callback"
            element={
              <PublicRoute>
                <InstagramCallback />
              </PublicRoute>
            }
          />

          {/* Google OAuth Callback */}
          <Route
            path="/google/callback"
            element={
              <PublicRoute>
                <GoogleCallback />
              </PublicRoute>
            }
          />

          {/* Google Calendar OAuth Callback */}
          <Route
            path="/google-calendar/callback"
            element={
              <PublicRoute>
                <GoogleCalendarCallback />
              </PublicRoute>
            }
          />

          {/* Google Sheets OAuth Callback */}
          <Route
            path="/google-sheets/callback"
            element={
              <PublicRoute>
                <GoogleSheetsCallback />
              </PublicRoute>
            }
          />

          {/* GitHub OAuth Callback */}
          <Route
            path="/github/callback"
            element={
              <PublicRoute>
                <GitHubCallback />
              </PublicRoute>
            }
          />

          {/* Notion OAuth Callback */}
          <Route
            path="/notion/callback"
            element={
              <PublicRoute>
                <NotionCallback />
              </PublicRoute>
            }
          />

          {/* Stripe OAuth Callback */}
          <Route
            path="/stripe/callback"
            element={
              <PublicRoute>
                <StripeCallback />
              </PublicRoute>
            }
          />

          {/* Linear OAuth Callback */}
          <Route
            path="/linear/callback"
            element={
              <PublicRoute>
                <LinearCallback />
              </PublicRoute>
            }
          />

          {/* Monday OAuth Callback */}
          <Route
            path="/monday/callback"
            element={
              <PublicRoute>
                <MondayCallback />
              </PublicRoute>
            }
          />

          {/* Atlassian OAuth Callback */}
          <Route
            path="/atlassian/callback"
            element={
              <PublicRoute>
                <AtlassianCallback />
              </PublicRoute>
            }
          />

          {/* Asana OAuth Callback */}
          <Route
            path="/asana/callback"
            element={
              <PublicRoute>
                <AsanaCallback />
              </PublicRoute>
            }
          />

          {/* HubSpot OAuth Callback */}
          <Route
            path="/hubspot/callback"
            element={
              <PublicRoute>
                <HubSpotCallback />
              </PublicRoute>
            }
          />

          {/* PayPal OAuth Callback */}
          <Route
            path="/paypal/callback"
            element={
              <PublicRoute>
                <PayPalCallback />
              </PublicRoute>
            }
          />

          {/* Canva OAuth Callback */}
          <Route
            path="/canva/callback"
            element={
              <PublicRoute>
                <CanvaCallback />
              </PublicRoute>
            }
          />

          {/* Supabase OAuth Callback */}
          <Route
            path="/supabase/callback"
            element={
              <PublicRoute>
                <SupabaseCallback />
              </PublicRoute>
            }
          />

          {/* Microsoft OAuth Callback */}
          <Route
            path="/microsoft/callback"
            element={
              <PublicRoute>
                <MicrosoftCallback />
              </PublicRoute>
            }
          />

          {/* <Route path="/change-password" element={<ChangePassword />} /> */}

          {/* Public widget route (for website embeds) */}
          <Route
            path="/widget"
            element={
              <PublicRoute>
                <Widget />
              </PublicRoute>
            }
          />

          {/* Public survey response route (CSAT surveys) */}
          <Route
            path="/survey/responses/:uuid"
            element={
              <PublicRoute>
                <SurveyResponse />
              </PublicRoute>
            }
          />

          {/* Rota de Setup Inicial */}
          <Route path="/setup" element={<Setup />} />
          <Route path="/setup/onboarding" element={<OnboardingPage />} />

          {/*
            ===================================================================
            GRUPO A — PrivateRoute + CustomerRoute + MainLayout (persistente)
            ===================================================================
            Layout route pathless: UMA instância de MainLayout compartilhada
            por todas as rotas de cliente logado abaixo. Trocar de rota aqui
            dentro NÃO desmonta o MainLayout (menu/header) — só o conteúdo
            dentro do Suspense re-renderiza. Corrige o "flash" de reload
            completo que existia antes (MainLayout duplicado em cada Route).
          */}
          <Route
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <MainLayout>
                    <Suspense fallback={outletSuspenseFallback}>
                      <Outlet />
                    </Suspense>
                  </MainLayout>
                </CustomerRoute>
              </PrivateRoute>
            }
          >
            <Route
              path="/contacts"
              element={
                <PermissionRoute resource="contacts" action="read">
                  <Contacts />
                </PermissionRoute>
              }
            />

            <Route
              path="/contacts/:contactId"
              element={
                <PermissionRoute resource="contacts" action="read">
                  <Contacts />
                </PermissionRoute>
              }
            />

            <Route
              path="/contacts/scheduled-actions"
              element={
                <PermissionRoute resource="contacts" action="read">
                  <ScheduledActions />
                </PermissionRoute>
              }
            />

            <Route
              path="/pipelines"
              element={
                <PermissionRoute resource="pipelines" action="read">
                  <Pipelines />
                </PermissionRoute>
              }
            />

            {/* Bolsão — a lista de leads sem dono.
                Duas telas e dois cargos: /bolsao é do CORRETOR (ver e puxar) e
                /bolsao/listas é do GESTOR (subir planilha, regras, histórico).
                A rota mais específica vem primeiro; e o gate de cada uma tem que
                casar com o do menu, senão o corretor vê o item e cai em
                /unauthorized.
                Moldura sem endereço (fase 4): as duas viram abas da página
                Bolsão, lidas do item do menu — ver PaginaComAbas. */}
            <Route element={<PaginaComAbas />}>
              <Route
                path="/bolsao/listas"
                element={
                  <PermissionRoute resource="bolsao_batches" action="read">
                    <BolsaoBatches />
                  </PermissionRoute>
                }
              />

              <Route
                path="/bolsao"
                element={
                  <PermissionRoute resource="bolsao_leads" action="read">
                    <Bolsao />
                  </PermissionRoute>
                }
              />
            </Route>

            <Route
              path="/equipe"
              element={
                <PermissionRoute resource="users" action="update">
                  <TeamAccess />
                </PermissionRoute>
              }
            />

            {/* IA Vendedora — item de topo do CRM (URL própria). Antes vivia como
                sub-aba de Automações (/automations/sales-agents). */}
            <Route
              path="/ia-vendedora"
              element={
                <PermissionRoute resource="sales_agents" action="read">
                  <SalesAgents />
                </PermissionRoute>
              }
            />

            <Route
              path="/pipelines/:pipelineId"
              element={
                <PermissionRoute resource="pipelines" action="read">
                  <PipelineKanban />
                </PermissionRoute>
              }
            />

            <Route
              path="/disparos"
              element={
                <PermissionRoute resource="broadcasts" action="read">
                  <Disparos />
                </PermissionRoute>
              }
            />

            {/* Automações — aba única com submenu por setor (substitui os itens
                soltos que viviam em Configurações). As rotas /settings/* antigas
                continuam vivas para deep-links/compat. Já usava nested routes
                (padrão correto) — só perdeu o MainLayout próprio, que agora
                vem do grupo pai acima (evita duplicar). */}
            <Route path="/automations" element={<AutomationsLayout />}>
              {/* Funis de mensagem (Automações · sprint 4, 04/10/2026): os funis de
                  conversa do construtor (kind=conversation), sem abas internas. O
                  corretor entra pela chave message_funnels, que o servidor aceita em
                  /flow_automations pra fluxo kind=conversation. */}
              <Route
                path="message-funnels"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="message_funnels" action="read">
                      <ConversationFunnels />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="message-funnels/:id"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="message_funnels" action="read">
                      <FlowAutomationCanvas />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="flow-builder"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="flow_automations" action="read">
                      <FlowAutomationsList />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="flow-builder/:id"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="flow_automations" action="read">
                      <FlowAutomationCanvas />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="template-variables"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="canned_responses" action="read">
                      <TemplateVariables />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              {/* IA Vendedora saiu de Automações e virou item de topo /ia-vendedora.
                  Mantém redirect para não quebrar deep-links antigos. */}
              <Route path="sales-agents" element={<Navigate to="/ia-vendedora" replace />} />
              <Route
                path="origem"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="lead_ads_form_configs" action="read">
                      <Origem />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="lead-automations"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="lead_automation_rules" action="read">
                      <LeadAutomations />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="lead-ads-forms"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="lead_ads_form_configs" action="read">
                      <LeadAdsForms />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              {/* Follow-up (Automações · sprint 3, 03/10/2026): a mesma lista e o
                  mesmo canvas das Automações, com os fluxos de follow-up. O editor
                  de funil antigo saiu da tela. A chave continua followup_sequences:
                  o servidor aceita ela em /flow_automations pra fluxo kind=followup. */}
              <Route
                path="follow-ups"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="followup_sequences" action="read">
                      <FlowAutomationsList kind="followup" />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="follow-ups/:id"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="followup_sequences" action="read">
                      <FlowAutomationCanvas />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              {/* A tela "Follow-up automático" virou seção dentro de follow-ups. Mantém a
                  rota antiga redirecionando pra não quebrar link salvo/favoritado. */}
              <Route path="follow-up-auto" element={<Navigate to="/automations/follow-ups" replace />} />
              {/* O Robô Sem Resposta virou seção dentro de follow-ups pelo mesmo motivo:
                  ele e a chave de disparo decidem quem entra no funil, e separados uma
                  desligava a regra da outra em silêncio. */}
              <Route path="no-reply-robot" element={<Navigate to="/automations/follow-ups" replace />} />
              <Route
                path="whatsapp-reminders"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="whatsapp_reminders" action="read">
                      <WhatsappReminders />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              {/* A API já exige `roleta_configs.read` (PermissionRegistry deriva a
                  permissão por convenção). Sem o guard aqui o corretor abre a tela
                  e toma 403 em cada chamada, o que parece bug em vez de acesso
                  negado. */}
              {/* Lista de roletas (RoletaLista) → página da roleta (RoletaPagina). */}
              <Route
                path="roleta-config"
                element={
                  <PermissionRoute resource="roleta_configs" action="read">
                    <Suspense fallback={outletSuspenseFallback}>
                      <RoletaLista />
                    </Suspense>
                  </PermissionRoute>
                }
              />
              <Route
                path="roleta-config/:id"
                element={
                  <PermissionRoute resource="roleta_configs" action="read">
                    <Suspense fallback={outletSuspenseFallback}>
                      <RoletaPagina />
                    </Suspense>
                  </PermissionRoute>
                }
              />
              <Route
                path="assignment-settings"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <AssignmentSettingsPage />
                  </Suspense>
                }
              />
            </Route>

            {/* <Route
              path="/automation"
              element={
                <PermissionRoute resource="automations" action="read">
                  <Automation />
                </PermissionRoute>
              }
            />

            <Route
              path="/automation/:id/flow"
              element={
                <PermissionRoute resource="automations" action="update">
                  <AutomationFlowEditor />
                </PermissionRoute>
              }
            /> */}

            <Route
              path="/settings/account"
              element={
                <PermissionRoute resource="accounts" action="read">
                  <AccountSettings />
                </PermissionRoute>
              }
            />

            <Route
              path="/settings/teams/:teamId/add-users"
              element={
                <PermissionRoute resource="teams" action="create">
                  <AddUsers />
                </PermissionRoute>
              }
            />

            <Route
              path="/settings/labels"
              element={
                <PermissionRoute resource="labels" action="read">
                  <Labels />
                </PermissionRoute>
              }
            />

            {/* Campos personalizados (Atributos) e Variáveis de mensagem eram as abas
                de uma página (fase 4); desde a sprint 4 das Automações (04/10/2026)
                cada uma é item próprio de Minha imobiliária. A moldura fica: sem
                abas, ela não desenha nada. */}
            <Route element={<PaginaComAbas />}>
              <Route
                path="/settings/attributes"
                element={
                  <PermissionRoute resource="custom_attribute_definitions" action="read">
                    <CustomAttributes />
                  </PermissionRoute>
                }
              />
              <Route
                path="/settings/template-variables"
                element={
                  <PermissionRoute resource="canned_responses" action="read">
                    <TemplateVariables />
                  </PermissionRoute>
                }
              />
            </Route>

            {/* O editor de funis antigo saiu (Automações · sprint 4): o endereço leva
                pra página nova, com os funis de conversa. */}
            <Route path="/settings/message-funnels" element={<Navigate to="/automations/message-funnels" replace />} />

            {/* Fora da Fase 1 (Cargos): decisão do controlador, não protegida
                nesta task — ver relatório da task B4. */}
            <Route path="/settings/welcome-automations" element={<WelcomeAutomations />} />

            <Route
              path="/settings/lead-automations"
              element={
                <PermissionRoute resource="lead_automation_rules" action="read">
                  <LeadAutomations />
                </PermissionRoute>
              }
            />

            <Route
              path="/settings/lead-ads-forms"
              element={
                <PermissionRoute resource="lead_ads_form_configs" action="read">
                  <LeadAdsForms />
                </PermissionRoute>
              }
            />

            {/* O endereço antigo do Follow-up leva pra aba nova (sprint 3). */}
            <Route path="/settings/follow-ups" element={<Navigate to="/automations/follow-ups" replace />} />

            <Route
              path="/settings/site-builder"
              element={
                <PermissionRoute resource="sites" action="read">
                  <SiteBuilder />
                </PermissionRoute>
              }
            />

            <Route
              path="/settings/macros"
              element={
                <PermissionRoute resource="macros" action="read">
                  <Macros />
                </PermissionRoute>
              }
            />

            <Route
              path="/settings/whatsapp-reminders"
              element={
                <PermissionRoute resource="whatsapp_reminders" action="read">
                  <WhatsappReminders />
                </PermissionRoute>
              }
            />

            {/* Integrações em cartões (07/10/2026): a entrada tem um cartão por assunto
                (WhatsApp, Facebook, Portais, Sistemas) e as telas de dentro ficam na
                MolduraDeIntegracao (barra "← Integrações"), que substituiu as abas. Os
                endereços de antes continuam, cada um com a trava dele; a Página e o
                Pixel abrem a mesma tela (FacebookIntegracao). A entrada e Sistemas não
                têm trava própria: mostram o que sobrou no menu filtrado pelo cargo.
                As telas internas (portal aberto, número novo, ajustes do número)
                ficam fora: têm título e "voltar" próprios.
                A chave de Portais é `portals`, não `integrations` (backend A5,
                Fase 1 Cargos): integrations.* segue sendo repassada a quem já a
                tinha, mas a chave nova e específica é portals.read/update. */}
            <Route element={<MolduraDeIntegracao />}>
              <Route path="/settings/integrations" element={<IntegracoesEntrada />} />
              <Route path="/settings/integrations/sistemas" element={<IntegracoesSistemas />} />
              <Route
                path="/settings/facebook"
                element={
                  <PermissionRoute resource="lead_ads_form_configs" action="read">
                    <FacebookIntegracao />
                  </PermissionRoute>
                }
              />
              <Route
                path="/settings/pixel-capi"
                element={
                  <PermissionRoute resource="capi_configs" action="read">
                    <FacebookIntegracao />
                  </PermissionRoute>
                }
              />
              <Route
                path="/settings/portals"
                element={
                  <PermissionRoute resource="portals" action="read">
                    <PortalsList />
                  </PermissionRoute>
                }
              />
              {/* CVCRM (06/10/2026): a conexão que a IA usa pra cadastrar o lead no CVCRM do cliente. */}
              <Route
                path="/settings/cvcrm"
                element={
                  <PermissionRoute resource="integrations" action="read">
                    <CvcrmConexao />
                  </PermissionRoute>
                }
              />
              <Route
                path="/channels"
                element={
                  <PermissionRoute resource="channels" action="read">
                    <Channels />
                  </PermissionRoute>
                }
              />
            </Route>
            <Route
              path="/settings/portals/:portalKey"
              element={
                <PermissionRoute resource="portals" action="read">
                  <PortalDetailPage />
                </PermissionRoute>
              }
            />

            {/* Dynamic Dashboard Apps Routes */}
            <Route
              path="/dashboard-app/:appId"
              element={
                <PermissionRoute resource="integrations" action="read">
                  <DashboardAppPage />
                </PermissionRoute>
              }
            />

            {/* Reports Routes */}
            {/* <Route
              path="/reports/overview"
              element={
                <PermissionRoute resource="reports" action="read">
                  <Overview />
                </PermissionRoute>
              }
            />
            <Route
              path="/reports/conversations"
              element={
                <PermissionRoute resource="reports" action="read">
                  <Conversations />
                </PermissionRoute>
              }
            />
            <Route
              path="/reports/users"
              element={
                <PermissionRoute resource="reports" action="read">
                  <Reports.Agents />
                </PermissionRoute>
              }
            />
            <Route
              path="/reports/labels"
              element={
                <PermissionRoute resource="reports" action="read">
                  <Reports.Labels />
                </PermissionRoute>
              }
            /> */}
            <Route
              path="/bots"
              element={
                <PermissionRoute resource="bots" action="read">
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold mb-2">🤖 Bots</h2>
                      <p className="text-muted-foreground">Página em desenvolvimento</p>
                    </div>
                  </div>
                </PermissionRoute>
              }
            />

            <Route
              path="/channels/new"
              element={
                <PermissionRoute resource="channels" action="create">
                  <NewChannel />
                </PermissionRoute>
              }
            />

            {/*
              `read` e não `create`: desde 04/09/2026 o corretor abre o canal em
              que ELE atende, para ver o estado e religar o número lendo o QR
              code. Com `create` ele clicava no card e caía em /unauthorized —
              criar canal continua sendo do gestor, e a tela só desenha para ele
              o que o cargo dele alcança (ver ChannelSettings).
            */}
            <Route
              path="/channels/:id/settings"
              element={
                <PermissionRoute resource="channels" action="read">
                  <ChannelSettings />
                </PermissionRoute>
              }
            />

            <Route
              path="/settings/email-template-editor"
              element={
                <PermissionRoute resource="message_templates" action="create">
                  <EmailTemplateEditor />
                </PermissionRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <PermissionRoute resource="reports" action="read">
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold mb-2">📊 Relatórios</h2>
                      <p className="text-muted-foreground">Página em desenvolvimento</p>
                    </div>
                  </div>
                </PermissionRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <PermissionRoute resource="dashboard" action="read">
                  <Dashboard />
                </PermissionRoute>
              }
            />

            <Route path="/conversations" element={ChatRouteElement} />

            <Route path="/conversations/:conversationId" element={ChatRouteElement} />

            <Route
              path="/properties"
              element={
                <PermissionRoute resource="properties" action="read">
                  <Properties />
                </PermissionRoute>
              }
            />

            {/* A tela Books saiu (o book mora no cadastro do imóvel). Sem
                PermissionRoute: quem não vê imóveis cai na regra de /properties. */}
            <Route path="/books" element={<Navigate to="/properties" replace />} />

            <Route
              path="/properties/map"
              element={
                <PermissionRoute resource="properties" action="read">
                  <Navigate to="/properties?visao=mapa" replace />
                </PermissionRoute>
              }
            />

            {/* Cadastro de imóvel em página (era a janela da lista). O menu recolhe
                sozinho nas duas, como em Conversas (ROTA_RECOLHE_MENU). */}
            <Route
              path="/properties/new"
              element={
                <PermissionRoute resource="properties" action="create">
                  <CadastroDoImovel />
                </PermissionRoute>
              }
            />

            <Route
              path="/properties/:id/editar"
              element={
                <PermissionRoute resource="properties" action="update">
                  <CadastroDoImovel />
                </PermissionRoute>
              }
            />

            {/* Gestão de proprietários: a lista (com a aba Novas captações) e a
                ficha. O corretor só vê os proprietários liberados para ele
                (o servidor recorta; fora do recorte a ficha dá 404). */}
            <Route
              path="/property-owners"
              element={
                <PermissionRoute resource="properties" action="read">
                  <GestaoDeProprietarios />
                </PermissionRoute>
              }
            />

            <Route
              path="/property-owners/:id"
              element={
                <PermissionRoute resource="properties" action="read">
                  <FichaDoProprietario />
                </PermissionRoute>
              }
            />

            {/* A lista de landings virou aba do Site Builder (é uma página do
                site do cliente, e é lá que o site nasce). Rota antiga mantida
                como redirect pra não quebrar link salvo. */}
            <Route path="/landings" element={<Navigate to="/settings/site-builder?tab=landings" replace />} />

            <Route
              path="/visits"
              element={
                <PermissionRoute resource="visits" action="read">
                  <Visits />
                </PermissionRoute>
              }
            />

            <Route
              path="/proposals"
              element={
                <PermissionRoute resource="proposals" action="read">
                  <Proposals />
                </PermissionRoute>
              }
            />

            <Route
              path="/contracts"
              element={
                <PermissionRoute resource="contracts" action="read">
                  <Contracts />
                </PermissionRoute>
              }
            />

            <Route
              path="/property-capture-requests"
              element={
                <PermissionRoute resource="property_capture_requests" action="read">
                  <Navigate to="/property-owners?aba=captacoes" replace />
                </PermissionRoute>
              }
            />

            <Route
              path="/property-interests"
              element={
                <PermissionRoute resource="property_interests" action="read">
                  <PropertyInterests />
                </PermissionRoute>
              }
            />

            {/* Settings — roleta de corretores. Montagem antiga da mesma tela de
                /automations/roleta-config; faltava CustomerRoute e PermissionRoute,
                então dava para chegar nela digitando a URL. */}
            <Route
              path="/settings/roleta-config"
              element={
                <PermissionRoute resource="roleta_configs" action="read">
                  <Suspense fallback={outletSuspenseFallback}>
                    <RoletaLista />
                  </Suspense>
                </PermissionRoute>
              }
            />
          </Route>

          {/*
            ===================================================================
            GRUPO C — PrivateRoute + MainLayout (persistente, sem CustomerRoute)
            ===================================================================
          */}
          <Route
            element={
              <PrivateRoute>
                <MainLayout>
                  <Suspense fallback={outletSuspenseFallback}>
                    <Outlet />
                  </Suspense>
                </MainLayout>
              </PrivateRoute>
            }
          >
            {/* Rotas Compartilhadas */}
            <Route path="/documentation" element={<Documentation />} />

            <Route path="/marketplace" element={<Marketplace />} />

            <Route path="/profile" element={<Profile />} />
          </Route>

          {/*
            ===================================================================
            GRUPO D — PrivateRoute + SuperAdminRoute + AdminLayout (persistente)
            ===================================================================
            Área do Admin (Leal Mídia). Cada rota /admin/* montava o próprio
            AdminLayout — o MESMO bug de MainLayout duplicado, só que com o
            shell do admin: trocar entre Visão Geral / Clientes / IA Vendedora
            etc. desmontava e remontava o menu do admin inteiro a cada clique.
            Mesma correção: UMA instância de AdminLayout compartilhada.
          */}
          <Route
            element={
              <PrivateRoute>
                <SuperAdminRoute>
                  <AdminLayout>
                    <Suspense fallback={outletSuspenseFallback}>
                      <Outlet />
                    </Suspense>
                  </AdminLayout>
                </SuperAdminRoute>
              </PrivateRoute>
            }
          >
            <Route element={<AdminPaginaComAbas />}>
              {/* Visão Geral */}
              <Route path="/admin" element={<AdminConteudo><AdminAtencao /></AdminConteudo>} />
              <Route path="/admin/numeros" element={<AdminConteudo><AdminNumerosDaVisaoGeral /></AdminConteudo>} />
              <Route path="/admin/leads-ao-vivo" element={<AdminConteudo><AdminLeadsAoVivo /></AdminConteudo>} />
              {/* Suporte */}
              <Route path="/admin/suporte" element={<AdminConteudo><AdminSuporteLista /></AdminConteudo>} />
              <Route path="/admin/suporte/:id" element={<AdminConteudo><AdminSuporteChamado /></AdminConteudo>} />
              {/* Clientes */}
              <Route path="/admin/clientes" element={<ComAbaAntiga base="/admin/clientes"><AdminConteudo><PooledClients /></AdminConteudo></ComAbaAntiga>} />
              <Route path="/admin/clientes/numeros" element={<AdminConteudo><AdminNumeros /></AdminConteudo>} />
              {/* Custos: IA exata (registro de chamadas) + estrutura (Railway, Vercel,
                  Evolution) lançada à mão, numa tela só. */}
              <Route path="/admin/clientes/custos" element={<Custos />} />
              {/* Pacotes vêm ANTES de /admin/clientes/:id (senão "pacotes" viraria id de cliente). */}
              <Route path="/admin/clientes/pacotes" element={<AdminConteudo><AdminPacotes /></AdminConteudo>} />
              <Route path="/admin/clientes/pacotes/:id" element={<AdminConteudo><AdminPacoteEditor /></AdminConteudo>} />
              {/* Se este caminho mudar, mudar junto o `tambem` da aba Clientes em adminMenuItems.ts. */}
              <Route path="/admin/clientes/:id" element={<AdminConteudo><AdminClientePagina /></AdminConteudo>} />
              {/* Usuários */}
              {/* Lista e ficha já trazem o AdminConteudo (como o Custos): não embrulhar aqui. */}
              <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              {/* Se este caminho mudar, mudar junto o `tambem` da aba Usuários em adminMenuItems.ts. */}
              <Route path="/admin/usuarios/:tenant/:userId" element={<AdminFichaDoUsuario />} />
              <Route path="/admin/usuarios/logs" element={<AdminConteudo><AdminLogs /></AdminConteudo>} />
              <Route path="/admin/usuarios/mensagem-de-acesso" element={<AdminMensagemDeAcesso />} />
              {/* Comunicação */}
              <Route path="/admin/comunicacao" element={<AdminConteudo><AdminAvisosNaTela /></AdminConteudo>} />
              <Route path="/admin/push" element={<PushCentral />} />
              <Route path="/admin/comunicacao/whatsapp" element={<AdminComunicadoWhatsapp />} />
              {/* Plataforma */}
              <Route path="/admin/academia" element={<AdminAcademia />} />
              <Route path="/admin/plataforma" element={<AdminPlataforma />} />
              <Route path="/admin/plataforma/kit-boas-vindas" element={<AdminKitBoasVindas />} />
              <Route path="/admin/plataforma/menus-arquivados" element={<AdminConteudo><AdminMenusArquivados /></AdminConteudo>} />
              <Route path="/admin/plataforma/sugestoes-e-bugs" element={<Navigate to="/admin/suporte" replace />} />
              {/* IA Vendedora */}
              <Route path="/admin/agentes" element={<ComAbaAntiga base="/admin/agentes"><SuperAgents /></ComAbaAntiga>} />
              <Route path="/admin/agentes/dashboard" element={<AdminIaDashboard />} />
              <Route path="/admin/agentes/conhecimento" element={<AdminIaConhecimento />} />
              <Route path="/admin/agentes/aviso-de-visita" element={<AdminConteudo><AdminAvisoDeVisita /></AdminConteudo>} />
              <Route path="/admin/agentes/comparacao" element={<AdminComparacaoIA />} />
              {/* Equipe (sem abas: a moldura não desenha nada) */}
              <Route path="/admin/equipe" element={<AdminEquipe />} />
            </Route>
          </Route>

          {/*
            ===================================================================
            Rotas sem MainLayout — redirects e páginas sem layout de CRM.
            Ficam fora dos grupos acima (não têm layout persistente pra
            compartilhar). Ordem entre Routes não afeta o matching no v6
            (ranked, não first-match), então mover pra cá é seguro.
            ===================================================================
          */}

          {/* Cargos e Times passaram a ser ABAS da tela de Equipe — uma tela só
              manda em pessoas, cargo e instância. Estas rotas continuam vivas e
              redirecionam para a aba certa: link salvo, atalho de tour e texto de
              ajuda antigos não podem morrer. Mesmo padrão do Robô Sem Resposta →
              Follow-up, acima. */}
          <Route path="/settings/roles" element={<Navigate to="/equipe?aba=cargos" replace />} />
          <Route path="/settings/teams" element={<Navigate to="/equipe?aba=times" replace />} />
          <Route path="/settings/users" element={<Navigate to="/equipe" replace />} />

          {/* Rotas legadas — redirecionam pro novo módulo. Imports e páginas antigas ficam
              vivos durante a janela de migração (rake message_funnels:migrate_legacy copia o conteúdo). */}
          <Route
            path="/settings/canned-responses"
            element={<Navigate to="/settings/message-funnels" replace />}
          />
          <Route
            path="/settings/quick-replies"
            element={<Navigate to="/settings/message-funnels" replace />}
          />

          {/* Rotas específicas de canais foram integradas no fluxo unificado do NewChannel */}
          {/* Meta e WhatsApp Cloud agora são parte do componente NewChannel */}

          {/* Fluxo de aceite da roleta — tela cheia (link que o corretor recebe) */}
          <Route
            path="/roleta/aceite/:assignmentId"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <AcceptLeadPage />
                </CustomerRoute>
              </PrivateRoute>
            }
          />

          {/* Tutoriais */}
          <Route
            path="/tutorials"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  {/* Área de membros: shell próprio, sem o CRM em volta. O cliente
                      estuda numa tela limpa e volta pelo botão. */}
                  <MembersLayout>
                    <Tutorials />
                  </MembersLayout>
                </CustomerRoute>
              </PrivateRoute>
            }
          />

          {/* Área de membros (Academia) — experiência de curso em tela cheia */}
          <Route
            path="/academia"
            element={
              <AcademiaRoute>
                <AcademiaHomePage />
              </AcademiaRoute>
            }
          />
          <Route
            path="/academia/curso/:courseId"
            element={
              <AcademiaRoute>
                <AcademiaCoursePage />
              </AcademiaRoute>
            }
          />

          <Route
            path="/properties/:id/landing"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <LandingPageEditor />
                </CustomerRoute>
              </PrivateRoute>
            }
          />

          <Route
            path="/landings/:pageId"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <LandingByIdEditor />
                </CustomerRoute>
              </PrivateRoute>
            }
          />

          {/* O assistente da IA saiu na entrega 2 (o passo a passo do Configurar é
              o mesmo pra criar e editar). Endereço antigo cai no passo 1. */}
          <Route
            path="/ia-vendedora/:id/assistente"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <RedirecionaAssistente />
                </CustomerRoute>
              </PrivateRoute>
            }
          />

          {/* Editor de blocos da página do imóvel aposentado: vai para o Meu site. */}
          <Route
            path="/properties/template-imovel"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <Navigate to="/settings/site-builder" replace />
                </CustomerRoute>
              </PrivateRoute>
            }
          />

          <Route
            path="/simulador"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <SimulatorDemo />
                </CustomerRoute>
              </PrivateRoute>
            }
          />

          {/* Público (sem login) — landing de anúncio hospedada. */}
          <Route path="/lp/:tenant/:slug" element={<LandingPublic />} />
          <Route path="/lp/:tenant/:slug/:result" element={<LandingResult />} />

          {/* Formulários de onboarding saíram em 01/10/2026 (ninguém usava). Link
              público antigo cai na entrada do app. As respostas ficam no banco. */}
          <Route path="/formulario/*" element={<Navigate to="/" replace />} />

          {/* O Espaço saiu do CRM em 30/09/2026 (fase 4: ninguém usava). Link
              salvo ou compartilhado (/espaco e /espaco/:token) cai no início.
              As tabelas espaco_* continuam no banco, intactas. */}
          <Route path="/espaco/*" element={<Navigate to="/" replace />} />

          {/* Público INDEXÁVEL — página de imóvel do portal (Produto A). */}
          <Route path="/imovel/:tenant/:code" element={<ImovelPublic />} />

          {/* Público INDEXÁVEL — home/listagem de imóveis do portal. */}
          <Route path="/portal/:tenant" element={<PortalHome />} />

          {/* Público — página dedicada de busca/filtros de imóveis do portal. */}
          <Route path="/portal/:tenant/imoveis" element={<PortalSearch />} />

          {/* Público INDEXÁVEL — as duas páginas extras do portal. Elas existem
              sempre; quem decide se aparecem no menu (e se respondem de verdade)
              é a configuração do site, no Site Builder. O gate fica na PÁGINA,
              nunca na rota — o padrão da casa. */}
          <Route path="/portal/:tenant/financiamento" element={<PortalFinanciamento />} />
          <Route path="/portal/:tenant/anuncie" element={<PortalAnuncie />} />

          {/* Público INDEXÁVEL — blog do portal (listagem + artigo). */}
          <Route path="/portal/:tenant/blog" element={<PortalBlog />} />
          <Route path="/portal/:tenant/blog/:slug" element={<PortalArticle />} />
          <Route path="/portal/:tenant/p/:slug" element={<PortalCustomPage />} />

          {/* Endereços antigos da Área do Admin (reorganizações de 19/08 e
              01/10/2026). Continuam vivos pra não quebrar link salvo. */}
          <Route path="/admin/modo-cliente" element={<Navigate to="/admin/clientes" replace />} />
          <Route path="/admin/formularios" element={<Navigate to="/admin/clientes" replace />} />
          <Route path="/admin/sugestoes-bugs" element={<Navigate to="/admin/suporte" replace />} />
          <Route path="/admin/atividade" element={<Navigate to="/admin/usuarios/logs" replace />} />
          <Route path="/admin/auditoria" element={<Navigate to="/admin/usuarios/logs" replace />} />
          <Route path="/admin/uso" element={<RedirecionaComBusca para="/admin/usuarios" />} />
          <Route path="/admin/custo-ia" element={<Navigate to="/admin/clientes/custos" replace />} />
          <Route path="/admin/cerebro" element={<Navigate to="/admin/agentes/conhecimento" replace />} />
          <Route path="/admin/aperfeicoamento" element={<Navigate to="/admin/agentes/conhecimento" replace />} />
          <Route path="/admin/resultados-ia" element={<Navigate to="/admin/agentes/dashboard" replace />} />
          {/* Biblioteca de Automações excluída (19/08/2026) — sem uso real, era
              redundante com o modal de biblioteca que o cliente já tem em
              Automações. Bookmark antigo cai na Visão Geral. */}
          <Route path="/admin/biblioteca" element={<Navigate to="/admin" replace />} />

          {/* Rotas antigas: mantidas como redirect pra não quebrar link salvo/bookmark. */}
          <Route path="/super-admin/pooled-clients" element={<Navigate to="/admin/clientes" replace />} />
          <Route path="/super-admin/automation-templates" element={<Navigate to="/admin" replace />} />

          {/* A tela antiga de instâncias (modelo de junho, com "revelar senha")
              saiu em 01/10/2026. Os dois endereços dela levam pra Clientes. */}
          <Route path="/super-admin/clients" element={<Navigate to="/admin/clientes" replace />} />
          <Route path="/super-admin/clientes" element={<Navigate to="/admin/clientes" replace />} />

          {/* /super-admin/automation-templates e /super-admin/pooled-clients viraram
              redirects pra /admin/* (declarados acima). */}

          {/* Rota 403 - Sem permissão */}
          <Route
            path="/unauthorized"
            element={
              <PrivateRoute>
                <Unauthorized />
              </PrivateRoute>
            }
          />

          {/* Rota 404 - Página não encontrada */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </RouterGuard>
    </BrowserRouter>
  );
};

export default AppRouter;
