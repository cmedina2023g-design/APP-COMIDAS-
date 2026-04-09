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
        refetchInterval: 30000 // Refresh every 30 seconds
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
            role: 'ADMIN' | 'SELLER' | 'RUNNER'
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
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

            let query = supabase
                .from('runner_inventory_assignments')
                .select(`
                    *,
                    runner:profiles!runner_id(id, full_name, role),
                    product:products!product_id(id, name, price, category),
                    assigner:profiles!assigned_by(full_name),
                    shift:shifts!shift_id(id, name)
                `)
                .eq('organization_id', organization_id)
                .or(`assignment_date.eq.${today},and(status.eq.active,assignment_date.lt.${today})`)
                .order('assignment_date', { ascending: true })
                .order('assigned_at', { ascending: true })

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

export function useBulkReturnInventory() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (returns: { assignment_id: string; returned_qty: number }[]) => {
            const { data, error } = await supabase.rpc('bulk_return_runner_inventory', {
                p_returns: returns
            })
            if (error) throw error
            return data as { success: boolean; items: any[] }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['runner-inventory'] })
            queryClient.invalidateQueries({ queryKey: ['runner-summary'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
        },
        onError: (err: any) => {
            toast.error('Error al registrar devoluciones', { description: err.message })
        }
    })
}

export function useAdminEditClosedReturns() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (updates: { assignment_id: string; new_returned_qty: number }[]) => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const { data, error } = await supabase.rpc('admin_edit_closed_runner_inventory', {
                p_organization_id: organization_id,
                p_admin_qty_updates: updates
            })
            if (error) throw error
            return data as { success: boolean }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['runner-inventory'] })
            queryClient.invalidateQueries({ queryKey: ['runner-summary'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
            toast.success('Devoluciones editadas y stock actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al editar devoluciones', { description: err.message })
        }
    })
}

export function useRunnerSummary() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['runner-summary'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

            // Fetch inventory assignments summary (includes shift_id)
            const { data: inventoryData, error: invErr } = await supabase
                .from('runner_inventory_assignments')
                .select(`
                    runner_id,
                    shift_id,
                    runner:profiles!runner_id(full_name),
                    shift:shifts!shift_id(name),
                    assigned_qty,
                    returned_qty,
                    sold_qty,
                    status,
                    product:products!product_id(price)
                `)
                .eq('organization_id', organization_id)
                .eq('assignment_date', today)

            if (invErr) throw invErr

            // Fetch shift definitions to resolve null shift_ids by time
            const { data: shiftDefs } = await supabase
                .from('shifts')
                .select('*')
                .eq('organization_id', organization_id)
                .eq('active', true)
                .order('start_time')
            const shiftList = (shiftDefs || []) as Shift[]

            // Fetch actual POS sales by runner+shift for today
            const { data: salesData, error: salesErr } = await supabase
                .from('sales')
                .select('seller_id, shift_id, total, created_at')
                .eq('organization_id', organization_id)
                .eq('status', 'CONFIRMED')
                .gte('created_at', `${today}T00:00:00-05:00`)
                .lte('created_at', `${today}T23:59:59-05:00`)

            if (salesErr) throw salesErr

            // Build POS sales map per runner+shift (resolving null shift_ids by time)
            const posSalesMap: Record<string, number> = {}
            for (const sale of salesData || []) {
                if (!sale.seller_id) continue
                const resolvedShift = resolveShiftId(sale, shiftList)
                const key = `${sale.seller_id}__${resolvedShift || 'none'}`
                posSalesMap[key] = (posSalesMap[key] || 0) + (sale.total || 0)
            }

            // Group inventory by runner + shift
            const summary = (inventoryData || []).reduce((acc: any, item: any) => {
                const runnerId = item.runner_id
                const shiftId = item.shift_id || 'none'
                const groupKey = `${runnerId}__${shiftId}`
                if (!acc[groupKey]) {
                    acc[groupKey] = {
                        runner_id: runnerId,
                        shift_id: item.shift_id || null,
                        shift_name: (item.shift as any)?.name || null,
                        runner_name: item.runner?.full_name || 'Sin nombre',
                        total_assigned: 0,
                        total_returned: 0,
                        total_sold_inv: 0,
                        total_value_inv: 0,
                        total_pos_sales: 0,
                        active_assignments: 0
                    }
                }
                acc[groupKey].total_assigned += item.assigned_qty
                acc[groupKey].total_returned += item.returned_qty
                acc[groupKey].total_sold_inv += item.sold_qty
                acc[groupKey].total_value_inv += item.sold_qty * (item.product?.price || 0)
                if (item.status === 'active') acc[groupKey].active_assignments++
                return acc
            }, {})

            // Merge POS sales into summary
            for (const groupKey of Object.keys(summary)) {
                const entry = summary[groupKey]
                const salesKey = `${entry.runner_id}__${entry.shift_id || 'none'}`
                entry.total_pos_sales = posSalesMap[salesKey] || 0
            }

            return Object.values(summary)
        },
        refetchInterval: 30000
    })
}

