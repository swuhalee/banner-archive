const ALLOWED_RETURN_PATHS = new Set(["/", "/archive", "/stats"]);

// 사용자가 넘긴 from 값을 "앱 내부 경로" 형태로 정리하는 함수
// 예) /archive/?x=1 -> /archive
// 보안상 위험할 수 있는 형태(외부 URL, //, 백슬래시 등)는 null 반환
function normalizePath(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  if (trimmed.includes("\\")) return null;

  const [pathOnly] = trimmed.split(/[?#]/, 1);
  if (!pathOnly) return null;
  if (pathOnly !== "/" && pathOnly.endsWith("/")) return pathOnly.slice(0, -1);
  return pathOnly;
}

// 최종적으로 허용된 경로 목록에 있는 값만 통과시킴
// 유효하지 않으면 fallback(기본값)으로 안전하게 대체
export function sanitizeReturnPath(input: string | null | undefined, fallback: "/" | "/archive" | "/stats" = "/") {
  if (!input) return fallback;
  const normalized = normalizePath(input);
  if (!normalized) return fallback;
  if (!ALLOWED_RETURN_PATHS.has(normalized)) return fallback;
  return normalized as "/" | "/archive" | "/stats";
}
