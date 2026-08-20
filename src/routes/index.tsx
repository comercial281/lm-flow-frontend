import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
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
  Disparos,
  TeamAccess,
  AccountSettings,
  Labels,
  CustomAttributes,
  SiteBuilder,
  Properties,
  PropertyBooks,
  Visits,
  Proposals,
  Contracts,
  PropertyCaptureRequests,
  PropertyInterests,
  AutomationsLayout,
  SalesAgents,
  PortalsList,
  DashboardAppPage,
  Tutorials,
  Marketplace,
  Espaco,
} from './lazyPages';
import PrivateRoute from './PrivateRoute';
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
// Properties, PropertyBooks, Visits, Proposals, Contracts, PropertyCaptureRequests,
// PropertyInterests, AutomationsLayout, SalesAgents, PortalsList,
// DashboardAppPage, Tutorials, Marketplace, Espaco — importadas de
// ./lazyPages, ver import acima.)
const SaasSignup = lazyWithRetry(() => import('@/pages/Auth/SaasSignup'));
const ChannelSettings = lazyWithRetry(() => import('@/pages/Customer/Channels').then(m => ({ default: m.ChannelSettings })));
const NewChannel = lazyWithRetry(() => import('@/pages/Customer/Channels').then(m => ({ default: m.NewChannel })));

const PipelineKanban = lazyWithRetry(() => import('@/pages/Customer/Pipelines/PipelineKanban'));
const PropertiesMap = lazyWithRetry(() => import('@/pages/Customer/Properties').then(m => ({ default: m.PropertiesMap })));
// Times e Cargos não têm mais rota própria: viraram abas da tela de Equipe, que
// os carrega junto. Só a sub-tela de adicionar gente a um Time continua com rota
// (é navegação interna da lista de Times).
const AddUsers = lazyWithRetry(() => import('@/pages/Customer/Settings/Teams').then(m => ({ default: m.AddUsers })));
const MessageFunnels = lazyWithRetry(() => import('@/pages/Customer/Settings/MessageFunnels').then(m => ({ default: m.MessageFunnels })));
const TemplateVariables = lazyWithRetry(() => import('@/pages/Customer/Settings/TemplateVariables').then(m => ({ default: m.TemplateVariables })));
const EditorDeFunis = lazyWithRetry(() => import('@/pages/Customer/Automations/EditorDeFunis/EditorDeFunis'));
const Origem = lazyWithRetry(() => import('@/pages/Customer/Automations/Origem/Origem'));
const WelcomeAutomations = lazyWithRetry(() => import('@/pages/Customer/Settings/WelcomeAutomations').then(m => ({ default: m.WelcomeAutomations })));
const LeadAutomations = lazyWithRetry(() => import('@/pages/Customer/Settings/LeadAutomations').then(m => ({ default: m.LeadAutomations })));
const LeadAdsForms = lazyWithRetry(() => import('@/pages/Customer/Settings/LeadAdsForms'));
const FollowupSequences = lazyWithRetry(() => import('@/pages/Customer/Settings/FollowupSequences').then(m => ({ default: m.FollowupSequences })));
const LandingPageEditor = lazyWithRetry(() => import('@/pages/Customer/Properties/LandingPageEditor/LandingPageEditorPage'));
const LandingByIdEditor = lazyWithRetry(() => import('@/pages/Customer/Properties/LandingPageEditor/LandingByIdEditorPage'));
const LandingsList = lazyWithRetry(() => import('@/pages/Customer/Properties/LandingPageEditor/LandingsListPage'));
const PropertyTemplateEditor = lazyWithRetry(() => import('@/pages/Customer/Properties/PropertyTemplateEditor/PropertyTemplateEditorPage'));
const SimulatorDemo = lazyWithRetry(() => import('@/pages/Customer/Properties/LandingPageEditor/SimulatorDemoPage'));
const LandingPublic = lazyWithRetry(() => import('@/pages/Public/LandingPublicPage'));
const LandingResult = lazyWithRetry(() => import('@/pages/Public/LandingResultPage'));
const ImovelPublic = lazyWithRetry(() => import('@/pages/Public/ImovelPublicPage'));
const PortalHome = lazyWithRetry(() => import('@/pages/Public/PortalHomePage'));
const PortalSearch = lazyWithRetry(() => import('@/pages/Public/PortalSearchPage'));
const PortalBlog = lazyWithRetry(() => import('@/pages/Public/PortalBlogPage'));
const PortalArticle = lazyWithRetry(() => import('@/pages/Public/PortalArticlePage'));
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

