import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://dev.api.dispatch.newleveltech.net/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Serialize array params as repeated keys (?id=a&id=b) instead of the
  // axios default of bracketed indexes (?id[]=a&id[]=b). Spring binds
  // List<T> @RequestParam from the repeated form.
  paramsSerializer: { indexes: null },
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching auth session:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — propagate errors so callers can show them.
//
// We used to hard-redirect to /login on any 401, but Amplify's authStatus
// already owns the session-dead → /login flow via ProtectedRoute in
// App.tsx. The interceptor's redirect was both redundant for true session
// expiry AND actively destructive for per-endpoint 401s (e.g. a 2FA setup
// that rejects the token for an application-level reason), where it
// kicked the user out of a working session before the component could
// surface the error.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default apiClient;
