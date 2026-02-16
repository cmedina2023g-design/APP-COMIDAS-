import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'

export interface Notification {
    id: string
    title: string
    message: string
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
    read: boolean
    link?: string
    created_at: string
}

export function useNotifications() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            // Ensure user is loaded
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return []

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            return data as Notification[]
        },
        // Refetch every minute to check for new alerts
        refetchInterval: 60000
    })
}

export function useUnreadCount() {
    const { data: notifications } = useNotifications()
    return notifications?.filter(n => !n.read).length || 0
}

export function useMarkNotificationRead() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    })
}

export function useMarkAllRead() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            // We can fetch unread IDs and update them, or update all where read=false
            // But update needs filters.
            const { organization_id } = await getOrCreateProfile(supabase)

            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('organization_id', organization_id)
                .is('read', false)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    })
}
