export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

export function isApiUrl(url: string) {
  return url === API_BASE_URL || url.startsWith(`${API_BASE_URL}/`);
}
