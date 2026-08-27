 import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '@store/authStore';
import { Spinner } from '@components/ui/Primitives';
import Navbar from '@components/layout/Navbar';
import Footer from '@components/layout/Footer';

// ── Lazy page imports ───────────────────────
const Home = lazy(() => import('@pages/Home'));
const Builder = lazy(() => import('@pages/Builder'));
const ScopeAdvisor = lazy(() => import('@pages/ScopeAdvisor'));
const Catalog = lazy(() => import('@pages/Catalog'));
const Packages = lazy(() => import('@pages/Packages'));
const Industries = lazy(() => import('@pages/Industries'));
const Portfolio = lazy(() => import('@pages/Portfolio'));
const Pricing = lazy(() => import('@pages/Pricing'));
const About = lazy(() => import('@pages/About'));
const Careers = lazy(() => import('@pages/Careers'));
const HiringWall = lazy(() => import('@pages/HiringWall'));
const ProjectWall = lazy(() => import('@pages/ProjectWall'));
const Resources = lazy(() => import('@pages/Resources'));
const BlogPost = lazy(() => import('@pages/BlogPost'));
const Contact = lazy(() => import('@pages/Contact'));
const Legal = lazy(() => import('@pages/Legal'));
const Changelog = lazy(() => import('@pages/Changelog'));
const Help = lazy(() => import('@pages/Help'));
const Demo = lazy(() => import('@pages/Demo'));
const Quiz = lazy(() => import('@pages/Quiz'));
const Roadmap = lazy(() => import('@pages/Roadmap'));
const ServiceCostPage = lazy(() => import('@pages/ServiceCost'));
const ServiceTimelinePage = lazy(() => import('@pages/ServiceTimeline'));
const GuidesPage = lazy(() => import('@pages/Guides'));
const GuideDetail = lazy(() => import('@pages/GuideDetail'));
const BundleDetail = lazy(() => import('@pages/BundleDetail'));
const ExpressCheckout = lazy(() => import('@pages/ExpressCheckout'));
const WebsiteAudit = lazy(() => import('@pages/tools/WebsiteAudit'));
const Estimator = lazy(() => import('@pages/tools/Estimator'));
const BriefBuilder = lazy(() => import('@pages/tools/BriefBuilder'));
const LegalStarterPack = lazy(() => import('@pages/tools/LegalStarterPack'));
const GSTInvoice = lazy(() => import('@pages/tools/GSTInvoice'));
const InstantEstimate = lazy(() => import('@pages/tools/InstantEstimate'));
const LegalTemplate = lazy(() => import('@pages/tools/LegalTemplate'));
const InvoiceGenerator = lazy(() => import('@pages/tools/InvoiceGenerator'));
const PreviewGenerator = lazy(() => import('@pages/tools/PreviewGenerator'));
const Blueprint = lazy(() => import('@pages/tools/Blueprint'));
const Glossary = lazy(() => import('@pages/tools/Glossary'));
const Showcase = lazy(() => import('@pages/tools/Showcase'));

// Checkout & misc public
const Checkout = lazy(() => import('@pages/Checkout'));
const ESign = lazy(() => import('@pages/ESign'));
const PaymentConfirmation = lazy(() => import('@pages/PaymentConfirmation'));
const Programs = lazy(() => import('@pages/Programs'));
const RFPSubmit = lazy(() => import('@pages/RFPSubmit'));
const RFPList = lazy(() => import('@pages/RFPList'));
const ServiceDetail = lazy(() => import('@pages/ServiceDetail'));
const Compare = lazy(() => import('@pages/Compare'));
const ReferralPage = lazy(() => import('@pages/Referral'));
const FAQ = lazy(() => import('@pages/FAQ'));

