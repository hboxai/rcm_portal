import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, AuthState, LoginCredentials } from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  token: string | null; // Add token to the context type
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
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { user, token: newToken } = await authService.login(credentials); // Get token from login response
      setToken(newToken); // Set token state
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const logout = () => {
    authService.logout();
    setToken(null); // Clear token state
    
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
