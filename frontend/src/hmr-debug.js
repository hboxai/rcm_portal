// This file enables Vite HMR overlay for React Fast Refresh in Windows environments.
// Place this in your frontend/src directory if you have issues with full reloads instead of HMR.

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', (payload) => {
    // You can log or handle HMR events here if needed
    // console.log('Vite HMR payload:', payload);
  });
}
