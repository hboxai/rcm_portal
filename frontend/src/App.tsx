import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClaimProvider } from './contexts/ClaimContext';
import './index.css';
import Header from './components/layout/Header';

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple/10 to-blue/10">
    <div className="p-6 rounded-lg bg-white/90 backdrop-blur-sm shadow-lg border border-purple/20">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-transparent border-t-purple border-r-pink rounded-full animate-spin"></div>
        <p className="mt-4 text-textDark font-medium">Loading...</p>
      </div>
    </div>
  </div>
);

// Lazy load components for better performance
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FullProfilePage = lazy(() => import('./pages/FullProfilePage'));
const EraInboxPage = lazy(() => import('./pages/EraInboxPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SubmitFilesPage = lazy(() => import('./pages/SubmitFilesPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));
const SubmitPreviewPage = lazy(() => import('./pages/SubmitPreviewPage'));
const SubmitFullProfilePage = lazy(() => import('./pages/SubmitFullProfilePage'));
const OfficeAllyStatusPage = lazy(() => import('./pages/OfficeAllyStatusPage'));

// Protected route component
const ProtectedRoute = ({ element }: { element: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  // Show loading while checking auth status
  if (isLoading) {
    return <LoadingFallback />;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return element;
};

// Route to redirect authenticated users away from login
// Component to show a brief loading spinner after successful auth before redirect
const PostLoginRedirect = () => {
  const navigate = useNavigate();
  const { clearJustLoggedIn } = useAuth();
  useEffect(() => {
    const t = setTimeout(() => {
      clearJustLoggedIn();
      navigate('/search', { replace: true });
    }, 1100); // ~1.1s visual feedback
    return () => clearTimeout(t);
  }, [navigate, clearJustLoggedIn]);
  return <LoadingFallback />;
};

const AuthRoute = ({ element }: { element: JSX.Element }) => {
  const { isAuthenticated, isLoading, justLoggedIn } = useAuth();

  if (isLoading) return <LoadingFallback />;
  if (isAuthenticated) {
    if (justLoggedIn) return <PostLoginRedirect />;
    return <Navigate to="/search" replace />;
  }
  return element;
};

function AppRoutes() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const showHeader = isAuthenticated && location.pathname !== '/login';
  return (
    <>
      {showHeader && <Header />}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<AuthRoute element={<LoginPage />} />} />
          <Route path="/submit-files" element={<ProtectedRoute element={<SubmitFilesPage />} />} />
          <Route path="/upload" element={<ProtectedRoute element={<UploadPage />} />} />
          <Route path="/preview/:fileId" element={<ProtectedRoute element={<PreviewPage />} />} />
          <Route path="/submit-preview/:uploadId" element={<ProtectedRoute element={<SubmitPreviewPage />} />} />
          <Route path="/office-ally-status" element={<ProtectedRoute element={<OfficeAllyStatusPage />} />} />
          <Route path="/search" element={<ProtectedRoute element={<SearchPage />} />} />
          <Route path="/profile/:id" element={<ProtectedRoute element={<ProfilePage />} />} />
          <Route path="/era-inbox" element={<ProtectedRoute element={<EraInboxPage />} />} />
            <Route path="/full-profile/:id" element={<ProtectedRoute element={<FullProfilePage />} />} />
          <Route path="/submit-full-profile/:id" element={<ProtectedRoute element={<SubmitFullProfilePage />} />} />
          <Route path="/user-management" element={<ProtectedRoute element={<UserManagementPage />} />} />
          <Route path="/history" element={<ProtectedRoute element={<HistoryPage />} />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ClaimProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ClaimProvider>
    </AuthProvider>
  );
}

export default App;
