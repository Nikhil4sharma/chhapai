import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader2, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  const { signIn, user, role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // CRITICAL: Wait for auth to fully load and user data to be fetched
    if (!authLoading && user && role) {
      console.log('[Auth] User authenticated, redirecting...', { user: user.email, role });
      const redirectPath = getRedirectPath(role);
      // Clear loading state before redirect
      setIsLoading(false);
      // Immediate redirect without delay for better UX
      navigate(redirectPath, { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const getRedirectPath = (userRole: string) => {
    switch (userRole) {
      case 'admin':
        return '/dashboard';
      case 'sales':
        return '/sales';
      case 'design':
        return '/'; // Dashboard is default for Design
      case 'prepress':
        return '/prepress';
      case 'production':
        return '/production';
      default:
        return '/dashboard';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        let errorMessage = error.message || "Invalid email or password";

        // Better error messages for common issues
        if (error.message?.includes('Email not confirmed') || error.message?.includes('email_not_confirmed')) {
          errorMessage = "Email not confirmed. Please contact admin to confirm your email, or run CONFIRM_EXISTING_USERS_EMAIL.sql in Supabase SQL Editor.";
        } else if (error.message?.includes('Invalid email or password') || error.message?.includes('Invalid login credentials')) {
          errorMessage = "Invalid email or password. Please check your credentials.";
        } else if (error.message?.includes('400') || error.status === 400) {
          errorMessage = "Login failed. Please check your email and password, or contact admin if email is not confirmed.";
        }

        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
        // Success - redirect will happen via useEffect when user/role is available
        console.log('[Auth] Sign in successful, waiting for user data...');
        // Set a timeout to clear loading if redirect doesn't happen within 5 seconds
        setTimeout(() => {
          if (isLoading) {
            console.warn('[Auth] Redirect timeout - clearing loading state');
            setIsLoading(false);
          }
        }, 5000);
      }
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error);
      let errorMessage = "An unexpected error occurred";

      if (error.message?.includes('Invalid') || error.message?.includes('credentials')) {
        errorMessage = "Invalid email or password. Please check your credentials.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 flex items-center justify-center">
            <img
              src="/chhapai-logo.png"
              alt="Chhapai Logo"
              className="h-full w-full object-contain logo-dark-mode animate-pulse"
            />
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4 relative">
      {/* Theme Toggle - Top Right */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>

      {/* Desktop Layout */}
      {!isMobile ? (
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:flex flex-col items-start justify-center space-y-6 px-8">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 flex items-center justify-center">
                <img
                  src="/chhapai-logo.png"
                  alt="Chhapai Logo"
                  className="h-full w-full object-contain logo-dark-mode"
                />
              </div>
              <div>
                <h1 className="text-5xl font-display font-bold text-foreground mb-1">Chhapai</h1>
                <p className="text-xl text-muted-foreground">Ideas Realised</p>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold text-foreground">Order Flow & Tracking System</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Streamline your order management workflow with real-time tracking,
                department coordination, and comprehensive analytics.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-4">
              <div className="px-4 py-2 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-foreground">Real-time Updates</p>
              </div>
              <div className="px-4 py-2 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-foreground">Multi-Department</p>
              </div>
              <div className="px-4 py-2 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-foreground">Analytics Dashboard</p>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <Card className="shadow-xl border-border/50">
              <CardHeader className="space-y-1 text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  <div className="h-12 w-12 flex items-center justify-center lg:hidden">
                    <img
                      src="/chhapai-logo.png"
                      alt="Chhapai Logo"
                      className="h-full w-full object-contain logo-dark-mode"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-display">Welcome back</CardTitle>
                    <CardDescription>
                      Sign in to continue
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      autoComplete="email"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        autoComplete="current-password"
                        className="h-11 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign in
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Contact your administrator if you need access
            </p>
          </div>
        </div>
      ) : (
        /* Mobile Layout */
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-16 w-16 flex items-center justify-center">
                <img
                  src="/chhapai-logo.png"
                  alt="Chhapai Logo"
                  className="h-full w-full object-contain logo-dark-mode"
                />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground">Chhapai</h1>
                <p className="text-sm text-muted-foreground">Ideas Realised</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">Order Flow & Tracking System</p>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl font-display text-center">Welcome back</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-mobile">Email</Label>
                  <Input
                    id="email-mobile"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password-mobile">Password</Label>
                  <div className="relative">
                    <Input
                      id="password-mobile"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Contact your administrator if you need access
          </p>
        </div>
      )}
    </div>
  );
}
