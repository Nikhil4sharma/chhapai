
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Send, X, Sparkles, Loader2, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    isCopyable?: boolean;
}

export function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Namaste! I am Chhapai AI (v2.0). I can help all departments (HR, Sales, Admin). Ask me to write emails or find data!"
        }
    ]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        // Simulate AI processing time with "learning" delay
        setTimeout(() => {
            const response = generateSmartResponse(input.toLowerCase(), location.pathname, navigate);
            setMessages(prev => [...prev, { ...response, id: (Date.now() + 1).toString() }]);
            setIsTyping(false);
        }, 1500);
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success("Text copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="fixed bottom-20 right-6 z-[60] flex flex-col items-end gap-4 print:hidden">
            {isOpen && (
                <Card className="w-[380px] h-[600px] shadow-2xl border-primary/20 animate-in slide-in-from-bottom-10 fade-in duration-300 flex flex-col backdrop-blur-sm bg-white/95 dark:bg-slate-950/95">
                    <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-4 rounded-t-lg flex flex-row justify-between items-center space-y-0 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full relative">
                                <Bot className="h-5 w-5" />
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                            </div>
                            <div>
                                <CardTitle className="text-sm font-bold">Chhapai Neural Assistant</CardTitle>
                                <p className="text-[10px] opacity-80">Connected • Self-Learning Active</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full" onClick={() => setIsOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                        <ScrollArea className="h-full p-4">
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={cn("flex gap-3 max-w-[90%] animate-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                                        <Avatar className="h-8 w-8 mt-1 border shadow-sm">
                                            {msg.role === 'assistant' ? (
                                                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white"><Bot className="h-4 w-4" /></AvatarFallback>
                                            ) : (
                                                <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-xs text-foreground">You</AvatarFallback>
                                            )}
                                        </Avatar>
                                        <div className="space-y-2 group w-full">
                                            <div className={cn(
                                                "p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed relative",
                                                msg.role === 'user'
                                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                    : "bg-white dark:bg-slate-800 border rounded-tl-sm"
                                            )}>
                                                {msg.content.split('\n').map((line, i) => <p key={i} className="min-h-[1.2em]">{line}</p>)}

                                                {/* Copy Button for Assistant Messages */}
                                                {msg.role === 'assistant' && (msg.isCopyable || msg.content.length > 50) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 dark:bg-black/20 backdrop-blur-sm"
                                                        onClick={() => copyToClipboard(msg.content, msg.id)}
                                                    >
                                                        {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                    </Button>
                                                )}
                                            </div>
                                            {msg.action && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full bg-white dark:bg-slate-800 hover:bg-primary/5 border-primary/20 text-primary justify-between group shadow-sm transition-all"
                                                    onClick={msg.action.onClick}
                                                >
                                                    {msg.action.label}
                                                    <ChevronRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isTyping && (
                                    <div className="flex gap-3 max-w-[85%]">
                                        <Avatar className="h-8 w-8 mt-1 border shadow-sm">
                                            <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white"><Bot className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                        <div className="bg-white dark:bg-slate-800 border p-4 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center">
                                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="p-3 border-t bg-white dark:bg-slate-950">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex w-full gap-2 relative"
                        >
                            <Input
                                placeholder="Write email to customer..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="pr-10 focus-visible:ring-indigo-500/20 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!input.trim() || isTyping}
                                className="absolute right-1 top-1 h-8 w-8 rounded-md bg-indigo-600 hover:bg-indigo-700"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            <Button
                size="lg"
                className={cn(
                    "h-12 w-12 rounded-full shadow-xl transition-all duration-300 hover:scale-105 bg-indigo-600 hover:bg-indigo-700 text-white",
                    isOpen ? "rotate-90 opacity-0 pointer-events-none translate-y-10" : "rotate-0"
                )}
                onClick={() => setIsOpen(true)}
            >
                <Sparkles className="h-5 w-5" />
                <span className="sr-only">Open AI Assistant</span>
            </Button>
        </div>
    );
}

// ---------------------------------------------------------
// SUPERCHARGED HEURISTIC ENGINE: V2.0 (Multi-Department)
// ---------------------------------------------------------
function generateSmartResponse(query: string, path: string, navigate: any): Omit<Message, 'id'> {
    const q = query.toLowerCase();

    // 1. EMAIL WRITER (Generative Template)
    if (q.includes('mail') || q.includes('email') || q.includes('write')) {
        if (q.includes('customer') || q.includes('client')) {
            return {
                role: 'assistant',
                isCopyable: true,
                content: `Here is a drafted email for your customer:\n\nSubject: Update regarding your order with Chhapai\n\nDear Valuable Customer,\n\nWe hope this email finds you well. We are writing to provide an update regarding your recent order. Our team is working diligently to ensure the highest quality for your deliverables.\n\nEverything is proceeding as scheduled, and we will notify you once the order is ready for dispatch.\n\nThank you for choosing Chhapai.\n\nBest Regards,\nTeam Chhapai`
            };
        }
        if (q.includes('leave') || q.includes('sick')) {
            return {
                role: 'assistant',
                isCopyable: true,
                content: `Subject: Sick Leave Application\n\nDear HR,\n\nI am writing to inform you that I am unwell and unable to report to work today. I request you to kindly grant me sick leave for the day.\n\nI will be available on email for any urgent matters.\n\nRegards,\n[Your Name]`
            };
        }
    }

    // 2. SALES DEPARTMENT SUPPORT
    if (q.includes('sales') || q.includes('revenue') || q.includes('target')) {
        return {
            role: 'assistant',
            content: "Opening Sales Dashboard for you. You can check daily revenue and targets there.",
            action: { label: "Go to Sales Dash", onClick: () => navigate('/sales') }
        };
    }
    if (q.includes('customer') || q.includes('client')) {
        return {
            role: 'assistant',
            content: "You can manage customer interactions in the Order Detail view or Sales CRM.",
            action: { label: "View Orders", onClick: () => navigate('/orders') }
        };
    }

    // 3. HR & Leave Related
    if (q.includes('leave') || q.includes('chutti') || q.includes('holiday')) {
        if (q.includes('apply')) {
            return {
                role: 'assistant',
                content: "Sure, let's get that leave sorted. Go to HR Portal.",
                action: { label: "Apply Leave", onClick: () => navigate('/hr') }
            };
        }
        return {
            role: 'assistant',
            content: "Checking the roster... accessing HR Admin view.",
            action: { label: "View Calendar", onClick: () => navigate('/admin/hr') }
        };
    }

    // 4. Payroll & Salary
    if (q.includes('salary') || q.includes('payroll') || q.includes('slip')) {
        return {
            role: 'assistant',
            content: "I can take you to the Payroll section to download slips.",
            action: { label: "Go to Payroll", onClick: () => navigate('/admin/hr') }
        };
    }

    // 5. General / Context Aware
    if (path.includes('/orders') && (q.includes('status') || q.includes('track'))) {
        return {
            role: 'assistant',
            content: "You are already on the Orders page. Click on any Order ID to see its detailed status timeline."
        };
    }

    // Default Fallback
    return {
        role: 'assistant',
        content: "I am trained on Sales, HR, and Admin tasks. Try asking me to 'Write a customer email' or 'Check Sales targets'."
    };
}
