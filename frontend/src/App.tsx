import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { getToken } from "./services/api";

const THEME_KEY = "theme";

function getInitialTheme(): boolean {
  return localStorage.getItem(THEME_KEY) === "dark";
}

function App() {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) html.classList.add("dark");
    else html.classList.remove("dark");
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: isDark ? "!bg-slate-800 !text-slate-100" : "",
          duration: 3000,
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage
                isDark={isDark}
                onToggleDarkMode={() => setIsDark((prev) => !prev)}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminPage
                isDark={isDark}
                onToggleDarkMode={() => setIsDark((prev) => !prev)}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={getToken() ? "/" : "/login"} replace />}
        />
      </Routes>
    </>
  );
}

export default App;
