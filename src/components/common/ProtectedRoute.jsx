import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // avoid a flash-redirect while /auth/me is in flight
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}
