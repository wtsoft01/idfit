import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/shells/AppShell";
import { AdminShell } from "@/components/shells/AdminShell";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

import UserBoard from "./pages/app/Board";
import UserOrders from "./pages/app/Orders";
import UserMe from "./pages/app/Me";
import UserAS from "./pages/app/AS";
import UserSupport from "./pages/app/Support";

import AdminSources from "./pages/admin/Sources";
import AdminFilters from "./pages/admin/Filters";
import AdminRaw from "./pages/admin/RawFeed";
import AdminCandidates from "./pages/admin/Candidates";
import AdminPricing from "./pages/admin/Pricing";
import AdminOrders from "./pages/admin/Orders";
import AdminRevenue from "./pages/admin/Revenue";
import AdminAutomation from "./pages/admin/Automation";
import AdminChat from "./pages/admin/Chat";
import AdminSettings from "./pages/admin/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30_000,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Navigate to="/auth" replace />} />

              <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                <Route index element={<Navigate to="board" replace />} />
                <Route path="board" element={<UserBoard />} />
                <Route path="orders" element={<UserOrders />} />
                <Route path="as" element={<UserAS />} />
                <Route path="me" element={<UserMe />} />
                <Route path="support" element={<UserSupport />} />
              </Route>

              <Route path="/admin" element={<AdminRoute><AdminShell /></AdminRoute>}>
                <Route index element={<Navigate to="sources" replace />} />
                <Route path="sources" element={<AdminSources />} />
                <Route path="filters" element={<AdminFilters />} />
                <Route path="raw" element={<AdminRaw />} />
                <Route path="candidates" element={<AdminCandidates />} />
                <Route path="pricing" element={<AdminPricing />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="revenue" element={<AdminRevenue />} />
                <Route path="automation" element={<AdminAutomation />} />
                <Route path="chat" element={<AdminChat />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
