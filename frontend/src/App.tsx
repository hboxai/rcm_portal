import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClaimProvider } from './contexts/ClaimContext';
import './index.css';

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-olive-green to-earth-yellow">
    <div className="p-4 rounded-lg bg-dark-olive-green/80 backdrop-blur-sm shadow-lg">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-transparent border-t-sienna border-r-sienna rounded-full animate-spin"></div>
        <p className="mt-4 text-textLight/80">Loading...</p>
      </div>
    </div>
  </div>
);

// Lazy load components for better performance
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FullProfilePage = lazy(() => import('./pages/FullProfilePage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

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
const AuthRoute = ({ element }: { element: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingFallback />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/search" replace />;
  }
  
  return element;
};

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<AuthRoute element={<LoginPage />} />} />
        <Route path="/search" element={<ProtectedRoute element={<SearchPage />} />} />
        <Route path="/profile/:id" element={<ProtectedRoute element={<ProfilePage />} />} />
        <Route path="/full-profile/:id" element={<ProtectedRoute element={<FullProfilePage />} />} />
        <Route path="/user-management" element={<ProtectedRoute element={<UserManagementPage />} />} />
        <Route path="/history" element={<ProtectedRoute element={<HistoryPage />} />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
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
