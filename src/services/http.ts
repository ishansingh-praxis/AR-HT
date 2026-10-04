import { API_URL } from '../config';
import { createHttp } from '../sync/http';
import { useAuth } from '../store/authStore';

export { ApiError } from '../sync/http';

/** The app's API client: base URL from config, 10 s timeout, typed errors, one-at-a-time token refresh, sign-out when refresh fails. */
export const http = createHttp({
  baseUrl: API_URL,
  tokens: {
    get: () => { const { token, refreshToken } = useAuth.getState(); return token && refreshToken ? { accessToken: token, refreshToken } : null; },
    set: (t) => useAuth.getState().setTokens(t),
  },
});
export const request = http.request;
