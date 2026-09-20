import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth.js";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      navigate("/login", { state: { justReset: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="planner-page">
        <div className="planner-form-wrap">
          <h1>Reset password</h1>
          <p className="error">This link is missing its reset token.</p>
          <p className="planner-form-sub">
            <Link to="/forgot-password">Request a new reset link</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="planner-page">
      <div className="planner-form-wrap">
        <h1>Reset password</h1>
        <p className="planner-form-sub">Choose a new password (at least 8 characters).</p>
        {error && <p className="error">{error}</p>}
        <form className="planner-form" onSubmit={handleSubmit}>
          <label>
            New password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="planner-submit" disabled={submitting}>
            {submitting ? "Resetting…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
