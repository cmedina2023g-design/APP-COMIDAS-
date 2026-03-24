"use server"

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Note: This requires SUPABASE_SERVICE_ROLE_KEY in .env.local
// We use the 'supabase-js' library directly for the admin client in server actions
// to ensure we bypass RLS and Auth restrictions for user creation.

export async function createEmployeeUser(prevState: any, formData: FormData) {
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string
    const role = formData.get('role') as string
    const organizationId = formData.get('organizationId') as string

    if (!username || !password || !fullName || !role || !organizationId) {
        return { error: 'Faltan datos requeridos' }
    }

    // Convert username to internal email format
    const email = `${username.toLowerCase().trim()}@pos.local`

    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // 1. Create Auth User (Auto-confirm email)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, username: username.toLowerCase().trim() }
        })

        if (authError) {
            if (authError.message?.includes('already been registered')) {
                throw new Error('Ese nombre de usuario ya existe')
            }
            throw authError
        }
        if (!authData.user) throw new Error('No se pudo crear el usuario')

        // 2. Create Profile linked to Organization
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: authData.user.id,
                organization_id: organizationId,
                full_name: fullName,
                role: role,
                active: true
            })

        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            throw profileError
        }

        return { success: true, message: `Usuario "${username}" creado correctamente` }
    } catch (error: any) {
        return { error: error.message || 'Error al crear usuario' }
    }
}