// Auth
const Login = lazy(() => import('@pages/auth/Login'));
const Signup = lazy(() => import('@pages/auth/Signup'));
const ForgotPassword = lazy(() => import('@pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('@pages/auth/VerifyEmail'));
const AuthCallback = lazy(() => import('@pages/auth/AuthCallback'));

// Client dashboard
const ClientLayout = lazy(() => import('@app/client/ClientLayout'));
const ClientOverview = lazy(() => import('@app/client/Overview'));
const ClientProjects = lazy(() => import('@app/client/Projects'));
const ClientQuotes = lazy(() => import('@app/client/Quotes'));
const ClientInvoices = lazy(() => import('@app/client/Invoices'));
const ClientFiles = lazy(() => import('@app/client/Files'));
const ClientMessages = lazy(() => import('@app/client/Messages'));
const ClientProfile = lazy(() => import('@app/client/Profile'));
const ClientSupport = lazy(() => import('@app/client/Support'));
const ClientCart = lazy(() => import('@app/client/Cart'));
const ClientEngagements = lazy(() => import('@app/client/Engagements'));
const ClientContracts = lazy(() => import('@app/client/Contracts'));
const ClientTimesheets = lazy(() => import('@app/client/Timesheets'));
const ClientNotifications = lazy(() => import('@app/client/Notifications'));
const ClientMilestones = lazy(() => import('@app/client/Milestones'));
const ClientReferrals = lazy(() => import('@app/client/Referrals'));
const ClientWorkspace = lazy(() => import('@app/client/Workspace'));
const ClientFeedback = lazy(() => import('@app/client/Feedback'));
const ClientActivity = lazy(() => import('@app/client/ClientPanels').then((m) => ({ default: m.Activity })));
const ClientChanges = lazy(() => import('@app/client/ClientPanels').then((m) => ({ default: m.Changes })));
const ClientReports = lazy(() => import('@app/client/ClientPanels').then((m) => ({ default: m.Reports })));
const ClientHandover = lazy(() => import('@app/client/ClientPanels').then((m) => ({ default: m.Handover })));

// Team dashboard
const TeamLayout = lazy(() => import('@app/team/TeamLayout'));
const TeamDashboard = lazy(() => import('@app/team/Dashboard'));
const TeamTasks = lazy(() => import('@app/team/Tasks'));
const TeamProjects = lazy(() => import('@app/team/Projects'));
const TeamProfile = lazy(() => import('@app/team/Profile'));
const TeamTimesheets = lazy(() => import('@app/team/Timesheets'));
const TeamCalendar = lazy(() => import('@app/team/Calendar'));
const TeamReviews = lazy(() => import('@app/team/Reviews'));
const TeamKnowledge = lazy(() => import('@app/team/Knowledge'));
const TeamQueue = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.Queue })));
const TeamSprints = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.Sprints })));
const TeamResources = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.Resources })));
const TeamQuality = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.Quality })));
const TeamFinance = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.Finance })));
const TeamClients = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.Clients })));
const TeamAnalyticsDash = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.Analysis })));
const TeamSEQueue = lazy(() => import('@app/team/PmDashboards').then((m) => ({ default: m.SEQueue })));

// Salesperson Dashboard
const SalesLayout = lazy(() => import('@app/team/SalesLayout'));
const SalesDashboard = lazy(() => import('@app/team/SalesDashboard'));
const SalesLeads = lazy(() => import('@app/team/Leads'));
const SalesPipeline = lazy(() => import('@app/team/Pipeline'));
const PitchStudio = lazy(() => import('@app/team/PitchStudio'));
const Objections = lazy(() => import('@app/team/Objections'));
const SalesCall = lazy(() => import('@app/team/SalesCall'));
const FollowUps = lazy(() => import('@app/team/FollowUps'));
const Proposals = lazy(() => import('@app/team/Proposals'));
const SalesKnowledge = lazy(() => import('@app/team/SalesKnowledge'));
const PitchHistory = lazy(() => import('@app/team/PitchHistory'));

// Admin dashboard
const AdminLayout = lazy(() => import('@app/admin/AdminLayout'));
const AdminOverview = lazy(() => import('@app/admin/Overview'));
const AdminCatalog = lazy(() => import('@app/admin/Catalog'));
const AdminHiring = lazy(() => import('@app/admin/Hiring'));
const AdminOrders = lazy(() => import('@app/admin/Orders'));
const AdminPurchases = lazy(() => import('@app/admin/Purchases'));
const AdminProjects = lazy(() => import('@app/admin/Projects'));
const AdminUsers = lazy(() => import('@app/admin/Users'));
const AdminProjectWall = lazy(() => import('@app/admin/ProjectWall'));
const AdminContent = lazy(() => import('@app/admin/Content'));
const AdminAnalytics = lazy(() => import('@app/admin/Analytics'));
const AdminSettings = lazy(() => import('@app/admin/Settings'));
const AdminFinance = lazy(() => import('@app/admin/Finance'));
const AdminEngagements = lazy(() => import('@app/admin/Engagements'));
const AdminNotifications = lazy(() => import('@app/admin/Notifications'));
const AdminRFPs = lazy(() => import('@app/admin/RFPs'));
const AdminReferrals = lazy(() => import('@app/admin/Referrals'));
const AdminReports = lazy(() => import('@app/admin/Reports'));
const AdminFlags = lazy(() => import('@app/admin/Governance').then((m) => ({ default: m.Flags })));
const AdminPricing = lazy(() => import('@app/admin/Governance').then((m) => ({ default: m.Pricing })));
const AdminTemplates = lazy(() => import('@app/admin/Governance').then((m) => ({ default: m.Templates })));
const AdminCompliance = lazy(() => import('@app/admin/Governance').then((m) => ({ default: m.Compliance })));
const AdminScreening = lazy(() => import('@app/admin/Governance').then((m) => ({ default: m.Screening })));

