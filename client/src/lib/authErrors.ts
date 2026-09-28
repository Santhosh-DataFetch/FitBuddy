const GENERIC_AUTH_ERROR = "We couldn't complete that request. Please try again.";

export function safeAuthErrorMessage(error: unknown, action: "signIn" | "signUp" | "reset" | "passwordChange" = "signIn") {
  const raw = error instanceof Error ? error.message.toLowerCase() : "";
  if (raw.includes("rate limit") || raw.includes("too many requests")) return "Please wait a moment and try again.";
  if (raw.includes("leaked") || raw.includes("compromised") || raw.includes("pwned") || raw.includes("weak password")) return "Choose a password that has not appeared in a public breach.";
  if (raw.includes("password") && (raw.includes("length") || raw.includes("characters") || raw.includes("weak"))) return "Use a stronger password with at least 8 characters.";
  if (action === "signIn" && (raw.includes("invalid login") || raw.includes("invalid credentials") || raw.includes("email not confirmed"))) return "That email or password doesn't look right.";
  if (action === "signUp" && raw.includes("already registered")) return "An account with that email already exists. Try signing in instead.";
  if (action === "reset") return "If an account exists for that email, a reset link is on its way.";
  if (action === "passwordChange") return "We couldn't update your password. Please choose another password and try again.";
  return GENERIC_AUTH_ERROR;
}

export const authErrorTesting = { GENERIC_AUTH_ERROR };
