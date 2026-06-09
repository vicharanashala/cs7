// Top-level router. Public routes are open; everything else requires auth.
import { Navigate, Route, Routes } from 'react-router-dom';
import { ExclusiveOpenProvider } from './hooks/useExclusiveOpen';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { InternshipOverviewPage } from './pages/InternshipOverviewPage';
import { ChatbotPage } from './features/chatbot/ChatbotPage';
import { FaqsPage } from './features/faq/FaqsPage';
import { CuratedFaqsPage } from './features/faq/CuratedFaqsPage';
import { AskQuestionPage } from './features/qna/AskQuestionPage';
import { CommunityPage } from './features/qna/CommunityPage';
import { MyQuestionsPage } from './features/qna/MyQuestionsPage';
import { QuestionDetailPage } from './features/qna/QuestionDetailPage';
import { UnresolvedQuestionsPage } from './features/moderation/UnresolvedQuestionsPage';
import { ModerationOverviewPage } from './features/moderation/ModerationOverviewPage';
import { FaqManagementPage } from './features/admin/FaqManagementPage';
import { ChatbotFeedbackPage } from './features/admin/ChatbotFeedbackPage';
import { AdminOverviewPage } from './features/admin/AdminOverviewPage';
import { UserManagementPage } from './features/admin/UserManagementPage';
import { FaqQualityPage } from './features/admin/FaqQualityPage';
import { ModerationLoadPage } from './features/admin/ModerationLoadPage';
import { SettingsPage } from './features/admin/SettingsPage';
import { ModeratorAnalyticsPage } from './features/moderation/ModeratorAnalyticsPage';
import { FaqCandidatesPage } from './features/moderation/FaqCandidatesPage';

export function App() {
  return (
    <ExclusiveOpenProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public knowledge base — open to anonymous visitors (no AppShell/auth). */}
      <Route path="/browse-faqs" element={<CuratedFaqsPage />} />
      {/* Public internship overview — full programme details mirrored from samagama.in/internship. */}
      <Route path="/internship-overview" element={<InternshipOverviewPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/faqs" element={<FaqsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/community/:id" element={<QuestionDetailPage />} />
        <Route path="/ask" element={<AskQuestionPage />} />
        <Route path="/my-questions" element={<MyQuestionsPage />} />
        {/* Legacy redirect — the student Analytics page was replaced by the home leaderboard. */}
        <Route path="/analytics" element={<Navigate to="/" replace />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
        {/* Moderation (shared between moderator and admin per Dashboard Spec) */}
        <Route path="/moderation" element={<ModerationOverviewPage />} />
        <Route path="/moderation/unresolved" element={<UnresolvedQuestionsPage />} />
        {/* Legacy redirect — old `/moderation/pending` link points to the renamed page. */}
        <Route
          path="/moderation/pending"
          element={<Navigate to="/moderation/unresolved" replace />}
        />
        <Route path="/moderation/analytics" element={<ModeratorAnalyticsPage />} />
        <Route path="/moderation/faq-candidates" element={<FaqCandidatesPage />} />

        {/* Admin / shared FAQ Management — moderator and admin share the same page. */}
        <Route path="/admin" element={<AdminOverviewPage />} />
        <Route path="/admin/faqs" element={<FaqManagementPage />} />
        {/* Categories/Tags admin pages are now tabs inside FaqManagementPage. Keep redirects
            for any bookmarks pointing to the old paths. */}
        <Route path="/admin/categories" element={<Navigate to="/admin/faqs" replace />} />
        <Route path="/admin/tags" element={<Navigate to="/admin/faqs" replace />} />
        <Route path="/admin/users" element={<UserManagementPage />} />
        <Route path="/admin/bot-feedback" element={<ChatbotFeedbackPage />} />
        <Route path="/admin/faq-quality" element={<FaqQualityPage />} />
        <Route path="/admin/moderation-load" element={<ModerationLoadPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
    </ExclusiveOpenProvider>
  );
}
