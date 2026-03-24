'use client'

import React from 'react'
import { Bell, Check, Loader2, Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import {
    useNotifications,
    useUnreadCount,
    useMarkNotificationRead,
    useMarkAllRead
} from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useCurrentProfile } from '@/hooks/use-profiles'

export function NotificationBell() {
    const router = useRouter()
    const { data: profile } = useCurrentProfile()
    const { data: notifications, isLoading } = useNotifications()
    const unreadCount = useUnreadCount()
    const markRead = useMarkNotificationRead()
    const markAllRead = useMarkAllRead()
    const [open, setOpen] = React.useState(false)

    // Only show for ADMIN
    if (!profile || profile.role !== 'ADMIN') return null

    const handleNotificationClick = (notification: any) => {
        if (!notification.read) {
            markRead.mutate(notification.id)
        }
        if (notification.link) {
            setOpen(false)
            router.push(notification.link)
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'WARNING': return <AlertTriangle className="h-4 w-4 text-amber-500" />
            case 'ERROR': return <XCircle className="h-4 w-4 text-red-500" />
            case 'SUCCESS': return <CheckCircle2 className="h-4 w-4 text-green-500" />
            default: return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h4 className="font-semibold">Notificaciones</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="xs"
                            className="text-xs h-7"
                            onClick={() => markAllRead.mutate()}
                            disabled={markAllRead.isPending}
                        >
                            <Check className="mr-1 h-3 w-3" />
                            Marcar leídas
                        </Button>
                    )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                    ) : notifications?.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">
                            No tienes notificaciones
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications?.map((notification) => (
                                <button
                                    key={notification.id}
                                    className={cn(
                                        "w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors",
                                        !notification.read && "bg-blue-50/50"
                                    )}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="mt-1">
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className={cn("text-sm font-medium leading-none", !notification.read && "text-blue-700")}>
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                                        </p>
                                    </div>
                                    {!notification.read && (
                                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
