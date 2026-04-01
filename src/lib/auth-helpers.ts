import { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateProfile(supabase: SupabaseClient) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuario no autenticado')

    // 1. Try to get profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    if (profile) return { user, organization_id: profile.organization_id }

    // PGRST116 = PostgREST "no rows returned" — the only safe case to auto-create.
    // Any other error (RLS, network, etc.) must NOT silently create an ADMIN profile.
    if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
    }

    // 2. No profile row exists — first-time ADMIN setup only.
    console.log('Creando perfil y organización por defecto...')

    const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: 'Mi Negocio' })
        .select()
        .single()

    if (orgError) throw orgError

    const { error: profileCreateError } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            organization_id: newOrg.id,
            role: 'ADMIN',
            full_name: user.email?.split('@')[0] || 'Admin',
            active: true
        })

    if (profileCreateError) throw profileCreateError

    return { user, organization_id: newOrg.id }
}
