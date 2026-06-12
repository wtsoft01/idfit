import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Landing from "./Landing";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const isStaff = ["owner", "admin", "operator", "support"].includes(profile?.role ?? "");
  if (!loading && user && isStaff) return <Navigate to="/app/board" replace />;
  return <Landing />;
};

export default Index;
