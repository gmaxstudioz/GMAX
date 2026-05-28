"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "@/lib/actions/notification";

type Notification = {
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    bookingId: string | null;
    type: string;
    booking?: {
        studio: {
            slug: string;
        }
    } | null;
};

export function NotificationArea() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const loadNotifications = async () => {
        setIsLoading(true);
        const { data } = await getUserNotifications();
        if (data) {
            setNotifications(data as Notification[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen]);

    // Initial load
    useEffect(() => {
        loadNotifications();
    }, []);

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            await markNotificationAsRead(notification.id);
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
        }
        setIsOpen(false);
        // We assume the user is in a studio context or will use the bookings overall view if we have one.
        if (notification.bookingId && notification.booking?.studio?.slug) {
            router.push(`/studios/${notification.booking.studio.slug}/bookings/detail/${notification.bookingId}`);
        } else if (notification.bookingId) {
            router.push(`/bookings`);
        }
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1.5">
                    <DropdownMenuLabel className="p-0 text-base">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground" onClick={handleMarkAllRead}>
                            <Check className="mr-1 h-3 w-3" /> Mark all read
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator />
                
                {isLoading && notifications.length === 0 ? (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No notifications yet.
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {notifications.map((notification) => (
                            <DropdownMenuItem 
                                key={notification.id} 
                                className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${!notification.isRead ? "bg-muted/50 font-medium" : ""}`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex items-start justify-between w-full">
                                    <span className="text-sm">{notification.title}</span>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {notification.message}
                                </p>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
