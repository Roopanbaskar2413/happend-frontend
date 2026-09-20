import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { resendVerification } from "../../api/auth.js";

export default function VerifyBanner() {
  const { user } = useAuth();
  const [state, setState] = useState("idle"); // idle | sending | sent | error

  if (!user || user.email_verified) return null;

  async function handleResend() {
    setState("sending");
    try {
      await resendVerification();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="verify-banner">
      <span>Verify your email to secure your account.</span>
      {state === "sent" ? (
        <span>Sent — check your inbox.</span>
      ) : (
        <button type="button" onClick={handleResend} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Resend verification email"}
        </button>
      )}
    </div>
  );
}
