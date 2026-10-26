import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { MailIcon, LockIcon } from "../components/icons/AuthIcons.jsx";

export default function Signup() {
  const { signup } = useAuth();
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
      await signup(email, password);
      navigate(location.state?.from ?? "/trips");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-card__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
        <h1>Create an account</h1>
        <p className="planner-form-sub">Save your trips and get a reminder before you go.</p>
        {error && <p className="error">{error}</p>}
        <form className="planner-form" onSubmit={handleSubmit}>
          <label>
            Email
            <span className="auth-input-icon">
              <MailIcon />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </span>
          </label>
          <label>
            Password
            <span className="auth-input-icon">
              <LockIcon />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </span>
          </label>
          <button type="submit" className="planner-submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="planner-form-sub">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
