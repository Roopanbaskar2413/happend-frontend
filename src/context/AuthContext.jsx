import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .getMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  async function doSignup(email, password) {
    const u = await authApi.signup(email, password);
    setUser(u);
    return u;
  }

  async function doLogin(email, password) {
    const u = await authApi.login(email, password);
    setUser(u);
    return u;
  }

  async function doLogout() {
    await authApi.logout();
    setUser(null);
  }

  async function doVerifyEmail(token) {
    const u = await authApi.verifyEmail(token);
    setUser(u);
    return u;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signup: doSignup, login: doLogin, logout: doLogout, verifyEmail: doVerifyEmail }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
