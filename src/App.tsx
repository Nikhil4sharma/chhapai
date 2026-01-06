
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AIAssistant } from "./components/ai/AIAssistant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OrderProvider } from "@/features/orders/context/OrderContext";
import { WorkLogProvider } from "@/contexts/WorkLogContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";
import { WorkflowProvider } from "@/contexts/WorkflowContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "@/features/auth/pages/Auth";
import TrackOrder from "@/features/orders/pages/TrackOrder";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("@/features/dashboard/pages/Dashboard"));
// Sales
const Sales = lazy(() => import("@/features/orders/pages/Sales"));
const Customers = lazy(() => import('@/features/customers/pages/Customers'));
// Design
const Design = lazy(() => import("@/features/orders/pages/Design"));
// Prepress
const Prepress = lazy(() => import("@/features/orders/pages/Prepress"));
// Production
const Production = lazy(() => import("@/features/orders/pages/Production"));
// Outsource
const Outsource = lazy(() => import("@/features/orders/pages/Outsource"));
// Dispatch
const Dispatch = lazy(() => import("@/features/orders/pages/Dispatch"));
const Dispatched = lazy(() => import("@/features/orders/pages/Dispatched"));
// Orders
const Orders = lazy(() => import("@/features/orders/pages/Orders"));
const OrderDetail = lazy(() => import("@/features/orders/pages/OrderDetail"));
// Settings & Profile
const Profile = lazy(() => import("@/features/settings/pages/Profile"));
const Settings = lazy(() => import("@/features/settings/pages/Settings"));
// Info
const HowWeWork = lazy(() => import("@/features/dashboard/pages/HowWeWork"));
// Admin
const Admin = lazy(() => import("@/features/admin/pages/Admin"));
const Team = lazy(() => import("@/features/admin/pages/Team"));
const AdminSettings = lazy(() => import('@/features/admin/pages/AdminSettings'));
const HRDashboard = lazy(() => import("@/features/admin/pages/HRDashboard"));
// Reports
const Reports = lazy(() => import("@/features/reports/pages/Reports"));
const PerformanceReports = lazy(() => import("@/features/reports/pages/PerformanceReports"));
const AnalyticsDashboard = lazy(() => import("@/features/dashboard/pages/AnalyticsDashboard"));
const DepartmentEfficiencyReports = lazy(() => import("@/features/reports/pages/DepartmentEfficiencyReports"));
const UserProductivityReports = lazy(() => import("@/features/reports/pages/UserProductivityReports"));
const VendorAnalytics = lazy(() => import("@/features/reports/pages/VendorAnalytics"));
// HR Employee View
const EmployeeDashboard = lazy(() => import('@/features/hr/pages/EmployeeDashboard'));
// Inventory
const InventoryDashboard = lazy(() => import("@/features/inventory/pages/InventoryDashboard"));

const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center">
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
              <WorkflowProvider>
                <TooltipProvider>
                  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/track" element={<TrackOrder />} />
                      <Route path="/login" element={<Navigate to="/auth" replace />} />

                      {/* Protected routes with AppLayout */}
                      <Route element={
                        <ProtectedRoute>
                          <AppLayout />
                        </ProtectedRoute>
                      }>
                        {/* Dashboard */}
                        <Route path="/" element={
                          <Suspense fallback={<PageLoader />}>
                            <Dashboard />
                          </Suspense>
                        } />
                        <Route path="/dashboard" element={<Navigate to="/" replace />} />

                        {/* Modules */}
                        <Route path="/orders" element={
                          <ProtectedRoute allowedRoles={['admin', 'sales', 'design', 'production', 'dispatch', 'super_admin']}>
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

                        {/* Sales */}
                        <Route path="/sales" element={
                          <ProtectedRoute allowedRoles={['admin', 'sales']}>
                            <Suspense fallback={<PageLoader />}>
                              <Sales />
                            </Suspense>
                          </ProtectedRoute>
                        } />
                        <Route path="/customers" element={
                          <ProtectedRoute allowedRoles={['admin', 'sales', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Customers />
                            </Suspense>
                          </ProtectedRoute>
                        } />

                        {/* Depts */}
                        <Route path="/design" element={
                          <ProtectedRoute allowedRoles={['admin', 'design', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Design />
                            </Suspense>
                          </ProtectedRoute>
                        } />
                        <Route path="/prepress" element={
                          <ProtectedRoute allowedRoles={['admin', 'prepress', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Prepress />
                            </Suspense>
                          </ProtectedRoute>
                        } />
                        <Route path="/production" element={
                          <ProtectedRoute allowedRoles={['admin', 'production', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Production />
                            </Suspense>
                          </ProtectedRoute>
                        } />
                        <Route path="/outsource" element={
                          <ProtectedRoute allowedRoles={['admin', 'sales', 'prepress', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Outsource />
                            </Suspense>
                          </ProtectedRoute>
                        } />
                        <Route path="/dispatch" element={
                          <ProtectedRoute allowedRoles={['admin', 'dispatch', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Dispatch />
                            </Suspense>
                          </ProtectedRoute>
                        } />
                        <Route path="/dispatched" element={
                          <ProtectedRoute allowedRoles={['admin', 'sales', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Dispatched />
                            </Suspense>
                          </ProtectedRoute>
                        } />

                        {/* Inventory */}
                        <Route path="/inventory" element={
                          <ProtectedRoute allowedRoles={['admin', 'sales', 'production', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <InventoryDashboard />
                            </Suspense>
                          </ProtectedRoute>
                        } />

                        {/* Employee Portal */}
                        <Route path="/hr" element={
                          <Suspense fallback={<PageLoader />}>
                            <EmployeeDashboard />
                          </Suspense>
                        } />

                        {/* Resources/Profile */}
                        <Route path="/how-we-work" element={
                          <Suspense fallback={<PageLoader />}>
                            <HowWeWork />
                          </Suspense>
                        } />
                        <Route path="/profile" element={
                          <Suspense fallback={<PageLoader />}>
                            <Profile />
                          </Suspense>
                        } />

                        {/* Performance & Reports */}
                        <Route path="/performance" element={
                          <Suspense fallback={<PageLoader />}>
                            <PerformanceReports />
                          </Suspense>
                        } />

                        {/* Admin Routes */}
                        <Route path="/admin" element={
                          <Navigate to="/admin/users" replace />
                        } />

                        <Route path="/admin/users" element={
                          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Team />
                            </Suspense>
                          </ProtectedRoute>
                        } />

                        <Route path="/admin/hr" element={
                          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'hr_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <HRDashboard />
                            </Suspense>
                          </ProtectedRoute>
                        } />

                        <Route path="/admin/settings" element={
                          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <AdminSettings />
                            </Suspense>
                          </ProtectedRoute>
                        } />

                        <Route path="/reports" element={
                          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
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

                        <Route path="/settings" element={
                          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                            <Suspense fallback={<PageLoader />}>
                              <Settings />
                            </Suspense>
                          </ProtectedRoute>
                        } />

                      </Route>

                      {/* Fallback */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <Toaster />
                    <Sonner />
                    <AIAssistant />
                    <SpeedInsights />
                  </BrowserRouter>
                </TooltipProvider>
              </WorkflowProvider>
            </AnalyticsProvider>
          </WorkLogProvider>
        </OrderProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;