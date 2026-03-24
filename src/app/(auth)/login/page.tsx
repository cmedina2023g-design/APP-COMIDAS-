'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, User, Lock } from 'lucide-react'

export default function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Convert username to internal email format
            const email = username.includes('@') ? username : `${username.toLowerCase().trim()}@pos.local`

            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw new Error('Usuario o contraseña incorrectos')

            // Create user session record
            if (authData.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('organization_id, role')
                    .eq('id', authData.user.id)
                    .single()

                if (profile?.organization_id) {
                    // Close any existing active sessions
                    await supabase
                        .from('user_sessions')
                        .update({ ended_at: new Date().toISOString() })
                        .eq('user_id', authData.user.id)
                        .is('ended_at', null)

                    // Create new session
                    await supabase.from('user_sessions').insert({
                        user_id: authData.user.id,
                        organization_id: profile.organization_id,
                        started_at: new Date().toISOString()
                    })
                }

                // Redirect based on role
                if (profile?.role === 'RUNNER') {
                    router.push('/pos')
                } else if (profile?.role === 'SELLER') {
                    router.push('/pos')
                } else {
                    router.push('/dashboard')
                }
            }

            toast.success('Bienvenido')
            router.refresh()
        } catch (error: any) {
            toast.error('Error', { description: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <Card className="w-full max-w-sm border-slate-700 bg-slate-800/80 backdrop-blur shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="mx-auto mb-2 h-16 w-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <span className="text-2xl">🍔</span>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Street Food POS</CardTitle>
                    <CardDescription className="text-slate-400">
                        Ingresa tus credenciales para acceder
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-slate-300">Usuario</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="Ej: vendedor"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500"
                                    autoComplete="username"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500 focus:ring-orange-500"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Ingresando...
                                </>
                            ) : (
                                'Iniciar Sesión'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
