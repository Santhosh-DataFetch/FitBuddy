import { describe, expect, it } from "vitest";
import { authErrorTesting, safeAuthErrorMessage } from "./authErrors";

describe("safeAuthErrorMessage", () => {
  it("never exposes the provider message for compromised passwords", () => {
    const message = safeAuthErrorMessage(new Error("Password found in HaveIBeenPwned compromised list: internal detail"), "signUp");
    expect(message).toBe("Choose a password that has not appeared in a public breach.");
    expect(message).not.toContain("HaveIBeenPwned");
  });
  it("turns rate limits into a safe retry message", () => {
    expect(safeAuthErrorMessage(new Error("email rate limit exceeded"), "reset")).toBe("Please wait a moment and try again.");
  });
  it("uses generic messages for unknown provider errors", () => {
    expect(safeAuthErrorMessage(new Error("internal postgres detail"), "signIn")).toBe(authErrorTesting.GENERIC_AUTH_ERROR);
  });
  it("keeps reset requests privacy-preserving", () => {
    expect(safeAuthErrorMessage(new Error("unexpected reset error"), "reset")).toBe("If an account exists for that email, a reset link is on its way.");
  });
});
