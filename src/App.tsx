import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrderProvider } from "@/contexts/OrderContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Design from "./pages/Design";
import Prepress from "./pages/Prepress";
import Production from "./pages/Production";
import Dispatch from "./pages/Dispatch";
import OrderDetail from "./pages/OrderDetail";
import TrackOrder from "./pages/TrackOrder";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Team from "./pages/Team";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <OrderProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/track" element={<TrackOrder />} />
                <Route path="/auth" element={<Auth />} />
                
                {/* Protected routes */}
                <Route element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  
                  {/* Sales - accessible by admin and sales */}
                  <Route path="/sales" element={
                    <ProtectedRoute allowedRoles={['admin', 'sales']}>
                      <Sales />
                    </ProtectedRoute>
                  } />
                  
                  {/* Design - accessible by admin and design */}
                  <Route path="/design" element={
                    <ProtectedRoute allowedRoles={['admin', 'design']}>
                      <Design />
                    </ProtectedRoute>
                  } />
                  
                  {/* Prepress - accessible by admin and prepress */}
                  <Route path="/prepress" element={
                    <ProtectedRoute allowedRoles={['admin', 'prepress']}>
                      <Prepress />
                    </ProtectedRoute>
                  } />
                  
                  {/* Production - accessible by admin and production */}
                  <Route path="/production" element={
                    <ProtectedRoute allowedRoles={['admin', 'production']}>
                      <Production />
                    </ProtectedRoute>
                  } />
                  
                  {/* Dispatch - accessible by admin and production */}
                  <Route path="/dispatch" element={
                    <ProtectedRoute allowedRoles={['admin', 'production']}>
                      <Dispatch />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/orders/:orderId" element={<OrderDetail />} />
                  <Route path="/profile" element={<Profile />} />
                  
                  {/* Admin-only routes */}
                  <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Admin />
                    </ProtectedRoute>
                  } />
                  <Route path="/team" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Team />
                    </ProtectedRoute>
                  } />
                  <Route path="/reports" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Reports />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Settings />
                    </ProtectedRoute>
                  } />
                </Route>
                
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </OrderProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;