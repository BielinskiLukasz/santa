export type Route =
  | { kind: "home" }
  | { kind: "create" }
  | { kind: "admin"; drawId: string; adminToken: string }
  | { kind: "draw"; drawId: string; token: string; rescue: string | null };

export function parseHash(): Route {
  if (typeof window === "undefined") return { kind: "home" };
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, search = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean);
  const params = new URLSearchParams(search);
  if (segments[0] === "create") return { kind: "create" };
  if (segments[0] === "a" && segments[1]) {
    return {
      kind: "admin",
      drawId: segments[1],
      adminToken: params.get("t") ?? "",
    };
  }
  if (segments[0] === "d" && segments[1] && params.get("t")) {
    return {
      kind: "draw",
      drawId: segments[1],
      token: params.get("t") ?? "",
      rescue: params.get("k"),
    };
  }
  return { kind: "home" };
}

export function go(path: string): void {
  window.location.hash = path.startsWith("#") ? path : `#/${path}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Link capability: parametry wyłącznie w hashu, nigdy w ścieżce serwera. */
export function absoluteHash(path: string): string {
  if (typeof window === "undefined") return path;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${path.startsWith("#") ? path : `#/${path}`}`;
}
