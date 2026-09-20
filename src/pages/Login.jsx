import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from ?? "/trips");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="planner-page">
      <div className="planner-form-wrap">
        <h1>Log in</h1>
        <p className="planner-form-sub">Welcome back.</p>
        {error && <p className="error">{error}</p>}
        <form className="planner-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="planner-submit" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="planner-form-sub">
          No account yet? <Link to="/signup">Sign up</Link>
        </p>
        <p className="planner-form-sub">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
