export type AuthCallback =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string };

// Only the server may validate these credentials or grant a session. Never
// infer identity or company access from a fragment or an unverified JWT.
export function readAuthCallback(hash: string): AuthCallback | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token"), refreshToken = params.get("refresh_token");
  if (params.has("error") || params.has("error_code")) {
    return { kind: "error", message: params.get("error_code") === "otp_expired"
      ? "This email link has expired. Request a new link and try again."
      : "This email link could not be completed. Please sign in or request a new link." };
  }
  if (!accessToken && !refreshToken) return null;
  if (!accessToken || !refreshToken || accessToken.length > 8000 || refreshToken.length > 8000)
    return { kind: "error", message: "This sign-in link is incomplete. Please sign in with your email and password." };
  return { kind: "session", accessToken, refreshToken };
}
