'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    UtensilsCrossed,
    DollarSign,
    BarChart3,
    Settings,
    Menu,
    X,
    LogOut,
    FileSpreadsheet,
    Calendar as CalendarIcon,
    Shield,
    CreditCard,
    Truck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCurrentProfile } from '@/hooks/use-profiles'
import { useSessionMonitor } from '@/hooks/use-sessions'
import { NotificationBell } from '@/components/common/notification-bell'

const sidebarItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
    { name: 'POS', href: '/pos', icon: ShoppingCart, roles: ['ADMIN', 'SELLER', 'RUNNER'] },
    { name: 'Calendario', href: '/reports/calendar', icon: CalendarIcon, roles: ['ADMIN'] },
    { name: 'Productos', href: '/products', icon: Package, roles: ['ADMIN', 'SELLER'] },
    { name: 'Inventario', href: '/inventory', icon: UtensilsCrossed, roles: ['ADMIN', 'SELLER'] },
    { name: 'Gastos', href: '/expenses', icon: DollarSign, roles: ['ADMIN', 'SELLER'] },
    { name: 'Corredores', href: '/corredores', icon: Truck, roles: ['ADMIN', 'SELLER'] },
    { name: 'Cartera', href: '/admin/finance/receivables', icon: CreditCard, roles: ['ADMIN'] },
    { name: 'Reportes', href: '/reports', icon: BarChart3, roles: ['ADMIN'] },
    { name: 'Admin', href: '/admin', icon: Shield, roles: ['ADMIN'] },
    { name: 'Configuración', href: '/settings', icon: Settings, roles: ['ADMIN'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    const { data: currentProfile } = useCurrentProfile()
    useSessionMonitor()

    // Role-based route guard: redirect to /pos if user navigates to a page they don't have access to
    useEffect(() => {
        if (!currentProfile) return
        const role = currentProfile.role
        const allowedItems = sidebarItems.filter(i => i.roles.includes(role))
        const isAllowed = allowedItems.some(i =>
            pathname === i.href || pathname.startsWith(i.href + '/')
        )
        if (!isAllowed) {
            router.push('/pos')
        }
    }, [currentProfile, pathname, router])

    // Check if we're on POS page
    const isPOSPage = pathname === '/pos'

    // Listen for hash changes to toggle sidebar on POS page
    React.useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash === '#menu') {
                setIsSidebarOpen(true)
            } else {
                setIsSidebarOpen(false)
            }
        }

        handleHashChange() // Check on mount
        window.addEventListener('hashchange', handleHashChange)
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [])

    const handleLogout = async () => {
        // Close user session in database
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            await supabase
                .from('user_sessions')
                .update({ ended_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .is('ended_at', null)
        }

        const { error } = await supabase.auth.signOut()
        if (error) {
            toast.error('Error cerrando sesión')
            return
        }
        router.push('/login')
        router.refresh()
    }

    const closeSidebar = () => {
        setIsSidebarOpen(false)
        if (window.location.hash === '#menu') {
            window.history.replaceState(null, '', window.location.pathname)
        }
    }

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar - Always render on POS in overlay mode, normal on other pages */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-white transition-transform duration-200 ease-in-out
                ${isPOSPage
                    ? (isSidebarOpen ? 'translate-x-0' : '-translate-x-full')
                    : 'md:translate-x-0 md:static md:flex-shrink-0 ' + (isSidebarOpen ? 'translate-x-0' : '-translate-x-full')
                }
            `}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800">
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
                            Street Food POS
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`text-slate-400 ${isPOSPage ? '' : 'md:hidden'}`}
                            onClick={closeSidebar}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-4">
                        <ul className="space-y-1 px-2">
                            {sidebarItems
                                .filter(item => {
                                    if (!currentProfile) return true // Loading state: show all
                                    return item.roles.includes(currentProfile.role)
                                })
                                .map((item) => {
                                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                                    return (
                                        <li key={item.name}>
                                            <Link
                                                href={item.href}
                                                onClick={closeSidebar}
                                                className={`
                                                flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                                                ${isActive
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                                            `}
                                            >
                                                <item.icon className="h-5 w-5" />
                                                {item.name}
                                            </Link>
                                        </li>
                                    )
                                })}
                        </ul>
                    </nav>

                    {/* Footer / User */}
                    <div className="p-4 border-t border-slate-800">
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-slate-900"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-5 w-5" />
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Mobile Header - Show on non-POS pages */}
                {/* Header - Show on non-POS pages */}
                {!isPOSPage && (
                    <header className="flex items-center justify-between h-16 px-4 bg-white dark:bg-slate-950 border-b">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <Menu className="h-6 w-6" />
                            </Button>
                            <span className="font-semibold md:hidden">Menú</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <NotificationBell />
                        </div>
                    </header>
                )}

                {/* POS gets full screen, other pages get padding */}
                <div className={isPOSPage ? "flex-1 overflow-hidden" : "flex-1 overflow-auto p-4 md:p-8"}>
                    {children}
                </div>
            </main>
        </div>
    )
}


