"use client";
import { useEffect } from "react";
import { isApiUrl } from "@/lib/api";

interface ActiveInteraction {
  elements: Set<HTMLElement>;
  pendingCount: number;
}

const BUTTON_COOLDOWN_MS = 500;
const POST_SETTLE_COOLDOWN_MS = 350;

const buttonCooldownMap = new WeakMap<HTMLElement, number>();
const formCooldownMap = new WeakMap<HTMLFormElement, number>();
const inFlightMutations = new Map<string, Promise<Response>>();
let currentInteraction: ActiveInteraction | null = null;

function shouldAllowRapidClick(button: HTMLElement): boolean {
  if (button.closest('[data-allow-repeat="true"]')) return true;
  if (button.closest(".leaflet-container")) return true;

  const role = button.getAttribute("role");
  if (role === "tab" || role === "switch" || role === "checkbox" || role === "radio") {
    return true;
  }

  const label = (button.textContent || "").trim();
  if (/^([0-9]|00|\.|<|C|\+|-|−|×|✕|100|500|1000)$/.test(label)) {
    return true;
  }

  if (
    label === "" &&
    button.getAttribute("type") === "button" &&
    button.classList.contains("absolute") &&
    button.parentElement?.querySelector('input[type="password"], input[type="text"]')
  ) {
    return true;
  }

  return false;
}

function installGlobalButtonGuard() {
  if (typeof window === "undefined" || (window as any)._buttonGuardInstalled) return;
  (window as any)._buttonGuardInstalled = true;

  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as Element | null;
      const button = target?.closest?.(
        'button, input[type="submit"], input[type="button"]'
      ) as HTMLElement | null;
      if (!button) return;

      if (
        (button as HTMLButtonElement).disabled ||
        button.getAttribute("aria-disabled") === "true" ||
        button.getAttribute("data-submitting") === "true"
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (shouldAllowRapidClick(button)) {
        return;
      }

      const now = Date.now();
      const lockedUntil = buttonCooldownMap.get(button) || 0;
      if (now < lockedUntil) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      buttonCooldownMap.set(button, now + BUTTON_COOLDOWN_MS);

      const interaction: ActiveInteraction = {
        elements: new Set([button]),
        pendingCount: 0,
      };
      currentInteraction = interaction;
      window.setTimeout(() => {
        if (currentInteraction === interaction) {
          currentInteraction = null;
        }
      }, 0);
    },
    true
  );

  document.addEventListener(
    "submit",
    (e: Event) => {
      const form = e.target instanceof HTMLFormElement ? e.target : null;
      if (!form) return;

      const now = Date.now();
      const lockedUntil = formCooldownMap.get(form) || 0;
      if (form.getAttribute("data-submitting") === "true" || now < lockedUntil) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      formCooldownMap.set(form, now + BUTTON_COOLDOWN_MS);

      const submitButtons = Array.from(
        form.querySelectorAll<HTMLElement>('button[type="submit"], input[type="submit"]')
      );

      if (currentInteraction) {
        currentInteraction.elements.add(form);
        submitButtons.forEach((btn) => currentInteraction?.elements.add(btn));
      } else {
        const interaction: ActiveInteraction = {
          elements: new Set([form, ...submitButtons]),
          pendingCount: 0,
        };
        currentInteraction = interaction;
        window.setTimeout(() => {
          if (currentInteraction === interaction) {
            currentInteraction = null;
          }
        }, 0);
      }
    },
    true
  );
}

// แคช token ไว้ตามค่าดิบของ userContext: parse JSON เฉพาะเมื่อค่าเปลี่ยนจริง
// (ก่อนหน้านี้ JSON.parse ทุกครั้งที่เรียก fetch ซึ่งช้าเมื่อ userContext มีรูปโปรไฟล์ Base64)
let lastUserContextRaw: string | null = null;
let lastToken = '';

function getAuthToken(): string {
  const raw = localStorage.getItem('userContext');
  if (!raw) {
    lastUserContextRaw = null;
    lastToken = '';
    return '';
  }
  if (raw !== lastUserContextRaw) {
    lastUserContextRaw = raw;
    try {
      lastToken = JSON.parse(raw).token || '';
    } catch (e) {
      lastToken = '';
    }
  }
  return lastToken;
}

function patchWindowFetch() {
  if (typeof window === "undefined" || (window as any)._fetchPatched) return;
  (window as any)._fetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  const isRemoteHost = !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (
      init?.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

    const trackedInteraction = isMutation ? currentInteraction : null;
    if (trackedInteraction) {
      trackedInteraction.pendingCount += 1;
      trackedInteraction.elements.forEach((el) => {
        el.setAttribute("data-submitting", "true");
      });
    }

    try {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

      if (isRemoteHost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) {
        url = url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
        if (typeof input === 'string' || input instanceof URL) {
          input = url;
        }
      }

      if (isApiUrl(url)) {
        const token = getAuthToken();

        if (token) {
          const headers = new Headers(init?.headers);
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          init = { ...init, headers };
        }
      }

      const canDedupeMutation =
        isMutation &&
        isApiUrl(url) &&
        (init?.body == null || typeof init.body === "string");
      const mutationKey = canDedupeMutation
        ? `${method}:${url}:${typeof init?.body === "string" ? init.body : ""}`
        : null;

      let response: Response;
      if (mutationKey) {
        let sharedPromise = inFlightMutations.get(mutationKey);
        if (!sharedPromise) {
          sharedPromise = originalFetch(input, init).finally(() => {
            inFlightMutations.delete(mutationKey);
          });
          inFlightMutations.set(mutationKey, sharedPromise);
        }
        const pristineResponse = await sharedPromise;
        response = pristineResponse.clone();
      } else {
        response = await originalFetch(input, init);
      }

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
    } finally {
      if (trackedInteraction) {
        trackedInteraction.pendingCount = Math.max(0, trackedInteraction.pendingCount - 1);
        if (trackedInteraction.pendingCount === 0) {
          const unlockAt = Date.now() + POST_SETTLE_COOLDOWN_MS;
          trackedInteraction.elements.forEach((el) => {
            el.removeAttribute("data-submitting");
            if (el instanceof HTMLFormElement) {
              formCooldownMap.set(el, unlockAt);
            } else {
              buttonCooldownMap.set(el, unlockAt);
            }
          });
        }
      }
    }
  };
}

if (typeof window !== "undefined") {
  patchWindowFetch();
  installGlobalButtonGuard();
}

export default function FetchInterceptor() {
  useEffect(() => {
    patchWindowFetch();
    installGlobalButtonGuard();
  }, []);

  return null;
}
