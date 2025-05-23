import axios from 'axios';

// Setup axios interceptors to handle auth errors globally
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors globally
    if (error.response && error.response.status === 401) {
      console.error('Authentication error: Unauthorized access');
      // Clear token to force re-login
      localStorage.removeItem('token');
      
      // Redirect to login page if not already there
      if (!window.location.pathname.includes('/login')) {
        console.log('Redirecting to login page due to auth error');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axios;
