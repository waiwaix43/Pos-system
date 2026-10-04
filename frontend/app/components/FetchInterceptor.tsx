"use client";
import { useEffect } from "react";

export default function FetchInterceptor() {
  useEffect(() => {
    if ((window as any)._fetchPatched) return;
    (window as any)._fetchPatched = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

        if (url.includes('localhost:5000')) {
          const userContext = localStorage.getItem('userContext');
          let token = '';
          if (userContext) {
            try {
              token = JSON.parse(userContext).token || '';
            } catch (e) {}
          }

          if (token) {
            // Use plain object for headers to avoid any compatibility issues
            const existingHeaders: Record<string, string> = {};
            if (init?.headers) {
              if (init.headers instanceof Headers) {
                init.headers.forEach((value, key) => { existingHeaders[key] = value; });
              } else if (Array.isArray(init.headers)) {
                init.headers.forEach(([key, value]) => { existingHeaders[key] = value; });
              } else {
                Object.assign(existingHeaders, init.headers);
              }
            }
            if (!existingHeaders['Authorization'] && !existingHeaders['authorization']) {
              existingHeaders['Authorization'] = `Bearer ${token}`;
            }
            init = { ...init, headers: existingHeaders };
          }
        }

        const response = await originalFetch(input, init);

        if (response.status === 401) {
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
