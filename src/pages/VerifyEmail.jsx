import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { verifyEmail } = useAuth();
  const [state, setState] = useState("verifying"); // verifying | done | error
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setError("Missing verification token.");
      return;
    }
    verifyEmail(token)
      .then(() => setState("done"))
      .catch((err) => {
        setState("error");
        setError(err.message);
      });
    // Only ever run once per page load, regardless of context identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="planner-page">
      <div className="planner-form-wrap">
        <h1>Email verification</h1>
        {state === "verifying" && <p className="planner-form-sub">Verifying your email…</p>}
        {state === "done" && (
          <>
            <p className="planner-form-sub">Your email is verified.</p>
            <Link to="/trips" className="planner-submit" style={{ display: "inline-block", textAlign: "center" }}>
              Go to my trips
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <p className="error">{error}</p>
            <p className="planner-form-sub">
              This link may have expired. <Link to="/login">Log in</Link> and request a new one.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