// Wrapper da rota pública do Espaço: lê o :token da URL e monta o módulo em
// modo público. Suspense próprio porque Espaco é lazy.
function EspacoPublicRoute() {
  const { token } = useParams<{ token: string }>();
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen w-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <Espaco mode="public" token={token} />
    </Suspense>
  );
}

const ClientInstances = lazyWithRetry(() => import('@/pages/SuperAdmin/ClientInstances'));
// Clientes, Leads ao Vivo, Modo Cliente, Formulários, Sugestões/Bugs e
// Atividade viraram abas DENTRO do PooledClients — só ele é rota.
const PooledClients = lazyWithRetry(() => import('@/pages/SuperAdmin/PooledClients'));
const PushCentral = lazyWithRetry(() => import('@/pages/SuperAdmin/PushCentral'));
const CustoIA = lazyWithRetry(() => import('@/pages/SuperAdmin/CustoIA'));
// Agentes, Cérebro Universal, Resultados e Aperfeiçoamento viraram abas
// DENTRO do SuperAgents (IA Vendedora) — só ele é rota.
const SuperAgents = lazyWithRetry(() => import('@/pages/SuperAdmin/SuperAgents'));
const PublicOnboardingForm = lazyWithRetry(() => import('@/pages/PublicOnboardingForm'));

