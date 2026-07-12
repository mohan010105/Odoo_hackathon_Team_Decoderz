import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Layout } from '@/components/layout';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

import Dashboard from '@/pages/dashboard';
import Departments from '@/pages/departments';
import Employees from '@/pages/employees';
import Categories from '@/pages/categories';
import Assets from '@/pages/assets';
import Configuration from '@/pages/configuration';

// Auth Pages
import Login from '@/pages/login';
import Signup from '@/pages/signup';
import ForgotPassword from '@/pages/forgot-password';
import ResetPassword from '@/pages/reset-password';
import Profile from '@/pages/profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <h1 className="text-4xl font-bold text-slate-100">404</h1>
      <p className="mt-2 text-slate-400">The page you're looking for doesn't exist.</p>
    </div>
  );
}

function Router() {
  const { user, isLoading, isAdmin, isAssetManager, isDepartmentHead } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-xs text-slate-500 font-medium tracking-wider">Initializing session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  // Guard routing permissions dynamically (RBAC)
  const canAccessDepartments = isAdmin || isDepartmentHead;
  const canAccessEmployees = isAdmin || isDepartmentHead;
  const canAccessCategories = isAdmin || isAssetManager;
  const canAccessConfiguration = isAdmin || isAssetManager;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/profile" component={Profile} />
        
        <Route path="/departments">
          {canAccessDepartments ? <Departments /> : <Redirect to="/" />}
        </Route>
        
        <Route path="/employees">
          {canAccessEmployees ? <Employees /> : <Redirect to="/" />}
        </Route>
        
        <Route path="/categories">
          {canAccessCategories ? <Categories /> : <Redirect to="/" />}
        </Route>
        
        <Route path="/assets" component={Assets} />
        
        <Route path="/configuration">
          {canAccessConfiguration ? <Configuration /> : <Redirect to="/" />}
        </Route>

        {/* Redirect public auth pages back to dashboard */}
        <Route path="/login">
          <Redirect to="/" />
        </Route>
        <Route path="/signup">
          <Redirect to="/" />
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
