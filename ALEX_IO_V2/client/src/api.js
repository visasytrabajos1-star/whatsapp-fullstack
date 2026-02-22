// API utility with fallback for development/production
export async function fetchWithApiFallback(endpoint, options = {}) {
  const getBaseUrl = () => {
    // 1. Environment Variable (Vercel/Render)
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

    // 2. Intelligent Detection for Render
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;

      // Handle Render's -client to -server automatic mapping
      if (origin.includes('-client')) {
        return origin.replace('-client', '-server');
      }

      // Known specific user URLs
      if (origin.includes('whatsapp-fullstack-1')) {
        return 'https://whatsapp-fullstack-gkm6.onrender.com';
      }

      return origin;
    }

    // 3. Last Resort Fallback (User's working backend)
    return 'https://whatsapp-fullstack-gkm6.onrender.com';
  };

  const baseUrl = getBaseUrl();
  const secondaryUrl = 'http://localhost:3000';

  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
    localStorage.setItem('last_api_hit', baseUrl); // Store for debug footer
    console.log(`📡 Fetching: ${url}`);

    const response = await fetch(url, fetchOptions);
    // Allow 408 Timeout but with JSON body (used for polling)
    if (response.ok || response.status === 408) return response;

    // Fallback if not found or server error
    if (baseUrl !== secondaryUrl) {
      const fallbackResponse = await fetch(`${secondaryUrl}${endpoint}`, fetchOptions);
      if (fallbackResponse.ok) return fallbackResponse;
    }

    return response;
  } catch (error) {
    console.error("Fetch error:", error);
    // Last resort: retry on localhost if not already there
    try {
      if (baseUrl !== secondaryUrl) {
        return await fetch(`${secondaryUrl}${endpoint}`, fetchOptions);
      }
      throw error;
    } catch (e) {
      throw new Error('API no disponible. Verifica que el servidor esté encendido.');
    }
  }
}
