import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { WorkspaceProvider } from "./lib/workspace";
import App from "./App";
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});
export default function DashboardRoot() {
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