// Área do Admin — shell próprio (AdminLayout), fora do menu do CRM.
const AdminLayout = lazyWithRetry(() => import('@/components/layout/AdminLayout'));
// Shell da área de membros (Academia do cliente) — sem o CRM em volta.
const MembersLayout = lazyWithRetry(() => import('@/components/layout/MembersLayout'));
const AdminOverview = lazyWithRetry(() => import('@/pages/Admin/Area/Overview'));
const AdminUso = lazyWithRetry(() => import('@/pages/Admin/Area/Uso'));
const AdminEquipe = lazyWithRetry(() => import('@/pages/Admin/Area/Equipe'));
const AdminAcademia = lazyWithRetry(() => import('@/pages/Admin/Area/Academia'));
const RoletaConfigPage = lazyWithRetry(() => import('@/pages/Customer/Settings/RoletaConfig/RoletaConfig'));
const AcceptLeadPage = lazyWithRetry(() => import('@/pages/Customer/Roleta/AcceptLeadPage'));
const AssignmentSettingsPage = lazyWithRetry(() => import('@/pages/Customer/Settings/AssignmentSettings/AssignmentSettings'));
const PixelCapiConfig = lazyWithRetry(() => import('@/pages/Customer/Automations/PixelCapi/PixelCapiConfig'));
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
            <Route path="/ia-vendedora" element={<SalesAgents />} />

            <Route
              path="/pipelines/:pipelineId"
              element={
                <PermissionRoute resource="pipelines" action="read">
                  <PipelineKanban />
                </PermissionRoute>
              }
            />

            <Route path="/disparos" element={<Disparos />} />

            {/* Automações — aba única com submenu por setor (substitui os itens
                soltos que viviam em Configurações). As rotas /settings/* antigas
                continuam vivas para deep-links/compat. Já usava nested routes
                (padrão correto) — só perdeu o MainLayout próprio, que agora
                vem do grupo pai acima (evita duplicar). */}
            <Route path="/automations" element={<AutomationsLayout />}>
              <Route
                path="message-funnels"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <PermissionRoute resource="canned_responses" action="read">
                      <EditorDeFunis />
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
                    <PermissionRoute resource="canned_responses" action="read">
                      <Origem />
                    </PermissionRoute>
                  </Suspense>
                }
              />
              <Route
                path="lead-automations"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <LeadAutomations />
                  </Suspense>
                }
              />
              <Route
                path="lead-ads-forms"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <LeadAdsForms />
                  </Suspense>
                }
              />
              <Route
                path="follow-ups"
                element={
                  <Suspense fallback={outletSuspenseFallback}>
                    <FollowupSequences />
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
                    <WhatsappReminders />
                  </Suspense>
                }
              />
              {/* A API já exige `roleta_configs.read` (PermissionRegistry deriva a
                  permissão por convenção). Sem o guard aqui o corretor abre a tela
                  e toma 403 em cada chamada, o que parece bug em vez de acesso
                  negado. */}
              <Route
                path="roleta-config"
                element={
                  <PermissionRoute resource="roleta_configs" action="read">
                    <Suspense fallback={outletSuspenseFallback}>
                      <RoletaConfigPage />
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

            <Route
              path="/settings/attributes"
              element={
                <PermissionRoute resource="custom_attribute_definitions" action="read">
                  <CustomAttributes />
                </PermissionRoute>
              }
            />

            {/* Novo módulo unificado — Funis de Mensagem (substitui Prontas + Rápidas) */}
            <Route
              path="/settings/message-funnels"
              element={
                <PermissionRoute resource="canned_responses" action="read">
                  <MessageFunnels />
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

            <Route path="/settings/welcome-automations" element={<WelcomeAutomations />} />

            <Route path="/settings/lead-automations" element={<LeadAutomations />} />

            <Route path="/settings/lead-ads-forms" element={<LeadAdsForms />} />

            <Route path="/settings/follow-ups" element={<FollowupSequences />} />

            <Route path="/settings/site-builder" element={<SiteBuilder />} />

            <Route
              path="/settings/macros"
              element={
                <PermissionRoute resource="macros" action="read">
                  <Macros />
                </PermissionRoute>
              }
            />

            <Route path="/settings/whatsapp-reminders" element={<WhatsappReminders />} />

            {/* Pixel/CAPI mora agora em Configurações, não em Automações — não usa mais
                o layout com submenu de setores. Filha simples de Grupo A: já herda
                PrivateRoute+CustomerRoute+MainLayout do pai, sem guards próprios. */}
            <Route path="/settings/pixel-capi" element={<PixelCapiConfig />} />

            <Route
              path="/settings/portals"
              element={
                <PermissionRoute resource="integrations" action="read">
                  <PortalsList />
                </PermissionRoute>
              }
            />
            <Route
              path="/settings/portals/:portalKey"
              element={
                <PermissionRoute resource="integrations" action="read">
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
              path="/channels"
              element={
                <PermissionRoute resource="channels" action="read">
                  <Channels />
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

            <Route
              path="/channels/:id/settings"
              element={
                <PermissionRoute resource="channels" action="create">
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

            {/* Espaço — Notion por tenant (usuário logado). Sem gate de permissão:
                QUALQUER staff logado do tenant acessa (decisão do Giovani). O
                controle fino (pausar / visibilidade por seção / links) fica na aba
                Gerir, que só aparece pra admin (role do backend). */}
            <Route path="/espaco" element={<Espaco mode="auth" />} />

            <Route path="/conversations" element={ChatRouteElement} />

            <Route path="/conversations/:conversationId" element={ChatRouteElement} />

            <Route path="/properties" element={<Properties />} />

            <Route path="/books" element={<PropertyBooks />} />

            <Route path="/properties/map" element={<PropertiesMap />} />

            <Route path="/landings" element={<LandingsList />} />

            <Route path="/visits" element={<Visits />} />

            <Route path="/proposals" element={<Proposals />} />

            <Route path="/contracts" element={<Contracts />} />

            <Route path="/property-capture-requests" element={<PropertyCaptureRequests />} />

            <Route path="/property-interests" element={<PropertyInterests />} />

            {/* Settings — roleta de corretores. Montagem antiga da mesma tela de
                /automations/roleta-config; faltava CustomerRoute e PermissionRoute,
                então dava para chegar nela digitando a URL. */}
            <Route
              path="/settings/roleta-config"
              element={
                <PermissionRoute resource="roleta_configs" action="read">
                  <RoletaConfigPage />
                </PermissionRoute>
              }
            />
          </Route>

          {/*
            ===================================================================
            GRUPO B — PrivateRoute + MainLayout + SuperAdminRoute (persistente)
            ===================================================================
            Sem CustomerRoute (igual ao original). SuperAdminRoute continua
            gateando o conteúdo (redireciona pra "/" se não for super-admin no
            host raiz), só que agora em volta do Outlet compartilhado.
          */}
          <Route
            element={
              <PrivateRoute>
                <MainLayout>
                  <SuperAdminRoute>
                    <Suspense fallback={outletSuspenseFallback}>
                      <Outlet />
                    </Suspense>
                  </SuperAdminRoute>
                </MainLayout>
              </PrivateRoute>
            }
          >
            {/* Super Admin — gerenciamento de instâncias de clientes */}
            <Route path="/super-admin/clientes" element={<ClientInstances />} />
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
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/clientes" element={<PooledClients />} />
            <Route path="/admin/agentes" element={<SuperAgents />} />
            {/* Rateio do consumo da Anthropic por cliente: a chave é uma só pra
                todos os tenants, então sem esta tela a fatura não tem dono. */}
            <Route path="/admin/custo-ia" element={<CustoIA />} />
            <Route path="/admin/push" element={<PushCentral />} />
            <Route path="/admin/equipe" element={<AdminEquipe />} />
            <Route path="/admin/uso" element={<AdminUso />} />
            {/* Academia dentro do admin: mesma tela do /tutorials, mas no shell do
                admin. /tutorials continua sendo por onde o CLIENTE assiste. */}
            <Route path="/admin/academia" element={<AdminAcademia />} />
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
              <PrivateRoute>
                <CustomerRoute>
                  <AcademiaHomePage />
                </CustomerRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/academia/curso/:courseId"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <AcademiaCoursePage />
                </CustomerRoute>
              </PrivateRoute>
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

          {/* Editor do template único da página de imóvel (portal Produto A). */}
          <Route
            path="/properties/template-imovel"
            element={
              <PrivateRoute>
                <CustomerRoute>
                  <PropertyTemplateEditor />
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

          {/* Público (sem login): formulário de onboarding por link (Épico E). */}
          <Route path="/formulario/:token" element={<PublicOnboardingForm />} />

          {/* Público (sem login): Espaço compartilhado por link/token. Rota nua
              (sem PublicRoute) igual às outras rotas de token — pra não bounce
              um usuário logado que abrir o link. */}
          <Route path="/espaco/:token" element={<EspacoPublicRoute />} />

          {/* Público INDEXÁVEL — página de imóvel do portal (Produto A). */}
          <Route path="/imovel/:tenant/:code" element={<ImovelPublic />} />

          {/* Público INDEXÁVEL — home/listagem de imóveis do portal. */}
          <Route path="/portal/:tenant" element={<PortalHome />} />

          {/* Público — página dedicada de busca/filtros de imóveis do portal. */}
          <Route path="/portal/:tenant/imoveis" element={<PortalSearch />} />

          {/* Público INDEXÁVEL — blog do portal (listagem + artigo). */}
          <Route path="/portal/:tenant/blog" element={<PortalBlog />} />
          <Route path="/portal/:tenant/blog/:slug" element={<PortalArticle />} />

          {/* Leads ao Vivo, Modo Cliente, Formulários, Sugestões/Bugs e Atividade
              viraram abas dentro de /admin/clientes (reorg 19/08/2026) — rotas
              antigas só redirecionam, pra não quebrar link salvo/bookmark. */}
          <Route path="/admin/leads-ao-vivo" element={<Navigate to="/admin/clientes?tab=leads-ao-vivo" replace />} />
          <Route path="/admin/modo-cliente" element={<Navigate to="/admin/clientes?tab=modo-cliente" replace />} />
          <Route path="/admin/formularios" element={<Navigate to="/admin/clientes?tab=formularios" replace />} />
          <Route path="/admin/sugestoes-bugs" element={<Navigate to="/admin/clientes?tab=sugestoes-bugs" replace />} />
          <Route path="/admin/atividade" element={<Navigate to="/admin/clientes?tab=atividade" replace />} />
          {/* Rota antiga: Auditoria virou Atividade, que agora é aba de Clientes */}
          <Route path="/admin/auditoria" element={<Navigate to="/admin/clientes?tab=atividade" replace />} />
          {/* Cérebro Universal, Resultados e Aperfeiçoamento viraram abas dentro
              de /admin/agentes (IA Vendedora) — rotas antigas só redirecionam. */}
          <Route path="/admin/cerebro" element={<Navigate to="/admin/agentes?tab=cerebro" replace />} />
          <Route path="/admin/resultados-ia" element={<Navigate to="/admin/agentes?tab=resultados" replace />} />
          <Route path="/admin/aperfeicoamento" element={<Navigate to="/admin/agentes?tab=aperfeicoamento" replace />} />
          {/* Biblioteca de Automações excluída (19/08/2026) — sem uso real, era
              redundante com o modal de biblioteca que o cliente já tem em
              Automações. Bookmark antigo cai na Visão Geral. */}
          <Route path="/admin/biblioteca" element={<Navigate to="/admin" replace />} />

          {/* Rotas antigas: mantidas como redirect pra não quebrar link salvo/bookmark. */}
          <Route path="/super-admin/pooled-clients" element={<Navigate to="/admin/clientes" replace />} />
          <Route path="/super-admin/automation-templates" element={<Navigate to="/admin" replace />} />

          {/* Super Admin — gerenciamento de instâncias de clientes */}
          <Route path="/super-admin/clients" element={<Navigate to="/super-admin/clientes" replace />} />

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
