import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { useI18n } from './i18n';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AiChat from './components/AiChat';
import Toast from './components/Toast';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import Archive from './pages/Archive';
import Premium from './pages/Premium';
import Login from './pages/Login';
import Register from './pages/Register';
import Verify from './pages/Verify';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import BloggerPanel from './pages/BloggerPanel';
import BloggersLeaderboard from './pages/BloggersLeaderboard';
import PublicCollection from './pages/PublicCollection';
import WidgetSearch from './pages/WidgetSearch';
import WidgetDaily from './pages/WidgetDaily';
import WidgetBook from './pages/WidgetBook';
import NotFound from './pages/NotFound';
import LinkTelegram from './pages/LinkTelegram';
import LibraryPage from './pages/library/LibraryPage';
import LibraryBookDetail from './pages/library/LibraryBookDetail';
import ReadingGoalPage from './pages/library/ReadingGoalPage';
import PublicReviewPage from './pages/library/PublicReviewPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, checked } = useAuth();
  const t = useI18n((s) => s.t);
  const location = useLocation();
  if (!checked) {
    return <div className="py-24 text-center text-parchment-dim">{t('common.loading')}</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Widget routes render without Navbar/Footer (for iframe embedding)
function WidgetRoutes() {
  return (
    <Routes>
      <Route path="/widget/search" element={<WidgetSearch />} />
      <Route path="/widget/daily"  element={<WidgetDaily />} />
      <Route path="/widget/book/:bookId" element={<WidgetBook />} />
    </Routes>
  );
}

function MainApp() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route
            path="/archive"
            element={
              <ProtectedRoute>
                <Archive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/blogger"
            element={
              <ProtectedRoute>
                <BloggerPanel />
              </ProtectedRoute>
            }
          />
          <Route path="/premium"         element={<Premium />} />
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/verify"          element={<Verify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/bloggers"        element={<BloggersLeaderboard />} />
          <Route path="/collection/:slug" element={<PublicCollection />} />
          <Route path="/link-telegram" element={<LinkTelegram />} />
          <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/library/goal" element={<ProtectedRoute><ReadingGoalPage /></ProtectedRoute>} />
          <Route path="/library/:id" element={<ProtectedRoute><LibraryBookDetail /></ProtectedRoute>} />
          <Route path="/review/:username/:slug" element={<PublicReviewPage />} />
          <Route path="*"                element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <AiChat />
      <Toast />
    </div>
  );
}

export default function App() {
  const init      = useAuthStore((s) => s.init);
  const syncTheme = useThemeStore((s) => s.sync);
  const location  = useLocation();

  useEffect(() => {
    init();
    syncTheme();
  }, [init, syncTheme]);

  // Widget routes rendered standalone (no layout)
  if (location.pathname.startsWith('/widget/')) {
    return <WidgetRoutes />;
  }

  return <MainApp />;
}
