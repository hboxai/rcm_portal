# FF Mark Font Implementation

This document provides information on how the FF Mark font family is implemented in the RCM Portal application.

## Overview

FF Mark is a premium font that requires a license for commercial use. Due to licensing restrictions, the actual font files are not included in this repository. Instead, we've implemented:

1. Font declarations that will use locally installed FF Mark if available
2. A fallback system that ensures the application looks good even if FF Mark is not available

## Font Files

The application looks for the following font files:

- FF Mark Regular (`FFMark-Regular.woff2` and `FFMark-Regular.woff`)
- FF Mark Medium (`FFMark-Medium.woff2` and `FFMark-Medium.woff`)
- FF Mark Bold (`FFMark-Bold.woff2` and `FFMark-Bold.woff`)
- FF Mark Light (`FFMark-Light.woff2` and `FFMark-Light.woff`)

## Implementation Details

The font is implemented through:

1. **Font Declarations**: The `@font-face` declarations in CSS
2. **Tailwind Configuration**: `fontFamily` settings in tailwind.config.js
3. **Font Loader**: A utility script that handles font loading and fallbacks
4. **Custom CSS**: Specific styling for different text elements using FF Mark

## Font Usage Guidelines

- **Headings**: Use font-weight 700 (Bold)
- **Body Text**: Use font-weight 400 (Regular)
- **Emphasis/UI Elements**: Use font-weight 500 (Medium)
- **Secondary Text**: Use font-weight 300 (Light)

## Adding Font Files

To add the actual FF Mark font files:

1. Purchase a license for FF Mark from [FontFont/Monotype](https://www.monotype.com/)
2. Add the font files to the `/frontend/public/fonts/` directory
3. Test the implementation using the included font test page at `/font-test.html`

## Fallback System

If FF Mark is not available, the application will fall back to:
- Apple System font on macOS/iOS
- Segoe UI on Windows
- Roboto on Android
- Standard sans-serif fonts on other platforms

The fallback system ensures the application maintains a consistent look and feel across platforms, even when the primary font is not available.

## Testing

A test page is available at `/font-test.html` that shows how FF Mark renders at different weights and in different UI contexts.
