import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import Landing from "./pages/Landing.jsx";
import PlannerForm from "./pages/PlannerForm.jsx";
import SelectStay from "./pages/SelectStay.jsx";
import Itinerary from "./pages/Itinerary.jsx";
import TripSummary from "./pages/TripSummary.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import MyTrips from "./pages/MyTrips.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/plan" element={<PlannerForm />} />
          <Route path="/plan/stay" element={<SelectStay />} />
          <Route path="/itinerary" element={<Itinerary />} />
          <Route path="/summary" element={<TripSummary />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/trips"
            element={
              <ProtectedRoute>
                <MyTrips />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
