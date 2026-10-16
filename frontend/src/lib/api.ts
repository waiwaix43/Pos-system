const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
const isLocalApiUrl = (() => {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(configuredApiUrl).hostname);
  } catch {
    return false;
  }
})();

export const API_BASE_URL = (
  process.env.NODE_ENV === "production" && isLocalApiUrl
    ? ""
    : configuredApiUrl || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")
).replace(/\/$/, "");

export function isApiUrl(url: string) {
  if (API_BASE_URL) {
    return url === API_BASE_URL || url.startsWith(`${API_BASE_URL}/`);
  }

  const pathname = new URL(url, "http://localhost").pathname;
  return pathname === "/api" || pathname.startsWith("/api/");
}
