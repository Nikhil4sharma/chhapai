import { useState } from 'react';
import { Users, Palette, FileCheck, Factory, ShoppingCart } from 'lucide-react';
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

interface AssignDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (department: string) => void;
  currentDepartment?: string;
}

const departments = [
  { id: 'sales', label: 'Sales', icon: ShoppingCart, description: 'Order entry and customer communication' },
  { id: 'design', label: 'Design', icon: Palette, description: 'Creative design work' },
  { id: 'prepress', label: 'Prepress', icon: FileCheck, description: 'Prepare files for production' },
  { id: 'production', label: 'Production', icon: Factory, description: 'Manufacturing process' },
];

export function AssignDepartmentDialog({ 
  open, 
  onOpenChange, 
  onAssign,
  currentDepartment 
}: AssignDepartmentDialogProps) {
  const [selected, setSelected] = useState(currentDepartment || 'sales');

  const handleAssign = () => {
    onAssign(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Department</DialogTitle>
          <DialogDescription>
            Choose which department should handle this item
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-3">
            {departments.map((dept) => (
              <Tooltip key={dept.id}>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <RadioGroupItem
                      value={dept.id}
                      id={dept.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={dept.id}
                      className="flex items-center gap-3 p-4 rounded-lg border border-border cursor-pointer transition-all hover:bg-secondary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    >
                      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                        <dept.icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{dept.label}</p>
                        <p className="text-sm text-muted-foreground">{dept.description}</p>
                      </div>
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Assign item to {dept.label} team
                </TooltipContent>
              </Tooltip>
            ))}
          </RadioGroup>
        </TooltipProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
