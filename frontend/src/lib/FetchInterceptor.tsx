"use client";
import { useEffect } from "react";
import { API_BASE_URL, isApiUrl } from "@/lib/api";

function patchWindowFetch() {
  if (typeof window === "undefined" || (window as any)._fetchPatched) return;
  (window as any)._fetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  const isRemoteHost = !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      if (isRemoteHost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) {
        url = url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
        if (typeof input === 'string' || input instanceof URL) {
          input = url;
        }
      }

      if (isApiUrl(url)) {
        const userContext = localStorage.getItem('userContext');
        let token = '';
        if (userContext) {
          try {
            token = JSON.parse(userContext).token || '';
          } catch (e) {}
        }

        if (token) {
          const headers = new Headers(init?.headers);
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          init = { ...init, headers };
        }
      }

      const response = await originalFetch(input, init);

        const expiredToken = response.status === 403
          ? (await response.clone().json().catch(() => null))?.error === 'Token expired'
          : false;
        if (response.status === 401 || expiredToken) {
          const path = window.location.pathname;
          if (path !== '/pin' && path !== '/' && path !== '/login' && path !== '/register') {
            const userContextRaw = localStorage.getItem('userContext');
            let pinEnabled = true;
            if (userContextRaw) {
              try {
                const u = JSON.parse(userContextRaw);
                if (u.pin_enabled === false) pinEnabled = false;
              } catch (e) {}
            }
            if (!pinEnabled) {
              localStorage.removeItem('userContext');
              window.location.href = '/';
            } else {
              window.location.href = '/pin';
            }
          }
        }

      return response;
    } catch (err) {
      // If fetch fails (network error), don't break the app - just rethrow
      throw err;
    }
  };
}

if (typeof window !== "undefined") {
  patchWindowFetch();
}

export default function FetchInterceptor() {
  useEffect(() => {
    patchWindowFetch();
  }, []);

  return null;
}
