// lib/config.js

export const ASPECT_RATIOS = {
  PORTRAIT: { label: 'Portrait (9:16)', width: 9, height: 16 },
  LANDSCAPE: { label: 'Landscape (16:9)', width: 16, height: 9 },
  SQUARE: { label: 'Square (1:1)', width: 1, height: 1 }, // Added for completeness
  CUSTOM: { label: 'Custom', width: 0, height: 0 }, // For future custom aspect ratio input
};

// You can add other global configurations here if needed
export const COOKIES_LABELS = {
    AUTH_TOKEN: 'authToken',
    // ... other cookie labels
};

// Example for API_URL if needed
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';