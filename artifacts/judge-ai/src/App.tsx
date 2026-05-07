import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Upload from "@/pages/upload";
import VerifyQueue from "@/pages/verify-queue";
import VerifyDetail from "@/pages/verify-detail";
import Dashboard from "@/pages/dashboard";
import { useLocation } from "wouter";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading, token } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    }
    if (!isLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      setLocation("/dashboard");
    }
  }, [isLoading, token, user, allowedRoles]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }
  if (!token) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/upload">
        <ProtectedRoute allowedRoles={["UPLOADER"]}>
          <Upload />
        </ProtectedRoute>
      </Route>
      <Route path="/verify/:id">
        {(params) => (
          <ProtectedRoute allowedRoles={["REVIEWER"]}>
            <VerifyDetail id={parseInt(params.id, 10)} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/verify">
        <ProtectedRoute allowedRoles={["REVIEWER"]}>
          <VerifyQueue />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
