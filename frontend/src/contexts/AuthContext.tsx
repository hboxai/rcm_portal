import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, AuthState, LoginCredentials } from '../types/auth';
import { authService } from '../services/authService';
import { clearCsrfToken } from '../utils/axiosSetup';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  token: string | null; // Add token to the context type
  justLoggedIn: boolean;
  clearJustLoggedIn: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Start with loading while we check for stored token
  });

  // Add state for the token itself to be passed in context
  const [token, setToken] = useState<string | null>(authService.getToken());
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const currentToken = authService.getToken();
      setToken(currentToken); // Set token state
      
      if (currentToken) {
        try {
          const result = await authService.verifyToken(currentToken);
          if (result.valid && result.user) {
            setAuthState({
              user: result.user as User,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // Token invalid, clear it
            authService.logout();
            setToken(null); // Clear token state
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error('Auth check error:', error);
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkAuth();
  }, []);

  // Compute isAdmin based on user's role
  const isAdmin = authState.user?.role === 'Admin';

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      const { user, token: newToken } = await authService.login(credentials); // Get token from login response
      setToken(newToken); // Set token state
      
      setAuthState({
        user,
        isAuthenticated: true,
        // Keep isLoading false so UI stays on page; component can show its own success animation
        isLoading: false,
      });
  setJustLoggedIn(true);
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      // Ensure we do NOT trigger a loading state on error; leave other auth data untouched
      setAuthState(prev => ({ ...prev, isLoading: false }));
      // Re-throw the error so the component can display it
      throw error;
    }
  };

  const logout = async () => {
    // Call server to revoke refresh token
    try {
      await authService.logoutFromServer();
    } catch {
      // Continue with local logout even if server call fails
    }
    
    authService.logout();
    setToken(null); // Clear token state
    clearCsrfToken(); // Clear CSRF token on logout
    
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        isAdmin,
        token, // Provide token in the context value
  justLoggedIn,
  clearJustLoggedIn: () => setJustLoggedIn(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
