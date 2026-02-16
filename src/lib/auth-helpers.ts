import { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateProfile(supabase: SupabaseClient) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado')

    // 1. Try to get profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    if (profile) return { user, organization_id: profile.organization_id }

    // 2. If no profile, check if user has any profile (maybe error in query?)
    // Assuming strictly no profile row: Create Org + Profile
    console.log('Creando perfil y organización por defecto...')

    const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: 'Mi Negocio' })
        .select()
        .single()

    if (orgError) throw orgError

    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            organization_id: newOrg.id,
            role: 'ADMIN',
            full_name: user.email?.split('@')[0] || 'Admin',
            active: true
        })

    if (profileError) throw profileError

    return { user, organization_id: newOrg.id }
}
