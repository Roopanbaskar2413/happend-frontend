import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-card__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
        <h1>Page not found</h1>
        <p className="planner-form-sub">
          That page doesn't exist — it may have moved, or the link was mistyped.
        </p>
        <Link to="/" className="planner-submit" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
