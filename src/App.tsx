import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Design from "./pages/Design";
import Prepress from "./pages/Prepress";
import Production from "./pages/Production";
import Dispatch from "./pages/Dispatch";
import OrderDetail from "./pages/OrderDetail";
import TrackOrder from "./pages/TrackOrder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public route for order tracking */}
          <Route path="/track" element={<TrackOrder />} />
          
          {/* Internal app routes */}
          <Route path="/" element={<Index />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/design" element={<Design />} />
            <Route path="/prepress" element={<Prepress />} />
            <Route path="/production" element={<Production />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/orders/:orderId" element={<OrderDetail />} />
            <Route path="/team" element={<Dashboard />} />
            <Route path="/reports" element={<Dashboard />} />
            <Route path="/settings" element={<Dashboard />} />
          </Route>
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
