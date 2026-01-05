import { ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, LogOut } from 'lucide-react';

interface DepartmentGuardProps {
    children: ReactNode;
}

export function DepartmentGuard({ children }: DepartmentGuardProps) {
    const { profile, role, isAdmin, isLoading, signOut } = useAuth();

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">Loading access rights...</div>;
    }

    // Admins always bypass
    if (isAdmin) {
        return <>{children}</>;
    }

    // Sales users typically have a role but might not have a department set in profile initially
    // If they have the role 'sales', we allow them.
    if (role === 'sales') {
        return <>{children}</>;
    }

    const hasDepartment = !!profile?.department;
    const hasRole = !!role;

    if (!hasDepartment && !hasRole) {
        return (
            <div className="flex items-center justify-center h-screen bg-muted/20 p-4">
                <Card className="max-w-md w-full shadow-lg border-destructive/20">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                            <ShieldAlert className="h-6 w-6 text-destructive" />
                        </div>
                        <CardTitle className="text-xl text-destructive">Access Restricted</CardTitle>
                        <CardDescription>
                            Your account has no department or role assigned.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Please contact your system administrator to assign you to a department (Design, Production, etc.).
                        </p>
                        <div className="pt-2">
                            <Button variant="outline" onClick={() => signOut()} className="gap-2">
                                <LogOut className="h-4 w-4" />
                                Sign Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
}
