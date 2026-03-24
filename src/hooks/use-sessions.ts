'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'
import { toast } from 'sonner'
import { UserSession, Profile, Shift, RunnerInventoryAssignment } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// ==================== SESSIONS ====================

export function useActiveSessions() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['active-sessions'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase
                .from('user_sessions')
                .select(`
                    *,
                    user:profiles!user_id(id, full_name, role)
                `)
                .eq('organization_id', organization_id)
                .is('ended_at', null)
                .order('started_at', { ascending: false })

            if (error) throw error
            return data as (UserSession & { user: Profile })[]
        },
        refetchInterval: 10000 // Refresh every 10 seconds
    })
}

export function useSessionHistory(days: number = 7) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['session-history', days],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - days)

            const { data, error } = await supabase
                .from('user_sessions')
                .select(`
                    *,
                    user:profiles!user_id(id, full_name, role)
                `)
                .eq('organization_id', organization_id)
                .gte('started_at', startDate.toISOString())
                .order('started_at', { ascending: false })

            if (error) throw error
            return data as (UserSession & { user: Profile })[]
        }
    })
}

export function useCloseSession() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (sessionId: string) => {
            // Simply update the session to set ended_at
            const { error } = await supabase
                .from('user_sessions')
                .update({ ended_at: new Date().toISOString() })
                .eq('id', sessionId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-sessions'] })
            toast.success('Sesión cerrada exitosamente')
        },
        onError: (err: any) => {
            toast.error('Error al cerrar sesión', { description: err.message })
        }
    })
}

export function useStartSession() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (deviceInfo?: string) => {
            const { organization_id, user } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase
                .from('user_sessions')
                .insert({
                    user_id: user.id,
                    organization_id,
                    device_info: deviceInfo || navigator.userAgent
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-sessions'] })
        }
    })
}

// ==================== SHIFTS ====================

export function useShifts() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['shifts'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase
                .from('shifts')
                .select('*')
                .eq('organization_id', organization_id)
                .eq('active', true)
                .order('start_time')

            if (error) throw error
            return data as Shift[]
        }
    })
}

export function useCurrentShift() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['current-shift'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.rpc('get_current_shift', {
                p_organization_id: organization_id
            })

            if (error) throw error

            if (data) {
                const { data: shift } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('id', data)
                    .single()
                return shift as Shift | null
            }
            return null
        },
        refetchInterval: 60000 // Check every minute
    })
}

export function useUpdateShift() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (shift: Partial<Shift> & { id: string }) => {
            const { data, error } = await supabase
                .from('shifts')
                .update(shift)
                .eq('id', shift.id)
                .select()
                .maybeSingle()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] })
            toast.success('Turno actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al actualizar turno', { description: err.message })
        }
    })
}


export type ShiftSalesData = {
    sale_date: string
    shift_id: string | null
    shift_name: string | null
    total_sales: number
    total_expenses: number
    transaction_count: number
    users?: string[]
    payment_breakdown?: { method: string; amount: number }[]
}

export function useShiftSales(startDate: Date, endDate: Date) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['shift-sales', startDate.toISOString(), endDate.toISOString()],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.rpc('get_shift_sales', {
                p_organization_id: organization_id,
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0]
            })

            if (error) throw error
            return data as ShiftSalesData[]
        },
        refetchInterval: 30000
    })
}

// ==================== RUNNERS & PROFILES ====================

export function useProfiles() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['profiles'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', organization_id)
                .eq('active', true)
                .order('full_name')

            if (error) throw error
            return data as Profile[]
        }
    })
}

export function useRunners() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['runners'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', organization_id)
                .eq('role', 'RUNNER')
                .eq('active', true)
                .order('full_name')

            if (error) throw error
            return data as Profile[]
        }
    })
}

export function useCreateProfile() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (profile: {
            full_name: string
            role: 'admin' | 'cashier' | 'runner'
        }) => {
            const { organization_id } = await getOrCreateProfile(supabase)

            // Generate a random UUID for the profile ID
            const newId = crypto.randomUUID()

            const { data, error } = await supabase
                .from('profiles')
                .insert({
                    id: newId,
                    organization_id,
                    full_name: profile.full_name,
                    role: profile.role,
                    active: true
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] })
            queryClient.invalidateQueries({ queryKey: ['runners'] })
            toast.success('Usuario creado exitosamente')
        },
        onError: (err: any) => {
            toast.error('Error al crear usuario', { description: err.message })
        }
    })
}

export function useUpdateProfile() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (profile: Partial<Profile> & { id: string }) => {
            const { data, error } = await supabase
                .from('profiles')
                .update(profile)
                .eq('id', profile.id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] })
            queryClient.invalidateQueries({ queryKey: ['runners'] })
            toast.success('Usuario actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al actualizar usuario', { description: err.message })
        }
    })
}

// ==================== RUNNER INVENTORY ====================

export function useRunnerInventory(runnerId?: string) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['runner-inventory', runnerId],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const today = new Date().toISOString().split('T')[0]

            let query = supabase
                .from('runner_inventory_assignments')
                .select(`
                    *,
                    runner:profiles!runner_id(id, full_name, role),
                    product:products!product_id(id, name, price, category)
                `)
                .eq('organization_id', organization_id)
                .eq('assignment_date', today)
                .order('assigned_at', { ascending: false })

            if (runnerId) {
                query = query.eq('runner_id', runnerId)
            }

            const { data, error } = await query

            if (error) throw error
            return data as RunnerInventoryAssignment[]
        },
        enabled: true
    })
}

