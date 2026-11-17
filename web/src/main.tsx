import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import Landing from "./components/Landing";
import "./base.css";
const DashboardRoot = lazy(() => import("./DashboardRoot"));
export function Entry() {
  const location = useLocation(),
    navigate = useNavigate();
  return location.pathname === "/welcome" ? (
    <Landing onAdd={() => navigate("/?add=1")} />
  ) : (
    <Suspense
      fallback={
        <div className="boot-loading" role="status">
          Connecting your workspace…
        </div>
      }
    >
      <DashboardRoot />
    </Suspense>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Entry />
    </BrowserRouter>
  </React.StrictMode>,
);
