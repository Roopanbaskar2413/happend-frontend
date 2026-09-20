import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="planner-page">
      <div className="planner-form-wrap">
        <h1>Forgot password</h1>
        {sent ? (
          <p className="planner-form-sub">
            If an account exists for that email, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <>
            <p className="planner-form-sub">Enter your email and we'll send you a reset link.</p>
            {error && <p className="error">{error}</p>}
            <form className="planner-form" onSubmit={handleSubmit}>
              <label>
                Email
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button type="submit" className="planner-submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <p className="planner-form-sub">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
