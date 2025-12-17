import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrderProvider } from "@/contexts/OrderContext";
import { WorkLogProvider } from "@/contexts/WorkLogContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import TrackOrder from "./pages/TrackOrder";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sales = lazy(() => import("./pages/Sales"));
const Design = lazy(() => import("./pages/Design"));
const Prepress = lazy(() => import("./pages/Prepress"));
const Production = lazy(() => import("./pages/Production"));
const Dispatch = lazy(() => import("./pages/Dispatch"));
const Dispatched = lazy(() => import("./pages/Dispatched"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const Team = lazy(() => import("./pages/Team"));
const Reports = lazy(() => import("./pages/Reports"));
const PerformanceReports = lazy(() => import("./pages/PerformanceReports"));
const Settings = lazy(() => import("./pages/Settings"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <OrderProvider>
          <WorkLogProvider>
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
                  <Route path="/" element={
                    <Suspense fallback={<PageLoader />}>
                      <Dashboard />
                    </Suspense>
                  } />
                  <Route path="/dashboard" element={
                    <Suspense fallback={<PageLoader />}>
                      <Dashboard />
                    </Suspense>
                  } />
                  
                  {/* Sales - accessible by admin and sales */}
                  <Route path="/sales" element={
                    <ProtectedRoute allowedRoles={['admin', 'sales']}>
                      <Suspense fallback={<PageLoader />}>
                        <Sales />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  
                  {/* Design - accessible by admin and design */}
                  <Route path="/design" element={
                    <ProtectedRoute allowedRoles={['admin', 'design']}>
                      <Suspense fallback={<PageLoader />}>
                        <Design />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  
                  {/* Prepress - accessible by admin and prepress */}
                  <Route path="/prepress" element={
                    <ProtectedRoute allowedRoles={['admin', 'prepress']}>
                      <Suspense fallback={<PageLoader />}>
                        <Prepress />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  
                  {/* Production - accessible by admin and production */}
                  <Route path="/production" element={
                    <ProtectedRoute allowedRoles={['admin', 'production']}>
                      <Suspense fallback={<PageLoader />}>
                        <Production />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  
                  {/* Dispatch - accessible by admin and production */}
                  <Route path="/dispatch" element={
                    <ProtectedRoute allowedRoles={['admin', 'production']}>
                      <Suspense fallback={<PageLoader />}>
                        <Dispatch />
                      </Suspense>
                    </ProtectedRoute>
                  } />

                  {/* Dispatched Orders - accessible by admin and sales */}
                  <Route path="/dispatched" element={
                    <ProtectedRoute allowedRoles={['admin', 'sales']}>
                      <Suspense fallback={<PageLoader />}>
                        <Dispatched />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/orders/:orderId" element={
                    <Suspense fallback={<PageLoader />}>
                      <OrderDetail />
                    </Suspense>
                  } />
                  <Route path="/profile" element={
                    <Suspense fallback={<PageLoader />}>
                      <Profile />
                    </Suspense>
                  } />
                  
                  {/* Admin-only routes */}
                  <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <Admin />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/team" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <Team />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/reports" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <Reports />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/performance" element={
                    <Suspense fallback={<PageLoader />}>
                      <PerformanceReports />
                    </Suspense>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <Settings />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                </Route>
                
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
          </WorkLogProvider>
        </OrderProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;