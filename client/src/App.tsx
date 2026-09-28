import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import FitBuddy from "@/pages/FitBuddy";
import AuthPage from "@/pages/Auth";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/login" component={AuthPage} />
    <Route path="/signup" component={AuthPage} />
    <Route path="/forgot-password" component={AuthPage} />
    <Route path="/reset-password" component={AuthPage} />
    <Route path="/onboarding" component={FitBuddy} />
    <Route path="/dashboard" component={FitBuddy} />
    <Route path="/plan" component={FitBuddy} />
    <Route path="/progress" component={FitBuddy} />
    <Route path="/profile" component={FitBuddy} />
    <Route path="/admin" component={FitBuddy} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <Toaster theme="dark" />
        <Router />
      </TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>;
}
