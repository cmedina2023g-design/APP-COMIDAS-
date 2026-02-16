import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getOrCreateProfile } from '@/lib/auth-helpers'

export type UserRole = 'ADMIN' | 'SELLER' | 'RUNNER'

export type Profile = {
    id: string
    organization_id: string
    full_name: string | null
    role: UserRole
    active: boolean
    created_at: string
}

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
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as Profile[]
        }
    })
}

export function useCurrentProfile() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['current-profile'],
        queryFn: async () => {
            // Ensure profile exists
            await getOrCreateProfile(supabase)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return null

            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            if (error) return null
            return data as Profile
        }
    })
}

export function useUpdateProfileRole() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, role }: { id: string, role: UserRole }) => {
            const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] })
            toast.success('Rol actualizado', { description: 'El usuario debe recargar para ver los cambios.' })
        },
        onError: (err: any) => toast.error('Error', { description: err.message })
    })
}
