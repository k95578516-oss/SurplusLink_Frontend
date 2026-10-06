/*
 * Single API layer for SurplusLink.
 *
 * Every endpoint below exists in the Spring Boot backend (Surplus_Management_System).
 * Requests go to "/api/...", which the Vite dev proxy forwards to http://localhost:8080.
 *
 * Errors are never swallowed: every failed call throws an ApiError carrying the HTTP status,
 * so callers can tell 400 / 401 / 403 / 404 / 409 / 5xx / "server unreachable" apart.
 */

const API = '/api';
const STORAGE_KEY = 'surplus_auth';
const LEGACY_TOKEN_KEY = 'surplus_token';

// Fired when the server answers 401 to an authenticated call (expired / invalid token).
export const UNAUTHORIZED_EVENT = 'surplus:unauthorized';

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
  get isNetwork() { return this.status === 0; }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isConflict() { return this.status === 409; }
  get isValidation() { return this.status === 400; }
  get isServer() { return this.status >= 500; }
}

/* ------------------------------------------------------------------ auth storage */

function decodeJwtExpiry(token) {
  try {
    const part = token.split('.')[1];
    const json = decodeURIComponent(
      atob(part.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch { /* storage unavailable (private mode) - nothing to clear */ }
}

/** Persist the AuthResponse { userId, name, email, role, token } returned by login/register. */
export function storeAuth(data) {
  if (!data || !data.token || !data.userId) throw new ApiError('The server returned an incomplete login response.', 500);
  const auth = { userId: data.userId, name: data.name, email: data.email, role: data.role, token: data.token };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch { /* storage unavailable - the session then lasts only until reload */ }
  return auth;
}

/** The stored session, or null when there is none, it is corrupt, or its JWT has expired. */
export function getStoredAuth() {
  let auth = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    auth = raw ? JSON.parse(raw) : null;
  } catch {
    clearAuth();
    return null;
  }
  if (!auth || !auth.token || !auth.userId || !auth.role) return null;
  const expiresAt = decodeJwtExpiry(auth.token);
  if (expiresAt !== null && expiresAt <= Date.now()) {
    clearAuth();
    return null;
  }
  return auth;
}

/* ------------------------------------------------------------------ transport */

function defaultMessage(status) {
  switch (status) {
    case 400: return 'The server rejected the request. Please check the details and try again.';
    case 401: return 'Your session has expired. Please sign in again.';
    case 403: return 'You do not have permission to do that.';
    case 404: return 'The requested item was not found.';
    case 409: return 'This conflicts with existing data.';
    case 502: case 503: case 504: return 'The server is unavailable. Is the backend running on port 8080?';
    default: return status >= 500 ? 'The server hit an unexpected error. Please try again.' : `Request failed (${status}).`;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const session = getStoredAuth();
    if (session) headers.Authorization = `Bearer ${session.token}`;
  }

  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (cause) {
    throw new ApiError('Cannot reach the server. Check your connection and that the backend is running on port 8080.', 0, cause);
  }

  const raw = await res.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }

  if (!res.ok) {
    // Spring's error body is { status, error, message, path }; a Vite proxy failure has no body at all.
    const fromBody = data && typeof data === 'object' ? (data.message || data.detail || data.error) : null;
    const fromText = typeof data === 'string' && data.length < 300 && !data.trim().startsWith('<') ? data : null;
    const message = fromBody || fromText || defaultMessage(res.status);

    // A 401 on a protected call means the token is missing/expired. Login/register 401s
    // ("Invalid email or password") are normal form errors and must not log the user out.
    if (res.status === 401 && auth) {
      clearAuth();
      try { sessionStorage.setItem('surplus_notice', 'Your session has expired. Please sign in again.'); } catch { /* ignore */ }
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(message, res.status, data);
  }
  return data;
}

const get = path => request(path);
const post = (path, body) => request(path, { method: 'POST', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const del = path => request(path, { method: 'DELETE' });
const enc = encodeURIComponent;

/* ------------------------------------------------------------------ endpoints */

export const api = {
  // AuthController  /api/auth  (public)
  login: body => request('/auth/login', { method: 'POST', body, auth: false }),
  register: body => request('/auth/register', { method: 'POST', body, auth: false }),

  // OrganizationController  /api/organizations
  getOrganizationByUser: userId => get(`/organizations/user/${enc(userId)}`), // 404 => no organization yet
  getOrganization: id => get(`/organizations/${enc(id)}`),
  createOrganization: (userId, body) => post(`/organizations/user/${enc(userId)}`, body),
  updateOrganization: (id, body) => put(`/organizations/${enc(id)}`, body),

  // SurplusController  /api/surplus
  getSurplus: () => get('/surplus'),
  getAvailableSurplus: () => get('/surplus/available'),
  getSurplusById: id => get(`/surplus/${enc(id)}`),
  getOrgSurplus: orgId => get(`/surplus/organization/${enc(orgId)}`),
  createSurplus: (orgId, body) => post(`/surplus/organization/${enc(orgId)}`, body),
  updateSurplus: (id, body) => put(`/surplus/${enc(id)}`, body),
  updateSurplusStatus: (id, status) => patch(`/surplus/${enc(id)}/status/${enc(status)}`),
  deleteSurplus: id => del(`/surplus/${enc(id)}`),

  // NeedController  /api/needs
  getNeeds: () => get('/needs'),
  getOpenNeeds: () => get('/needs/open'),
  getNeedById: id => get(`/needs/${enc(id)}`),
  getOrgNeeds: orgId => get(`/needs/organization/${enc(orgId)}`),
  createNeed: (orgId, body) => post(`/needs/organization/${enc(orgId)}`, body),
  updateNeed: (id, body) => put(`/needs/${enc(id)}`, body),
  updateNeedStatus: (id, status) => patch(`/needs/${enc(id)}/status/${enc(status)}`),
  deleteNeed: id => del(`/needs/${enc(id)}`),

  // MatchingController  /api/matches
  getActiveMatches: () => get('/matches/active'),
  getBestMatchesForSurplus: id => get(`/matches/surplus/${enc(id)}/best`),
  getBestMatchesForNeed: id => get(`/matches/need/${enc(id)}/best`),
  scoreMatch: (surplusId, needId) => get(`/matches/score?surplusId=${enc(surplusId)}&needId=${enc(needId)}`),
  createMatch: (surplusId, needId) => post(`/matches?surplusId=${enc(surplusId)}&needId=${enc(needId)}`), // ADMIN only
  expireMatch: id => patch(`/matches/${enc(id)}/expire`), // ADMIN only

  // RequestController  /api/requests
  getAllRequests: () => get('/requests'), // ADMIN only
  getProviderRequests: orgId => get(`/requests/provider/${enc(orgId)}`),
  getRecipientRequests: orgId => get(`/requests/recipient/${enc(orgId)}`),
  createRequest: body => post('/requests', body), // { matchId, quantityRequested, message? }
  updateRequestStatus: (id, status) => patch(`/requests/${enc(id)}/status`, { status }),
  cancelRequest: id => patch(`/requests/${enc(id)}/cancel`),

  // DeliveryController  /api/deliveries
  getAllDeliveries: () => get('/deliveries'), // ADMIN only
  getOrgDeliveries: orgId => get(`/deliveries/organization/${enc(orgId)}`),
  getDeliveryByRequest: requestId => get(`/deliveries/request/${enc(requestId)}`),
  createDelivery: body => post('/deliveries', body), // { requestId, deliveryMethod, expectedPickupAt }
  updateDeliveryStatus: (id, status) => patch(`/deliveries/${enc(id)}/status`, { status }),
  scheduleDelivery: (id, body) => patch(`/deliveries/${enc(id)}/schedule`, body), // { expectedPickupAt, expectedDeliveryAt }

  // ImpactController  /api/impact
  getImpact: () => get('/impact'),
  getOrgImpact: orgId => get(`/impact/organization/${enc(orgId)}`),

  // EmergencyController  /api/emergencies
  getAllEmergencies: () => get('/emergencies'),
  getActiveEmergencies: () => get('/emergencies/active'),
  createEmergency: body => post('/emergencies', body),
  updateEmergencyStatus: (id, status) => patch(`/emergencies/${enc(id)}/status`, { status }),

  // NotificationController  /api/notifications
  getNotifications: userId => get(`/notifications/user/${enc(userId)}`),
  getUnreadCount: userId => get(`/notifications/user/${enc(userId)}/unread/count`),
  markNotificationRead: id => patch(`/notifications/${enc(id)}/read`),
  markAllNotificationsRead: userId => patch(`/notifications/user/${enc(userId)}/read-all`)
};