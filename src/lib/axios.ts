import axios from "axios";

function getCookieValue(name: string) {
  if (typeof document === "undefined") {
    return undefined;
  }

  const pair = document.cookie
    .split("; ")
    .find((cookieEntry) => cookieEntry.startsWith(`${name}=`));

  return pair ? decodeURIComponent(pair.split("=")[1] ?? "") : undefined;
}

function setCookieValue(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === "undefined") {
    return;
  }

  const parts = [`${name}=${encodeURIComponent(value)}`, "path=/", "SameSite=Lax"];

  if (typeof maxAgeSeconds === "number") {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }

  document.cookie = parts.join("; ");
}

function clearAuthCookies() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = "access=; path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "refresh=; path=/; Max-Age=0; SameSite=Lax";
}

function stripBearerPrefix(token: string) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

function buildBearerHeader(token: string) {
  return `Bearer ${stripBearerPrefix(token)}`;
}

function decodeJwtExpMs(token: string) {
  try {
    const [, payloadPart] = stripBearerPrefix(token).split(".");

    if (!payloadPart) {
      return null;
    }

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as { exp?: number };

    if (typeof payload.exp !== "number") {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function shouldSkipAuth(url?: string) {
  if (!url) {
    return false;
  }

  return url.includes("/auth/login/") || url.includes("/auth/refresh/");
}

function shouldHandleAsProtected(url?: string) {
  return !shouldSkipAuth(url);
}

function normalizeMethod(method: string | undefined) {
  return (method ?? "get").toUpperCase();
}

function resolveRequestUrl(baseURL: string | undefined, url: string | undefined) {
  if (!url) {
    return baseURL ?? "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (!baseURL) {
    return url;
  }

  const base = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function clearSessionAndRedirect() {
  clearAuthCookies();
  redirectToLogin();
}

type RefreshResponseShape = {
  access?: string;
  access_token?: string;
  token?: string;
  refresh?: string;
  refresh_token?: string;
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = getCookieValue("refresh");

    if (!refreshToken) {
      return null;
    }

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: stripBearerPrefix(refreshToken) }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as RefreshResponseShape | null;
    const nextAccess = payload?.access ?? payload?.access_token ?? payload?.token;
    const nextRefresh = payload?.refresh ?? payload?.refresh_token;

    if (!nextAccess) {
      return null;
    }

    setCookieValue("access", stripBearerPrefix(nextAccess));

    if (nextRefresh) {
      setCookieValue("refresh", stripBearerPrefix(nextRefresh));
    }

    return stripBearerPrefix(nextAccess);
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function getValidAccessTokenForRequest(url?: string) {
  if (shouldSkipAuth(url)) {
    return null;
  }

  const accessToken = getCookieValue("access");

  if (!accessToken) {
    return null;
  }

  const expMs = decodeJwtExpMs(accessToken);
  const refreshLeadMs = 60 * 1000;

  if (expMs !== null && expMs - Date.now() <= refreshLeadMs) {
    const refreshed = await refreshAccessToken();
    return refreshed;
  }

  return stripBearerPrefix(accessToken);
}

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1",
});

axiosInstance.interceptors.request.use(async (config) => {
  const requestUrl = resolveRequestUrl(config.baseURL, config.url);
  const method = normalizeMethod(config.method);

  if (shouldSkipAuth(config.url)) {
    if (config.headers && "Authorization" in config.headers) {
      delete (config.headers as Record<string, string>).Authorization;
    }

    console.debug("[API request]", {
      url: requestUrl,
      method,
      hasAuth: false,
      auth: "none",
      payload: config.data ?? null,
    });
    return config;
  }

  const accessToken = await getValidAccessTokenForRequest(config.url);

  if (!accessToken) {
    console.debug("[API request]", {
      url: requestUrl,
      method,
      hasAuth: false,
      auth: "none",
      payload: config.data ?? null,
    });
    return config;
  }

  config.headers = config.headers ?? {};
  (config.headers as Record<string, string>).Authorization = buildBearerHeader(accessToken);

  console.debug("[API request]", {
    url: requestUrl,
    method,
    hasAuth: true,
    auth: "Bearer ***",
    payload: config.data ?? null,
  });

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    console.debug("[API response]", {
      url: resolveRequestUrl(response.config.baseURL, response.config.url),
      method: normalizeMethod(response.config.method),
      status: response.status,
      body: response.data ?? null,
    });
    return response;
  },
  async (error) => {
    const responseStatus = error.response?.status;
    const originalRequest = error.config as
      | (typeof error.config & {
          _retry?: boolean;
        })
      | undefined;

    console.debug("[API error]", {
      url: resolveRequestUrl(originalRequest?.baseURL, originalRequest?.url),
      method: normalizeMethod(originalRequest?.method),
      status: responseStatus ?? null,
      body: error.response?.data ?? null,
    });

    if (
      responseStatus === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      shouldHandleAsProtected(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const refreshedAccess = await refreshAccessToken();

      if (!refreshedAccess) {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      originalRequest.headers = originalRequest.headers ?? {};
      (originalRequest.headers as Record<string, string>).Authorization = buildBearerHeader(refreshedAccess);
      return axiosInstance(originalRequest);
    }

    if (responseStatus === 401 && originalRequest && shouldHandleAsProtected(originalRequest.url)) {
      clearSessionAndRedirect();
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;