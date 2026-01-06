import { createRoot } from "react-dom/client";
import { injectSpeedInsights } from "@vercel/speed-insights";
import App from "./App.tsx";
import "./index.css";

// Inject Speed Insights to track performance metrics
injectSpeedInsights();

createRoot(document.getElementById("root")!).render(<App />);
