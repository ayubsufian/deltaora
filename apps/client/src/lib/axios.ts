import axios from 'axios';

const CSRF_COOKIE = import.meta.env.PROD ? '__Host-deltaora-csrf' : 'deltaora.csrfToken';
const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getCookie = (name: string) => {
  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${encodeURIComponent(name)}=`));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
};

export const ensureCsrfToken = async () => {
  const existing = getCookie(CSRF_COOKIE);
  if (existing) return existing;

  const response = await axios.get('/api/v1/auth/csrf', { withCredentials: true });
  return response.data.csrfToken || getCookie(CSRF_COOKIE);
};

api.interceptors.request.use(
  async (config) => {
    const method = (config.method || 'get').toLowerCase();
    if (UNSAFE_METHODS.has(method) && config.url !== '/auth/csrf') {
      const csrfToken = await ensureCsrfToken();
      if (csrfToken && config.headers) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';

    // Never attempt a refresh-and-retry for auth endpoints:
    // a 401 from /auth/login, /auth/register, /auth/google, etc. means
    // wrong credentials — not an expired session — so retrying after a
    // refresh serves no purpose and causes the error to be silently swallowed.
    const isAuthEndpoint =
      requestUrl.endsWith('/auth/refresh') ||
      requestUrl.endsWith('/auth/login') ||
      requestUrl.endsWith('/auth/register') ||
      requestUrl.endsWith('/auth/google') ||
      requestUrl.includes('/auth/passkeys/');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;
      try {
        const csrfToken = await ensureCsrfToken();
        await axios.post('/api/v1/auth/refresh', {}, {
          withCredentials: true,
          headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
        });
        return api(originalRequest);
      } catch {
        // Refresh failed — session is truly gone, send to login
        window.location.href = '/login';
        return Promise.reject(error); // reject with ORIGINAL error so callers get context
      }
    }

    return Promise.reject(error);
  }
);

export default api;
