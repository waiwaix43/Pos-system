const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || "";

export const API_BASE_URL = (
  configuredApiUrl || "http://localhost:5000"
).replace(/\/$/, "");

export function isApiUrl(url: string) {
  if (API_BASE_URL) {
    return url === API_BASE_URL || url.startsWith(`${API_BASE_URL}/`);
  }

  const pathname = new URL(url, "http://localhost").pathname;
  return pathname === "/api" || pathname.startsWith("/api/");
}
