import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './hmr-debug.js';

// Preload important resources
const preloadResources = () => {
  // Preload key images, fonts or other resources for faster initial load
  const preloadLinks = [
    // Add your critical resources here, for example:
    // { rel: 'preload', href: '/fonts/your-font.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }
  ];
  
  preloadLinks.forEach(linkProps => {
    const link = document.createElement('link');
    Object.entries(linkProps).forEach(([key, value]) => {
      link.setAttribute(key, String(value));
    });
    document.head.appendChild(link);
  });
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
