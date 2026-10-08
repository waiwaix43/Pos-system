"use client";
import { useEffect } from "react";
import { API_BASE_URL, isApiUrl } from "@/lib/api";

export default function FetchInterceptor() {
  useEffect(() => {
    if ((window as any)._fetchPatched) return;
    (window as any)._fetchPatched = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

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
            window.location.href = '/pin';
          }
        }

        return response;
      } catch (err) {
        // If fetch fails (network error), don't break the app - just rethrow
        throw err;
      }
    };
  }, []);

  return null;
}
