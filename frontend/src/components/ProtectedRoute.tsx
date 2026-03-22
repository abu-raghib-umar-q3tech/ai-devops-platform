import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { getAuthRole, getToken } from "../services/api";

type ProtectedRouteProps = {
  children: ReactElement;
  requireAdmin?: boolean;
};

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: Readonly<ProtectedRouteProps>) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  if (requireAdmin && getAuthRole() !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

