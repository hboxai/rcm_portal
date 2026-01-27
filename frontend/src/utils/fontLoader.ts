/**
 * Font loading utility for the RCM Portal application
 * 
 * This module handles the loading and configuration of fonts,
 * with fallbacks to ensure robust typography across the application.
 */

// Preload Inter font from Google Fonts
export const loadFonts = () => {
  try {
    // Create link element for Inter font preload
    const linkElement = document.createElement('link');
    linkElement.rel = 'preload';
    linkElement.as = 'style';
    linkElement.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    linkElement.crossOrigin = 'anonymous';
    
    // Add to document head
    document.head.appendChild(linkElement);
    
    // Load the actual stylesheet
    const styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    styleElement.crossOrigin = 'anonymous';
    
    document.head.appendChild(styleElement);
    
    return true;
  } catch (error) {
    console.warn('Font loading failed, falling back to system fonts:', error);
    return false;
  }
};

// Export default
export default { loadFonts };