// Monthly runner inventory assignments (for calendar dialog)
// Padding ±1 day on assignment_date to capture UTC/Colombia boundary crossings
// (e.g. assigned_at 9:45PM Colombia = assignment_date next day in UTC)
// Frontend filters by assigned_at Colombia date for accuracy.
export function useMonthlyRunnerInventory(startDate: Date, endDate: Date) {
    const supabase = createClient()
    const startStr = startDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const endStr = endDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    // Pad ±1 day to capture records where assignment_date (UTC) differs from assigned_at (Colombia)
    const paddedStart = new Date(startDate)
    paddedStart.setDate(paddedStart.getDate() - 1)
    const paddedStartStr = paddedStart.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    const paddedEnd = new Date(endDate)
    paddedEnd.setDate(paddedEnd.getDate() + 1)
    const paddedEndStr = paddedEnd.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    return useQuery({
        queryKey: ['monthly-runner-inventory', startStr, endStr],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const { data, error } = await supabase
                .from('runner_inventory_assignments')
                .select(`
                    runner_id, assigned_qty, returned_qty, status,
                    assignment_date, assigned_at,
                    runner:profiles!runner_id(full_name)
                `)
                .eq('organization_id', organization_id)
                .gte('assignment_date', paddedStartStr)
                .lte('assignment_date', paddedEndStr)
                .order('assigned_at', { ascending: true })
            if (error) throw error
            return data || []
        }
    })
}

// Helper: determine shift_id from sale time using shift definitions
export function resolveShiftId(sale: { shift_id: string | null; created_at: string }, shifts: Shift[]): string | null {
    if (sale.shift_id) return sale.shift_id
    if (!shifts.length) return null
    // Get Colombia time HH:mm from created_at
    const d = new Date(sale.created_at)
    const colombiaTime = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
    for (const shift of shifts) {
        const start = shift.start_time.slice(0, 5)
        const end = shift.end_time.slice(0, 5)
        if (colombiaTime >= start && colombiaTime < end) return shift.id
    }
    return null
}

// Returns POS sales keyed by `${runnerId}__${date}__${shiftId||'none'}` for all given dates
// Also keeps legacy key `${runnerId}__${date}` with the total (for calendar/other consumers)
export function useRunnerPOSSalesByDates(dates: string[]) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['runner-pos-sales-multi', dates.slice().sort().join(',')],
        queryFn: async () => {
            if (dates.length === 0) return {} as Record<string, number>
            const { organization_id } = await getOrCreateProfile(supabase)

            // Fetch shift definitions to resolve null shift_ids by time
            const { data: shifts } = await supabase
                .from('shifts')
                .select('*')
                .eq('organization_id', organization_id)
                .eq('active', true)
                .order('start_time')
            const shiftList = (shifts || []) as Shift[]

            const result: Record<string, number> = {}
            await Promise.all(dates.map(async (date) => {
                const { data, error } = await supabase
                    .from('sales')
                    .select('seller_id, total, shift_id, created_at')
                    .eq('organization_id', organization_id)
                    .eq('status', 'CONFIRMED')
                    .gte('created_at', `${date}T00:00:00-05:00`)
                    .lte('created_at', `${date}T23:59:59-05:00`)
                if (error) return
                for (const sale of data || []) {
                    if (!sale.seller_id) continue
                    const resolvedShift = resolveShiftId(sale, shiftList)
                    // Key per shift
                    const shiftKey = `${sale.seller_id}__${date}__${resolvedShift || 'none'}`
                    result[shiftKey] = (result[shiftKey] || 0) + (sale.total || 0)
                    // Legacy key (total per runner+date, used by calendar)
                    const legacyKey = `${sale.seller_id}__${date}`
                    result[legacyKey] = (result[legacyKey] || 0) + (sale.total || 0)
                }
            }))
            return result
        },
        enabled: dates.length > 0
    })
}

// Returns POS sales by product keyed by `${sellerId}__${date}__${shiftId||'none'}__${productId}` → qty sold
export function useRunnerPOSSalesByProduct(dates: string[]) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['runner-pos-sales-by-product', dates.slice().sort().join(',')],
        queryFn: async () => {
            if (dates.length === 0) return {} as Record<string, number>
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data: shifts } = await supabase
                .from('shifts')
                .select('*')
                .eq('organization_id', organization_id)
                .eq('active', true)
                .order('start_time')
            const shiftList = (shifts || []) as Shift[]

            const result: Record<string, number> = {}
            await Promise.all(dates.map(async (date) => {
                const { data, error } = await supabase
                    .from('sale_items')
                    .select(`
                        product_id,
                        qty,
                        sale:sales!inner(
                            seller_id,
                            shift_id,
                            created_at,
                            organization_id,
                            status
                        )
                    `)
                    .eq('sale.organization_id', organization_id)
                    .eq('sale.status', 'CONFIRMED')
                    .gte('sale.created_at', `${date}T00:00:00-05:00`)
                    .lte('sale.created_at', `${date}T23:59:59-05:00`)
                if (error) return
                for (const item of data || []) {
                    const sale = item.sale as any
                    if (!sale?.seller_id) continue
                    const resolvedShift = resolveShiftId({ shift_id: sale.shift_id, created_at: sale.created_at }, shiftList)
                    const key = `${sale.seller_id}__${date}__${resolvedShift || 'none'}__${item.product_id}`
                    result[key] = (result[key] || 0) + (item.qty || 0)
                }
            }))
            return result
        },
        enabled: dates.length > 0
    })
}

export function useUnclosedPreviousAssignments() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['unclosed-previous-assignments'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
            const { data, error } = await supabase
                .from('runner_inventory_assignments')
                .select('runner_id, assignment_date, runner:profiles!runner_id(full_name)')
                .eq('organization_id', organization_id)
                .eq('status', 'active')
                .lt('assignment_date', today)
            if (error) throw error
            const seen = new Set<string>()
            return (data || [])
                .filter(r => {
                    if (seen.has(r.runner_id)) return false
                    seen.add(r.runner_id)
                    return true
                })
                .map(r => ({
                    runner_id: r.runner_id,
                    runner_name: (r.runner as any)?.full_name || 'Corredor',
                    assignment_date: r.assignment_date
                }))
        }
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
