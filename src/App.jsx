import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import VerifyBanner from "./components/common/VerifyBanner.jsx";
import Landing from "./pages/Landing.jsx";
import PlannerForm from "./pages/PlannerForm.jsx";
import SelectStay from "./pages/SelectStay.jsx";
import Itinerary from "./pages/Itinerary.jsx";
import TripSummary from "./pages/TripSummary.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import MyTrips from "./pages/MyTrips.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Memories from "./pages/Memories.jsx";
import MemoryDetail from "./pages/MemoryDetail.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <VerifyBanner />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/plan" element={<PlannerForm />} />
          <Route path="/plan/stay" element={<SelectStay />} />
          <Route path="/itinerary" element={<Itinerary />} />
          <Route path="/summary" element={<TripSummary />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/trips"
            element={
              <ProtectedRoute>
                <MyTrips />
              </ProtectedRoute>
            }
          />
          <Route
            path="/memories"
            element={
              <ProtectedRoute>
                <Memories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/memories/:id"
            element={
              <ProtectedRoute>
                <MemoryDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