export function useAssignInventory() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (assignments: {
            runner_id: string
            items: { product_id: string; qty: number }[]
            shift_id?: string
            notes?: string
        }) => {
            const { organization_id, user } = await getOrCreateProfile(supabase)

            // Call the atomic RPC function
            const { data, error } = await supabase.rpc('assign_runner_inventory', {
                p_organization_id: organization_id,
                p_runner_id: assignments.runner_id,
                p_assigned_by: user.id,
                p_items: assignments.items,
                p_shift_id: assignments.shift_id || null,
                p_notes: assignments.notes || null
            })

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['runner-inventory'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
            toast.success('Inventario asignado y stock actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al asignar inventario', { description: err.message })
        }
    })
}

export function useReturnInventory() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: {
            assignment_id: string
            returned_qty: number
        }) => {
            // Call the atomic RPC function
            const { data, error } = await supabase.rpc('return_runner_inventory', {
                p_assignment_id: params.assignment_id,
                p_returned_qty: params.returned_qty
            })

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['runner-inventory'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
            toast.success('Devolución registrada y stock actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al registrar devolución', { description: err.message })
        }
    })
}

export function useRunnerSummary() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['runner-summary'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const today = new Date().toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('runner_inventory_assignments')
                .select(`
                    runner_id,
                    runner:profiles!runner_id(full_name),
                    assigned_qty,
                    returned_qty,
                    sold_qty,
                    status,
                    product:products!product_id(price)
                `)
                .eq('organization_id', organization_id)
                .eq('assignment_date', today)

            if (error) throw error

            // Group by runner
            const summary = data.reduce((acc: any, item: any) => {
                const runnerId = item.runner_id
                if (!acc[runnerId]) {
                    acc[runnerId] = {
                        runner_id: runnerId,
                        runner_name: item.runner?.full_name || 'Sin nombre',
                        total_assigned: 0,
                        total_returned: 0,
                        total_sold: 0,
                        total_value: 0,
                        active_assignments: 0
                    }
                }
                acc[runnerId].total_assigned += item.assigned_qty
                acc[runnerId].total_returned += item.returned_qty
                acc[runnerId].total_sold += item.sold_qty
                acc[runnerId].total_value += item.sold_qty * (item.product?.price || 0)
                if (item.status === 'active') acc[runnerId].active_assignments++
                return acc
            }, {})

            return Object.values(summary)
        },
        refetchInterval: 30000
    })
}

export function useSessionMonitor() {
    const [supabase] = useState(() => createClient())
    const router = useRouter()

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null
        let currentUserId: string | null = null

        const checkSession = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // Check if user has an active session (ended_at is null)
                const { data: activeSession, error } = await supabase
                    .from('user_sessions')
                    .select('id')
                    .eq('user_id', user.id)
                    .is('ended_at', null)
                    .order('started_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (error) {
                    console.error('❌ Error checking session:', error)
                    return
                }

                // If no active session found, force logout
                if (!activeSession) {
                    console.log('⛔ No hay sesión activa. Cerrando sesión local...')
                    toast.error('Tu sesión ha sido cerrada por un administrador')

                    // Clear interval before logout
                    if (intervalId) clearInterval(intervalId)

                    await supabase.auth.signOut()
                    router.push('/login')
                    router.refresh()
                }
            } catch (err) {
                console.error('❌ Error in session check:', err)
            }
        }

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // Tab became visible, check immediately
                console.log('👁️ Pestaña visible, verificando sesión...')
                checkSession()
            }
        }

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            currentUserId = user.id
            console.log('🔍 Monitor de sesión iniciado (polling cada 30s)')

            // Check immediately
            await checkSession()

            // Check every 30 seconds (only when tab is active)
            intervalId = setInterval(() => {
                if (!document.hidden) {
                    checkSession()
                }
            }, 30000)

            // Listen for tab visibility changes
            document.addEventListener('visibilitychange', handleVisibilityChange)
        }

        setup()

        return () => {
            if (intervalId) {
                console.log('🔌 Deteniendo monitor de sesión')
                clearInterval(intervalId)
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])
}

// Separate hook for safe payment breakdown
export function useShiftPaymentMethods(startDate: Date, endDate: Date) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['shift-payment-methods', startDate, endDate],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const { data, error } = await supabase.rpc('get_shift_payment_methods', {
                p_organization_id: organization_id,
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0]
            })
            if (error) throw error
            return data
        },
        enabled: !!startDate && !!endDate,
        refetchInterval: 30000
    })
}

// Separate hook for safe runner payment breakdown
export function useRunnerPaymentMethods(startDate: Date, endDate: Date) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['runner-payment-methods', startDate, endDate],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const { data, error } = await supabase.rpc('get_runner_payment_methods', {
                p_organization_id: organization_id,
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0]
            })
            if (error) throw error
            return data
        },
        enabled: !!startDate && !!endDate
    })
}
