import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { FileIcon, CheckCheck, Check, MoreVertical, Trash2, Edit2, X, Check as CheckIcon } from 'lucide-react';
import { OrderMessage } from '../types/chat';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatBubbleProps {
    message: OrderMessage;
    isMe: boolean;
    senderName: string;
    onEdit?: (messageId: string, newContent: string) => void;
    onDelete?: (messageId: string) => void;
}

export function ChatBubble({ message, isMe, senderName, onEdit, onDelete }: ChatBubbleProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    if (message.is_deleted) {
        return (
            <div className={cn("flex w-full mt-2 space-x-3 max-w-xs md:max-w-md", isMe ? "ml-auto justify-end" : "")}>
                <div className="relative flex flex-col items-start">
                    <div className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 italic text-sm">
                        This message was deleted
                    </div>
                </div>
            </div>
        );
    }

    const handleSaveEdit = () => {
        if (editContent.trim() !== message.content) {
            onEdit?.(message.id, editContent);
        }
        setIsEditing(false);
    };

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger>
                    <div className={cn(
                        "flex w-full mt-2 space-x-3 max-w-xs md:max-w-md group",
                        isMe ? "ml-auto justify-end" : ""
                    )}>
                        <div className={cn(
                            "relative flex flex-col items-start",
                            isMe ? "items-end" : "items-start"
                        )}>
                            {!isMe && (
                                <span className="text-[10px] text-muted-foreground ml-1 mb-1">{senderName}</span>
                            )}

                            <div className={cn(
                                "px-4 py-2 rounded-2xl shadow-sm relative text-sm group-hover:shadow-md transition-shadow",
                                isMe
                                    ? "bg-blue-600 text-white rounded-br-none"
                                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-none text-slate-800 dark:text-slate-100"
                            )}>
                                {message.order && message.order.order_id && (
                                    <div className="mb-1">
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block",
                                            isMe ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                                        )}>
                                            #{message.order.order_id}
                                        </span>
                                    </div>
                                )}

                                {isEditing ? (
                                    <div className="flex flex-col gap-2 min-w-[200px]">
                                        <Input
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="h-8 text-xs bg-white/10 border-white/20 text-inherit placeholder:text-white/50"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                                if (e.key === 'Escape') setIsEditing(false);
                                            }}
                                        />
                                        <div className="flex gap-1 justify-end">
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/20" onClick={() => setIsEditing(false)}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/20" onClick={handleSaveEdit}>
                                                <CheckIcon className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <span>
                                        {message.content}
                                        {message.is_edited && (
                                            <span className="text-[10px] opacity-60 italic ml-1">(edited)</span>
                                        )}
                                    </span>
                                )}

                                {message.attachments?.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {message.attachments.map((att, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-black/10 p-1.5 rounded text-xs overflow-hidden">
                                                <FileIcon className="h-3 w-3 flex-shrink-0" />
                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline truncate max-w-[150px]">
                                                    {att.name}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 opacity-70">
                                {format(new Date(message.created_at), 'h:mm a')}
                                {isMe && (
                                    message.is_read
                                        ? <CheckCheck className="h-3 w-3 text-blue-500" />
                                        : <Check className="h-3 w-3" />
                                )}
                            </span>
                        </div>
                    </div>
                </ContextMenuTrigger>

                {isMe && !message.is_deleted && (
                    <ContextMenuContent>
                        <ContextMenuItem onSelect={() => setIsEditing(true)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit Message
                        </ContextMenuItem>
                        <ContextMenuItem className="text-red-600 focus:text-red-600" onSelect={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Message
                        </ContextMenuItem>
                    </ContextMenuContent>
                )}
            </ContextMenu>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Message</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure you want to delete everyone's view of this message?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => { onDelete?.(message.id); setIsDeleteDialogOpen(false); }}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
