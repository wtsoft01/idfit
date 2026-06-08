import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Landing from "./Landing";

const Index = () => {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/app/board" replace />;
  return <Landing />;
};

export default Index;
