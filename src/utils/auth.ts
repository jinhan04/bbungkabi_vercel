export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function removeToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}
