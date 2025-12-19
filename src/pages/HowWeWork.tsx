import { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle, 
  ArrowRight, 
  Users, 
  FileText, 
  Factory, 
  ShoppingCart,
  Palette,
  FileCheck,
  Truck,
  TrendingUp,
  Clock,
  Shield,
  Bell,
  Zap,
  Target,
  BarChart3,
  Lightbulb,
  PlayCircle,
  ChevronRight,
  Info,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

interface WorkflowStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  benefit: string;
  tip?: string;
}

interface DepartmentGuide {
  department: string;
  icon: React.ReactNode;
  color: string;
  responsibilities: string[];
  bestPractices: string[];
  commonActions: string[];
}

export default function HowWeWork() {
  const { role, isAdmin } = useAuth();
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const workflowSteps: WorkflowStep[] = [
    {
      icon: <ShoppingCart className="h-5 w-5" />,
      title: "Order Creation",
      description: "Create new orders manually or sync from WooCommerce",
      action: "Go to Dashboard → Click 'New Order' or enable WooCommerce Auto-Sync",
      benefit: "Centralized order management, no missed orders, automatic sync",
      tip: "Always verify customer details and delivery dates before creating orders"
    },
    {
      icon: <Palette className="h-5 w-5" />,
      title: "Design Stage",
      description: "Design team creates artwork and design files",
      action: "Upload design files, add notes, assign to team members",
      benefit: "Clear design handoff, file organization, team collaboration",
      tip: "Upload final approved designs only. Use notes for revision requests"
    },
    {
      icon: <FileCheck className="h-5 w-5" />,
      title: "Prepress Stage",
      description: "Prepare files for production, verify specifications",
      action: "Review designs, upload final proofs, define production stages",
      benefit: "Quality control, production readiness, stage planning",
      tip: "Always define production stages before sending to production"
    },
    {
      icon: <Factory className="h-5 w-5" />,
      title: "Production Stage",
      description: "Manufacturing process with multiple substages",
      action: "Complete each substage, update progress, mark as complete",
      benefit: "Real-time tracking, progress visibility, bottleneck identification",
      tip: "Update stage completion immediately to keep everyone informed"
    },
    {
      icon: <Truck className="h-5 w-5" />,
      title: "Dispatch & Delivery",
      description: "Package and ship completed orders",
      action: "Mark as dispatched, update tracking, complete order",
      benefit: "Delivery tracking, order completion, customer satisfaction",
      tip: "Add tracking numbers and dispatch notes for better tracking"
    }
  ];

  const departmentGuides: DepartmentGuide[] = [
    {
      department: "Sales",
      icon: <ShoppingCart className="h-5 w-5" />,
      color: "text-blue-600",
      responsibilities: [
        "Create and manage orders",
        "Update customer information",
        "Set delivery dates and priorities",
        "Assign orders to departments",
        "Monitor order progress"
      ],
      bestPractices: [
        "Always verify customer details before creating orders",
        "Set realistic delivery dates based on order complexity",
        "Use priority levels correctly (Red = Urgent, Yellow = Warning, Blue = Normal)",
        "Assign to correct department based on order requirements"
      ],
      commonActions: [
        "Create new orders",
        "Assign to Design/Prepress",
        "Update delivery dates",
        "Change order priority",
        "View all orders"
      ]
    },
    {
      department: "Design",
      icon: <Palette className="h-5 w-5" />,
      color: "text-purple-600",
      responsibilities: [
        "Create design files",
        "Upload approved designs",
        "Request revisions if needed",
        "Send to Prepress when ready"
      ],
      bestPractices: [
        "Upload only final approved designs",
        "Use notes to communicate revision requests",
        "Mark design complete only when client approved",
        "Upload files in correct format for production"
      ],
      commonActions: [
        "Upload design files",
        "Add design notes",
        "Send to Prepress",
        "Request revisions"
      ]
    },
    {
      department: "Prepress",
      icon: <FileCheck className="h-5 w-5" />,
      color: "text-orange-600",
      responsibilities: [
        "Review design files",
        "Prepare files for production",
        "Upload final proofs",
        "Define production stages",
        "Send to Production"
      ],
      bestPractices: [
        "Always review designs before sending to production",
        "Define production stages BEFORE sending to production (mandatory)",
        "Upload final proofs for record keeping",
        "Verify all specifications are correct"
      ],
      commonActions: [
        "Review files",
        "Upload proofs",
        "Define production stages",
        "Send to Production"
      ]
    },
    {
      department: "Production",
      icon: <Factory className="h-5 w-5" />,
      color: "text-green-600",
      responsibilities: [
        "Complete production substages",
        "Update progress in real-time",
        "Mark stages as complete",
        "Move to next stage",
        "Send to Dispatch when ready"
      ],
      bestPractices: [
        "Update stage completion immediately",
        "Only move forward in workflow (can't go backward)",
        "Add work notes for any issues or delays",
        "Complete all stages in sequence"
      ],
      commonActions: [
        "Complete substage",
        "Move to next stage",
        "Add work notes",
        "Send to Dispatch"
      ]
    }
  ];

  const benefits = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Real-Time Updates",
      description: "Everyone sees order status instantly. No more asking 'where is my order?'"
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Clear Accountability",
      description: "Know exactly who is responsible for each order at every stage"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Better Planning",
      description: "See all orders at a glance, identify bottlenecks, plan resources"
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: "On-Time Delivery",
      description: "Track delivery dates, get alerts for urgent orders, never miss deadlines"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Quality Control",
      description: "File uploads, notes, and approvals at every stage ensure quality"
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: "Smart Notifications",
      description: "Get notified when orders move to your department or need attention"
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Data & Insights",
      description: "Track performance, identify patterns, make data-driven decisions"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Team Collaboration",
      description: "Everyone works together seamlessly, no information silos"
    }
  ];

  const quickStartGuide = [
    {
      step: 1,
      title: "Understand Your Role",
      description: "Know what department you belong to and your responsibilities",
      action: "Check your profile to see your role and department"
    },
    {
      step: 2,
      title: "Navigate to Your Dashboard",
      description: "Each department has a dedicated dashboard",
      action: "Use sidebar to go to your department page (Sales, Design, Prepress, Production)"
    },
    {
      step: 3,
      title: "View Your Orders",
      description: "See all orders assigned to your department",
      action: "Orders are automatically filtered by your department"
    },
    {
      step: 4,
      title: "Take Action",
      description: "Complete your work and move orders forward",
      action: "Click on order cards to view details and take actions"
    },
    {
      step: 5,
      title: "Update Progress",
      description: "Keep everyone informed by updating order status",
      action: "Use 'Complete Stage' or 'Change Stage' buttons to update progress"
    }
  ];

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">How We Work Now</h1>
            <p className="text-muted-foreground">System Rulebook & Onboarding Guide</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          This guide will help you understand our order management system, your role, and how to work efficiently. 
          Follow these guidelines to ensure smooth operations and better collaboration.
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="department">Your Role</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                System Overview
              </CardTitle>
              <CardDescription>
                Understanding our order management system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    What This System Does
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    <li>• Tracks orders from creation to delivery</li>
                    <li>• Manages workflow across all departments</li>
                    <li>• Provides real-time visibility</li>
                    <li>• Automates notifications and alerts</li>
                    <li>• Stores all files and documents</li>
                    <li>• Generates reports and insights</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Key Principles
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    <li>• Update status immediately</li>
                    <li>• Communicate through notes</li>
                    <li>• Follow the workflow sequence</li>
                    <li>• Define stages before production</li>
                    <li>• Keep files organized</li>
                    <li>• Use priority levels correctly</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Important Rules
                </h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Production Stages:</strong> Must be defined before sending to production</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Forward Only:</strong> Production team can only move forward, not backward</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Real-Time:</strong> Always update status immediately after completing work</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Files:</strong> Upload all relevant files at each stage</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <h3 className="font-semibold">Learn Your Role</h3>
                  <p className="text-sm text-muted-foreground">
                    Understand what your department does and your responsibilities
                  </p>
                </div>
                <div className="space-y-2 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <span className="font-bold text-primary">2</span>
                  </div>
                  <h3 className="font-semibold">Explore Dashboard</h3>
                  <p className="text-sm text-muted-foreground">
                    Navigate to your department page and see your orders
                  </p>
                </div>
                <div className="space-y-2 p-4 border rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <span className="font-bold text-primary">3</span>
                  </div>
                  <h3 className="font-semibold">Take Action</h3>
                  <p className="text-sm text-muted-foreground">
                    Start working on orders and update their status
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Order Workflow
              </CardTitle>
              <CardDescription>
                Step-by-step process from order creation to delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowSteps.map((step, index) => (
                  <div key={index} className="relative">
                    <Card className={`transition-all hover:shadow-md ${activeStep === index ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              {step.icon}
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold flex items-center gap-2">
                                  {step.title}
                                  {index === 0 && (
                                    <Badge variant="outline" className="text-xs">Start</Badge>
                                  )}
                                  {index === workflowSteps.length - 1 && (
                                    <Badge variant="outline" className="text-xs">End</Badge>
                                  )}
                                </h3>
                                <p className="text-sm text-muted-foreground">{step.description}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveStep(activeStep === index ? null : index)}
                              >
                                {activeStep === index ? 'Hide' : 'Show'} Details
                              </Button>
                            </div>
                            
                            {activeStep === index && (
                              <div className="space-y-3 pt-2 border-t">
                                <div>
                                  <p className="text-xs font-medium text-foreground mb-1">How to do it:</p>
                                  <p className="text-sm text-muted-foreground">{step.action}</p>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1 flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    Benefit:
                                  </p>
                                  <p className="text-sm text-green-700 dark:text-green-400">{step.benefit}</p>
                                </div>
                                {step.tip && (
                                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                                      <Lightbulb className="h-3 w-3" />
                                      Pro Tip:
                                    </p>
                                    <p className="text-sm text-blue-700 dark:text-blue-400">{step.tip}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    {index < workflowSteps.length - 1 && (
                      <div className="flex justify-center my-2">
                        <ChevronRight className="h-6 w-6 text-muted-foreground rotate-90" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Department Guide Tab */}
        <TabsContent value="department" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Department Guides
              </CardTitle>
              <CardDescription>
                Learn about your department's role and responsibilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {departmentGuides.map((guide, index) => (
                  <AccordionItem key={index} value={`dept-${index}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${guide.color} ${
                          guide.department === 'Sales' ? 'bg-blue-500/10' :
                          guide.department === 'Design' ? 'bg-purple-500/10' :
                          guide.department === 'Prepress' ? 'bg-orange-500/10' :
                          'bg-green-500/10'
                        }`}>
                          {guide.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold">{guide.department} Department</h3>
                          <p className="text-xs text-muted-foreground">Click to see details</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Your Responsibilities
                          </h4>
                          <ul className="space-y-1 ml-6">
                            {guide.responsibilities.map((resp, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                                {resp}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            Best Practices
                          </h4>
                          <ul className="space-y-1 ml-6">
                            {guide.bestPractices.map((practice, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <Info className="h-3 w-3 text-blue-500 mt-1 shrink-0" />
                                {practice}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Common Actions
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {guide.commonActions.map((action, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {action}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Role-specific guidance */}
          {role && (
            <Card>
              <CardHeader>
                <CardTitle>Your Current Role: {role.charAt(0).toUpperCase() + role.slice(1)}</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const userGuide = departmentGuides.find(g => g.department.toLowerCase() === role);
                  if (!userGuide) return <p className="text-muted-foreground">You're an admin. You can access all departments.</p>;
                  
                  return (
                    <div className="space-y-4">
                      <div className="bg-primary/5 rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Quick Actions for You:</h3>
                        <div className="flex flex-wrap gap-2">
                          {userGuide.commonActions.map((action, i) => (
                            <Button key={i} variant="outline" size="sm" asChild>
                              <Link to={`/${role}`}>
                                {action}
                              </Link>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Benefits Tab */}
        <TabsContent value="benefits" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Why Use This System?
              </CardTitle>
              <CardDescription>
                Benefits of following the system workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {benefits.map((benefit, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                        {benefit.icon}
                      </div>
                      <h3 className="font-semibold text-sm">{benefit.title}</h3>
                      <p className="text-xs text-muted-foreground">{benefit.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Culture</CardTitle>
              <CardDescription>
                Building a culture of transparency and efficiency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    What We Do
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    <li>• Update status in real-time</li>
                    <li>• Communicate through system notes</li>
                    <li>• Follow defined workflows</li>
                    <li>• Take ownership of our work</li>
                    <li>• Help each other succeed</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    What We Avoid
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    <li>• Delayed status updates</li>
                    <li>• Working outside the system</li>
                    <li>• Skipping workflow steps</li>
                    <li>• Missing file uploads</li>
                    <li>• Ignoring notifications</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Start Tab */}
        <TabsContent value="quickstart" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Start Guide
              </CardTitle>
              <CardDescription>
                Get started in 5 simple steps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quickStartGuide.map((guide, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {guide.step}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold">{guide.title}</h3>
                      <p className="text-sm text-muted-foreground">{guide.description}</p>
                      <div className="bg-secondary/50 rounded-lg p-2 mt-2">
                        <p className="text-xs font-medium text-foreground flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" />
                          {guide.action}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interactive Tooltips</CardTitle>
              <CardDescription>
                Look for these icons throughout the system for helpful tips
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 border rounded-lg cursor-help hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Info Tooltip</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Hover over info icons to see helpful tips
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This is an example tooltip. Look for these throughout the system!</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Success Indicator</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Green checkmarks show completed actions
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">Warning/Alert</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Yellow icons indicate warnings or important notes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Tooltips Everywhere</p>
                    <p className="text-sm text-muted-foreground">
                      Hover over buttons, icons, and labels to see helpful tooltips
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Ask Your Team</p>
                    <p className="text-sm text-muted-foreground">
                      Your department lead or admin can help with specific questions
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Refer to This Guide</p>
                    <p className="text-sm text-muted-foreground">
                      Bookmark this page and refer back when needed
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

