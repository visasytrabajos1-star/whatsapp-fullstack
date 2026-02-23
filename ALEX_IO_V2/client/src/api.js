const normalize = (url) => (url || '').replace(/\/$/, '');

const RENDER_BACKEND_HINT = process.env.REACT_APP_RENDER_BACKEND_URL || 'https://whatsapp-fullstack-gkm6.onrender.com';
const DEFAULT_TIMEOUT_MS = Number(process.env.REACT_APP_API_TIMEOUT_MS || 20000);
let lastResolvedApiBase = null;

const getFallbackBases = () => {
  if (typeof window === 'undefined') return [RENDER_BACKEND_HINT];

  const origin = normalize(window.location.origin);
  const hostname = window.location.hostname;
  const fallbacks = [RENDER_BACKEND_HINT];

  if (hostname.includes('-client.')) {
    fallbacks.push(origin.replace('-client.', '-server.'));
  }

  if (hostname.endsWith('.onrender.com') && hostname !== 'whatsapp-fullstack-gkm6.onrender.com') {
    fallbacks.push('https://whatsapp-fullstack-gkm6.onrender.com');
  }

  fallbacks.push(origin);

  return fallbacks.filter(Boolean);
};

const getApiBases = () => {
  const envBase = normalize(process.env.REACT_APP_API_URL);
  const bases = envBase ? [envBase] : [];

  for (const fallback of getFallbackBases()) {
    if (!bases.includes(fallback)) bases.push(fallback);
  }

  return bases;
};

export const getPreferredApiBase = () => getApiBases()[0] || null;
export const getLastResolvedApiBase = () => lastResolvedApiBase;

const shouldTryNextBase = (response) => {
  if (!response) return true;
  return [404, 502, 503, 504].includes(response.status);
};

export const fetchWithApiFallback = async (path, options = {}) => {
  const bases = getApiBases();
  const errors = [];

  for (const base of bases) {
    const url = `${base}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok && shouldTryNextBase(response)) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }

      lastResolvedApiBase = base;
      return response;
    } catch (error) {
      clearTimeout(timeout);
      errors.push(`${url} → ${error.name === 'AbortError' ? `timeout ${DEFAULT_TIMEOUT_MS}ms` : error.message}`);
    }
  }

  throw new Error(`No se pudo conectar al backend. Intentos: ${errors.join(' | ')}`);
};
