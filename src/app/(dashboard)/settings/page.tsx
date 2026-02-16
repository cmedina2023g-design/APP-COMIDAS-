'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import { useShifts, useUpdateShift } from '@/hooks/use-sessions'
import { usePaymentMethods, useCreatePaymentMethod, useTogglePaymentMethod, useDeletePaymentMethod } from '@/hooks/use-settings'
import { useProfiles, useUpdateProfileRole, UserRole } from '@/hooks/use-profiles'
import { createEmployeeUser } from '@/app/actions/auth-actions'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function CreateUserForm({ organizationId }: { organizationId?: string }) {
    const [loading, setLoading] = useState(false)
    const queryClient = useQueryClient()

    async function onSubmit(formData: FormData) {
        if (!organizationId) {
            toast.error('No se pudo identificar la organización')
            return
        }
        setLoading(true)
        formData.append('organizationId', organizationId)

        try {
            const result = await createEmployeeUser(null, formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Usuario creado correctamente')
                queryClient.invalidateQueries({ queryKey: ['profiles'] })
                // Optional: reset form via key or ref
            }
        } catch (e) {
            toast.error('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form action={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
            <div className="space-y-2">
                <Label>Nombre</Label>
                <Input name="fullName" placeholder="Ej: Vendedor 1" required />
            </div>
            <div className="space-y-2">
                <Label>Usuario</Label>
                <Input name="username" type="text" placeholder="Ej: vendedor1" required />
            </div>
            <div className="space-y-2">
                <Label>Contraseña</Label>
                <Input name="password" type="text" placeholder="123456" required minLength={6} />
            </div>
            <div className="space-y-2">
                <Label>Rol</Label>
                <select name="role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="SELLER">Vendedor</option>
                    <option value="RUNNER">Corredor</option>
                    <option value="ADMIN">Administrador</option>
                </select>
            </div>

            <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Crear Usuario
            </Button>
        </form>
    )
}

function ShiftCard({ shift, updateShift }: { shift: any, updateShift: any }) {
    const [startTime, setStartTime] = useState(shift.start_time)
    const [endTime, setEndTime] = useState(shift.end_time)

    // Sync state if prop changes (e.g. initial load or external update)
    // ensuring we don't overwrite user typing if they are focused? 
    // Actually defaultValue approach is usually fine if key changes, but let's try controlled.

    // Better yet: just use defaultValue but force re-render when data changes?
    // The issue described (reverts on page change) suggests the server data IS NOT updating?
    // Or hooks are caching old data? "vuelve y aparece de 2 a 11" suggests database didn't update or cache is stale.

    // Let's force controlled inputs to be sure.

    const handleBlurStart = () => {
        if (startTime !== shift.start_time) {
            updateShift.mutate({ id: shift.id, start_time: startTime })
        }
    }

    const handleBlurEnd = () => {
        if (endTime !== shift.end_time) {
            updateShift.mutate({ id: shift.id, end_time: endTime })
        }
    }

    return (
        <Card key={shift.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-medium">Turno {shift.name}</CardTitle>
                <Switch
                    checked={shift.active}
                    onCheckedChange={(checked) => updateShift.mutate({ id: shift.id, active: checked })}
                />
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hora Inicio</Label>
                            <Input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                onBlur={handleBlurStart}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Hora Fin</Label>
                            <Input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                onBlur={handleBlurEnd}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Los cambios se guardan automáticamente al salir del campo.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

function ShiftSettings() {
    const { data: shifts, isLoading } = useShifts()
    const updateShift = useUpdateShift()

    if (isLoading) return <div>Cargando turnos...</div>

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {shifts?.map(shift => (
                <ShiftCard key={shift.id} shift={shift} updateShift={updateShift} />
            ))}
        </div>
    )
}

export default function SettingsPage() {
    const { data: methods, isLoading } = usePaymentMethods()
    const { data: profiles } = useProfiles()

    const createMutation = useCreatePaymentMethod()
    const toggleMutation = useTogglePaymentMethod()
    const deleteMutation = useDeletePaymentMethod()
    const updateRoleMutation = useUpdateProfileRole()

    const [newName, setNewName] = useState('')

    const handleCreateMethod = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName) return
        await createMutation.mutateAsync(newName)
        setNewName('')
    }

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>

            <Tabs defaultValue="methods" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="methods">Métodos de Pago</TabsTrigger>
                    <TabsTrigger value="shifts">Turnos</TabsTrigger>
                    <TabsTrigger value="team">Equipo y Usuarios</TabsTrigger>
                </TabsList>

                <TabsContent value="shifts">
                    <ShiftSettings />
                </TabsContent>

                <TabsContent value="methods">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Métodos de Pago</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={handleCreateMethod} className="flex gap-2">
                                <Input
                                    placeholder="Nuevo método (ej: Nequi)"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                                <Button type="submit" disabled={!newName || createMutation.isPending}>
                                    <Plus className="h-4 w-4 mr-2" /> Agregar
                                </Button>
                            </form>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Activo</TableHead>
                                        <TableHead className="text-right">Borrar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {methods?.map(method => (
                                        <TableRow key={method.id}>
                                            <TableCell>{method.name}</TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={method.active}
                                                    onCheckedChange={(checked) => toggleMutation.mutate({ id: method.id, active: checked })}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(method.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {methods?.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">Sin métodos configurados</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="team">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestión de Equipo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CreateUserForm organizationId={profiles?.[0]?.organization_id} />

                            <div className="mt-8">
                                <h3 className="text-lg font-medium mb-4">Usuarios Existentes</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre / Email (ID)</TableHead>
                                            <TableHead>Rol</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {profiles?.map(profile => (
                                            <TableRow key={profile.id}>
                                                <TableCell className="font-medium">
                                                    {profile.full_name || profile.id}
                                                    <div className="text-xs text-muted-foreground">{profile.id}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={profile.role}
                                                        onValueChange={(val: UserRole) => updateRoleMutation.mutate({ id: profile.id, role: val })}
                                                    >
                                                        <SelectTrigger className="w-[140px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ADMIN">Administrador</SelectItem>
                                                            <SelectItem value="SELLER">Vendedor</SelectItem>
                                                            <SelectItem value="RUNNER">Corredor</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    {profile.active ? <span className="text-green-600">Activo</span> : <span className="text-red-500">Inactivo</span>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
