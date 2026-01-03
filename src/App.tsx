import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrderProvider } from "@/features/orders/context/OrderContext";
import { WorkLogProvider } from "@/contexts/WorkLogContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "@/features/auth/pages/Auth";
import TrackOrder from "@/features/orders/pages/TrackOrder";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("@/features/dashboard/pages/Dashboard"));
const Sales = lazy(() => import("@/features/orders/pages/Sales"));
const Design = lazy(() => import("@/features/orders/pages/Design"));
const Prepress = lazy(() => import("@/features/orders/pages/Prepress"));
const Production = lazy(() => import("@/features/orders/pages/Production"));
const Outsource = lazy(() => import("@/features/orders/pages/Outsource"));
const Dispatch = lazy(() => import("@/features/orders/pages/Dispatch"));
const Dispatched = lazy(() => import("@/features/orders/pages/Dispatched"));
const Orders = lazy(() => import("@/features/orders/pages/Orders"));
const OrderDetail = lazy(() => import("@/features/orders/pages/OrderDetail"));
const Profile = lazy(() => import("@/features/settings/pages/Profile"));
const HowWeWork = lazy(() => import("@/features/dashboard/pages/HowWeWork"));
const Admin = lazy(() => import("@/features/admin/pages/Admin"));
const Team = lazy(() => import("@/features/admin/pages/Team"));
const Reports = lazy(() => import("@/features/reports/pages/Reports"));
const PerformanceReports = lazy(() => import("@/features/reports/pages/PerformanceReports"));
const AnalyticsDashboard = lazy(() => import("@/features/dashboard/pages/AnalyticsDashboard"));
const DepartmentEfficiencyReports = lazy(() => import("@/features/reports/pages/DepartmentEfficiencyReports"));
const UserProductivityReports = lazy(() => import("@/features/reports/pages/UserProductivityReports"));
const VendorAnalytics = lazy(() => import("@/features/reports/pages/VendorAnalytics"));
const Settings = lazy(() => import("@/features/settings/pages/Settings"));

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
            <AnalyticsProvider>
              <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
                  
                  {/* Outsource - accessible by admin, sales, and prepress */}
                  <Route path="/outsource" element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'prepress']}>
                      <Suspense fallback={<PageLoader />}>
                        <Outsource />
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
                  
                  {/* Orders route - accessible by admin and sales only */}
                  <Route path="/orders" element={
                    <ProtectedRoute allowedRoles={['admin', 'sales']}>
                      <Suspense fallback={<PageLoader />}>
                        <Orders />
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
                  
                  <Route path="/how-we-work" element={
                    <Suspense fallback={<PageLoader />}>
                      <HowWeWork />
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
                  <Route path="/analytics" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <AnalyticsDashboard />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/reports/department-efficiency" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <DepartmentEfficiencyReports />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/reports/user-productivity" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <UserProductivityReports />
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/reports/vendor-analytics" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<PageLoader />}>
                        <VendorAnalytics />
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
            </AnalyticsProvider>
          </WorkLogProvider>
        </OrderProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;