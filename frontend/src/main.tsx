import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/fonts.css'; // Import custom font styling
import './hmr-debug.js';
// Import axios setup with interceptors
import './utils/axiosSetup';
// Import font loader
import { loadFonts } from './utils/fontLoader';

// Preload important resources
const preloadResources = () => {
  // Preload Google Fonts for better performance
  const preloadLinks = [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' }
  ];
  
  preloadLinks.forEach(linkProps => {
    const link = document.createElement('link');
    Object.entries(linkProps).forEach(([key, value]) => {
      link.setAttribute(key, String(value));
    });
    document.head.appendChild(link);
  });
  
  // Load FF Mark fonts
  loadFonts();
};

// Initialize performance measurements
const startTime = performance.now();

// Create root with error handling
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

// Enable React concurrent features for better performance
const root = createRoot(container);

// Preload any critical resources
preloadResources();

// Render the app with concurrent mode enabled
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Log performance metrics after hydration
window.addEventListener('load', () => {
  const loadTime = performance.now() - startTime;
  console.log(`Initial render completed in ${loadTime.toFixed(2)}ms`);

  // Report performance to analytics if needed
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      // Capture any vitals you want to track
      // Example: Analytics.sendTiming('App Initial Render', loadTime);
    });
  }
});
