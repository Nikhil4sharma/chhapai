import { useState, useMemo } from 'react';
import { Users, Palette, FileCheck, Factory, ShoppingCart, Lock, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AssignDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (department: string) => void;
  currentDepartment?: string;
}

const allDepartments = [
  { id: 'sales', label: 'Sales', icon: ShoppingCart, description: 'Order entry and customer communication' },
  { id: 'design', label: 'Design', icon: Palette, description: 'Creative design work' },
  { id: 'prepress', label: 'Prepress', icon: FileCheck, description: 'Prepare files for production' },
  { id: 'production', label: 'Production', icon: Factory, description: 'Manufacturing process' },
  { id: 'outsource', label: 'Outsource', icon: Building2, description: 'External vendor work' },
];

// Define allowed transitions per role
const getAllowedDepartments = (userRole: string | null, isAdmin: boolean, currentDepartment?: string) => {
  if (isAdmin) {
    // Admin can assign to any department
    return allDepartments.map(d => d.id);
  }

  // Department-specific workflow rules
  switch (userRole) {
    case 'sales':
      // Sales can assign to Design, Prepress, or Outsource
      return ['design', 'prepress', 'outsource'];
    case 'design':
      // Design can forward to Prepress or Production
      return ['prepress', 'production'];
    case 'prepress':
      // Prepress can send forward to Production or Outsource, or send back to Design for revisions
      return ['production', 'design', 'outsource'];
    case 'production':
      // Production cannot reassign departments (only status changes)
      return [];
    default:
      return [];
  }
};

export function AssignDepartmentDialog({ 
  open, 
  onOpenChange, 
  onAssign,
  currentDepartment 
}: AssignDepartmentDialogProps) {
  const { role, isAdmin } = useAuth();
  const [selected, setSelected] = useState(currentDepartment || 'sales');

  const allowedDepartments = useMemo(() => 
    getAllowedDepartments(role, isAdmin, currentDepartment),
    [role, isAdmin, currentDepartment]
  );

  const handleAssign = () => {
    if (!allowedDepartments.includes(selected)) {
      toast({
        title: "Permission Denied",
        description: "You cannot assign to this department based on workflow rules",
        variant: "destructive",
      });
      return;
    }
    onAssign(selected);
    onOpenChange(false);
  };

  // Check if user has any assignment permissions
  const canAssign = allowedDepartments.length > 0 || isAdmin;

  if (!canAssign) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Department</DialogTitle>
            <DialogDescription>
              You don't have permission to reassign items from your department.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Lock className="h-12 w-12" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Department</DialogTitle>
          <DialogDescription>
            {isAdmin 
              ? "Choose which department should handle this item. This will also update the stage automatically."
              : `You can assign to: ${allowedDepartments.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}. Stage will be updated automatically.`
            }
            {selected === 'production' && (
              <span className="block mt-2 text-xs text-primary font-medium">
                Note: You'll need to define production stages after assigning.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-3">
            {allDepartments.map((dept) => {
              const isAllowed = allowedDepartments.includes(dept.id);
              const isCurrent = dept.id === currentDepartment;
              
              return (
                <Tooltip key={dept.id}>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <RadioGroupItem
                        value={dept.id}
                        id={dept.id}
                        className="peer sr-only"
                        disabled={!isAllowed && !isCurrent}
                      />
                      <Label
                        htmlFor={dept.id}
                        className={`flex items-center gap-3 p-4 rounded-lg border border-border cursor-pointer transition-all 
                          ${isAllowed || isCurrent 
                            ? 'hover:bg-secondary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5' 
                            : 'opacity-50 cursor-not-allowed'
                          }`}
                      >
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isAllowed || isCurrent ? 'bg-secondary' : 'bg-muted'
                        }`}>
                          {isAllowed || isCurrent ? (
                            <dept.icon className="h-5 w-5 text-foreground" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            {dept.label}
                            {isCurrent && (
                              <span className="text-xs text-muted-foreground">(Current)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{dept.description}</p>
                        </div>
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isAllowed 
                      ? `Assign item to ${dept.label} team`
                      : isCurrent 
                        ? 'This is the current department'
                        : 'You cannot assign to this department'
                    }
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </RadioGroup>
        </TooltipProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!allowedDepartments.includes(selected)}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