// ── Layout wrappers ─────────────────────────

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Spinner size="lg" />
  </div>
);

const PublicLayout = () => (
  <>
    <Navbar />
    <main className="flex-1 pt-16">
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </main>
    <Footer />
  </>
);

const ProtectedRoute = ({ roles }) => {
  const { isAuthenticated, user, getDashboardPath } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role?.toLowerCase();
  if (roles && !roles.includes(userRole) && !roles.includes(user?.role)) {
    // Role no longer matches this dashboard (e.g. admin just promoted/demoted
    // this user) — send them to the dashboard their current role now owns,
    // not to the homepage, so a role change actually takes them somewhere.
    return <Navigate to={getDashboardPath()} replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
};

const AuthLayout = () => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
};

// ── Route config ────────────────────────────

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public pages */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="builder" element={<Builder />} />
        <Route path="advisor" element={<ScopeAdvisor />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="packages" element={<Packages />} />
        <Route path="industries" element={<Industries />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="about" element={<About />} />
        <Route path="careers" element={<Careers />} />
        <Route path="hiring-wall" element={<HiringWall />} />
        <Route path="project-wall" element={<ProjectWall />} />
        <Route path="resources" element={<Resources />} />
        <Route path="resources/:id" element={<BlogPost />} />
        <Route path="contact" element={<Contact />} />
        <Route path="legal/*" element={<Legal />} />
        <Route path="changelog" element={<Changelog />} />
        <Route path="help" element={<Help />} />
        <Route path="demo" element={<Demo />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="guides" element={<GuidesPage />} />
        <Route path="guides/:slug" element={<GuideDetail />} />
        <Route path="bundles/:slug" element={<BundleDetail />} />
        <Route path="services/:category/:slug/cost" element={<ServiceCostPage />} />
        <Route path="services/:category/:slug/timeline" element={<ServiceTimelinePage />} />
        <Route path="checkout/express" element={<ExpressCheckout />} />
        <Route path="tools/website-audit" element={<WebsiteAudit />} />
        <Route path="tools/estimator" element={<Estimator />} />
        <Route path="tools/brief-generator" element={<BriefBuilder />} />
        <Route path="tools/legal-starter-pack" element={<LegalStarterPack />} />
        <Route path="tools/gst-invoice" element={<GSTInvoice />} />
        <Route path="tools/instant-estimate" element={<InstantEstimate />} />
        <Route path="tools/legal-templates" element={<LegalTemplate />} />
        <Route path="tools/invoice-generator" element={<InvoiceGenerator />} />
        <Route path="tools/preview-generator" element={<PreviewGenerator />} />
        <Route path="tools/blueprint" element={<Blueprint />} />
        <Route path="tools/glossary" element={<Glossary />} />
        <Route path="tools/showcase" element={<Showcase />} />
        <Route path="checkout/:quoteId" element={<Checkout />} />
        <Route path="esign" element={<ESign />} />
        <Route path="payment-confirmation" element={<PaymentConfirmation />} />
        <Route path="programs" element={<Programs />} />
        <Route path="rfp/submit" element={<RFPSubmit />} />
        <Route path="rfp/list" element={<RFPList />} />
        <Route path="services/:id" element={<ServiceDetail />} />
        <Route path="compare" element={<Compare />} />
        <Route path="referral" element={<ReferralPage />} />
        <Route path="faq" element={<FAQ />} />
      </Route>

      {/* OAuth return trip. Deliberately outside AuthLayout: that layout bounces
          authenticated visitors to "/", which would race the very session this
          page is in the middle of establishing. */}
      <Route
        path="auth/callback"
        element={
          <Suspense fallback={<PageLoader />}>
            <AuthCallback />
          </Suspense>
        }
      />

      {/* Auth pages (no navbar/footer) */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
      </Route>

      {/* Client dashboard */}
      <Route path="app/client" element={<ProtectedRoute roles={['client', 'admin', 'CLIENT', 'CLIENT_ADMIN', 'CLIENT_PM', 'CLIENT_VIEWER', 'INDIVIDUAL_CLIENT', 'ORG_OWNER', 'ADMIN']} />}>
        <Route element={<ClientLayout />}>
          <Route index element={<ClientOverview />} />
          <Route path="projects" element={<ClientProjects />} />
          <Route path="projects/:id" element={<ClientProjects />} />
          <Route path="quotes" element={<ClientQuotes />} />
          <Route path="invoices" element={<ClientInvoices />} />
          <Route path="invoices/:id" element={<ClientInvoices />} />
          <Route path="files" element={<ClientFiles />} />
          <Route path="messages" element={<ClientMessages />} />
          <Route path="messages/:id" element={<ClientMessages />} />
          <Route path="profile" element={<ClientProfile />} />
          <Route path="support" element={<ClientSupport />} />
          <Route path="cart" element={<ClientCart />} />
          <Route path="engagements" element={<ClientEngagements />} />
          <Route path="engagements/:id" element={<ClientEngagements />} />
          <Route path="contracts" element={<ClientContracts />} />
          <Route path="contracts/:id" element={<ClientContracts />} />
          <Route path="timesheets" element={<ClientTimesheets />} />
          <Route path="notifications" element={<ClientNotifications />} />
          <Route path="milestones" element={<ClientMilestones />} />
          <Route path="referrals" element={<ClientReferrals />} />
          <Route path="workspace" element={<ClientWorkspace />} />
          <Route path="workspace/:id" element={<ClientWorkspace />} />
          <Route path="feedback" element={<ClientFeedback />} />
          <Route path="activity" element={<ClientActivity />} />
          <Route path="changes" element={<ClientChanges />} />
          <Route path="reports" element={<ClientReports />} />
          <Route path="handover" element={<ClientHandover />} />
        </Route>
      </Route>

      {/* Team dashboard */}
      <Route path="app/team" element={<ProtectedRoute roles={['team', 'admin', 'SE', 'SENIOR_PM', 'PM', 'DEVELOPER', 'QA', 'DESIGNER', 'DEVOPS', 'ADMIN']} />}>
        <Route element={<TeamLayout />}>
          <Route index element={<TeamDashboard />} />
          <Route path="tasks" element={<TeamTasks />} />
          <Route path="projects" element={<TeamProjects />} />
          <Route path="projects/:id" element={<TeamProjects />} />
          <Route path="timesheets" element={<TeamTimesheets />} />
          <Route path="calendar" element={<TeamCalendar />} />
          <Route path="reviews" element={<TeamReviews />} />
          <Route path="knowledge" element={<TeamKnowledge />} />
          <Route path="profile" element={<TeamProfile />} />
          <Route path="queue" element={<TeamQueue />} />
          <Route path="sprints" element={<TeamSprints />} />
          <Route path="resources" element={<TeamResources />} />
          <Route path="quality" element={<TeamQuality />} />
          <Route path="finance" element={<TeamFinance />} />
          <Route path="clients" element={<TeamClients />} />
          <Route path="analytics" element={<TeamAnalyticsDash />} />
          <Route path="se-queue" element={<TeamSEQueue />} />
        </Route>
      </Route>

      {/* Salesperson Dashboard */}
      <Route path="app/team/sales" element={<ProtectedRoute roles={['team', 'admin', 'SE', 'SENIOR_PM', 'PM', 'ADMIN']} />}>
        <Route element={<SalesLayout />}>
          <Route index element={<SalesDashboard />} />
          <Route path="leads" element={<SalesLeads />} />
          <Route path="pipeline" element={<SalesPipeline />} />
          <Route path="pitch-studio" element={<PitchStudio />} />
          <Route path="objections" element={<Objections />} />
          <Route path="sales-call" element={<SalesCall />} />
          <Route path="follow-ups" element={<FollowUps />} />
          <Route path="proposals" element={<Proposals />} />
          <Route path="knowledge-center" element={<SalesKnowledge />} />
          <Route path="pitch-history" element={<PitchHistory />} />
        </Route>
      </Route>

      {/* Admin dashboard */}
      <Route path="app/admin" element={<ProtectedRoute roles={['admin', 'ADMIN']} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="purchases" element={<AdminPurchases />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="projects/:id" element={<AdminProjects />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="hiring" element={<AdminHiring />} />
          <Route path="project-wall" element={<AdminProjectWall />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="engagements" element={<AdminEngagements />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="rfps" element={<AdminRFPs />} />
          <Route path="referrals" element={<AdminReferrals />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="flags" element={<AdminFlags />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="compliance" element={<AdminCompliance />} />
          <Route path="screening" element={<AdminScreening />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
