import { Bell, Check, X, Clock, Package, AlertTriangle, Volume2, VolumeX, Truck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { Link } from 'react-router-dom';
import { useState, useRef } from 'react';

export function NotificationsDropdown() {
  const {
    notifications,
    unreadCount,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  } = useNotifications();

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-priority-red" />;
      case 'delayed':
        return <Clock className="h-4 w-4 text-priority-red" />;
      case 'warning':
        return <Clock className="h-4 w-4 text-priority-yellow" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Package className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-priority-red text-white text-[10px] font-medium rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
        
        <DropdownMenuContent align="end" className="w-80 p-0 bg-popover border border-border">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon-sm"
                    onClick={toggleSound}
                  >
                    {soundEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                </TooltipContent>
              </Tooltip>
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={markAllAsRead}
                    >
                      Mark all read
                    </Button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon-sm"
                        onClick={clearAllNotifications}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear all notifications</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>

          <ScrollArea className="h-[300px]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const NotificationItem = () => {
                    const [swipeOffset, setSwipeOffset] = useState(0);
                    const [isSwiping, setIsSwiping] = useState(false);
                    const touchStartX = useRef<number | null>(null);
                    const SWIPE_THRESHOLD = 100;

                    const handleTouchStart = (e: React.TouchEvent) => {
                      touchStartX.current = e.touches[0].clientX;
                      setIsSwiping(true);
                    };

                    const handleTouchMove = (e: React.TouchEvent) => {
                      if (touchStartX.current === null) return;
                      const currentX = e.touches[0].clientX;
                      const diff = touchStartX.current - currentX;
                      
                      // Only allow swiping left (to reveal delete)
                      if (diff > 0) {
                        setSwipeOffset(Math.min(diff, SWIPE_THRESHOLD));
                      }
                    };

                    const handleTouchEnd = () => {
                      if (swipeOffset >= SWIPE_THRESHOLD) {
                        // Swipe completed - delete notification
                        removeNotification(notification.id);
                        setSwipeOffset(0);
                      } else {
                        // Reset position
                        setSwipeOffset(0);
                      }
                      touchStartX.current = null;
                      setIsSwiping(false);
                    };

                    return (
                      <div
                        className="relative overflow-hidden"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      >
                        {/* Delete indicator */}
                        <div 
                          className={cn(
                            "absolute right-0 top-0 bottom-0 flex items-center justify-center bg-destructive text-destructive-foreground px-4 transition-opacity",
                            swipeOffset > 0 ? "opacity-100" : "opacity-0"
                          )}
                          style={{ width: `${SWIPE_THRESHOLD}px` }}
                        >
                          <Trash2 className="h-5 w-5" />
                        </div>
                        
                        {/* Notification content */}
                        <div
                          className={cn(
                            "p-3 hover:bg-secondary/50 transition-all cursor-pointer group relative bg-background",
                            !notification.read && "bg-primary/5",
                            isSwiping && "transition-none"
                          )}
                          style={{ 
                            transform: `translateX(-${swipeOffset}px)`,
                            transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
                          }}
                          onClick={() => {
                            if (swipeOffset === 0) {
                              markAsRead(notification.id);
                            }
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5">
                              {getIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm text-foreground",
                                !notification.read && "font-medium"
                              )}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(notification.created_at, { addSuffix: true })}
                                </p>
                                {notification.order_id && (
                                  <Link 
                                    to={`/orders/${notification.order_id}`}
                                    className="text-xs text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Order
                                  </Link>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return <NotificationItem key={notification.id} />;
                })}
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
