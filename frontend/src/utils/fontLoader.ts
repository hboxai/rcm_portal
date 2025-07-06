/**
 * Font loader utility for the RCM Portal application
 * 
 * This utility loads the FF Mark font family from a CDN or local source.
 * If FF Mark is not available, it falls back to a system font stack.
 */

export const loadFonts = () => {
  // Create a new style element
  const style = document.createElement('style');
  
  // Define the font-face rules with a CDN source or with system font fallbacks
  style.textContent = `
    /* FF Mark Font with Fallbacks */
    @font-face {
      font-family: 'FF Mark';
      src: local('FF Mark Medium'),
           local('FFMark-Medium');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'FF Mark';
      src: local('FF Mark Bold'),
           local('FFMark-Bold');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'FF Mark';
      src: local('FF Mark'),
           local('FFMark-Regular');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'FF Mark';
      src: local('FF Mark Light'),
           local('FFMark-Light');
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }

    /* System font fallback stack */
    body {
      font-family: 'FF Mark', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  `;

  // Append the style element to the head
  document.head.appendChild(style);

  // Optional: Log to console that fonts were initialized
  console.log('FF Mark font family initialized with fallbacks');
};

/**
 * Utility to check if a font is loaded and available
 * @param fontFamily The font family name to check
 * @returns boolean indicating if the font is loaded
 */
export const isFontLoaded = (fontFamily: string): boolean => {
  const testString = 'abcdefghijklmnopqrstuvwxyz';
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) return false;
  
  const baselineFont = '16px sans-serif';
  const testFont = `16px ${fontFamily}, sans-serif`;
  
  context.font = baselineFont;
  const baselineWidth = context.measureText(testString).width;
  
  context.font = testFont;
  const testWidth = context.measureText(testString).width;
  
  return baselineWidth !== testWidth;
};

export default {
  loadFonts,
  isFontLoaded
};
