'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Trash2, Plus, Loader2, KeyRound } from 'lucide-react'
import { useShifts, useUpdateShift } from '@/hooks/use-sessions'
import { usePaymentMethods, useCreatePaymentMethod, useTogglePaymentMethod, useDeletePaymentMethod } from '@/hooks/use-settings'
import { useProfiles, useUpdateProfileRole, useToggleProfileActive, UserRole } from '@/hooks/use-profiles'
import { useCurrentProfile } from '@/hooks/use-profiles'
import { createEmployeeUser, deleteEmployeeUser, changeEmployeePassword } from '@/app/actions/auth-actions'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

function CreateUserForm({ organizationId }: { organizationId?: string }) {
    const [loading, setLoading] = useState(false)
    const [formKey, setFormKey] = useState(0)
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
                setFormKey(k => k + 1)
            }
        } catch (e) {
            toast.error('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form key={formKey} action={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
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
                <Input name="password" type="password" placeholder="••••••" required minLength={6} />
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

    useEffect(() => {
        setStartTime(shift.start_time)
        setEndTime(shift.end_time)
    }, [shift.start_time, shift.end_time])

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
    const { data: currentProfile } = useCurrentProfile()
    const queryClient = useQueryClient()

    const createMutation = useCreatePaymentMethod()
    const toggleMutation = useTogglePaymentMethod()
    const deleteMutation = useDeletePaymentMethod()
    const updateRoleMutation = useUpdateProfileRole()
    const toggleActiveMutation = useToggleProfileActive()

    const [newName, setNewName] = useState('')

    // Delete user state
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    // Change password state
    const [pwTarget, setPwTarget] = useState<{ id: string; name: string } | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [pwLoading, setPwLoading] = useState(false)

    const handleDeleteUser = async () => {
        if (!deleteTarget) return
        setDeleteLoading(true)
        const result = await deleteEmployeeUser(deleteTarget.id)
        setDeleteLoading(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(`Usuario "${deleteTarget.name}" eliminado`)
            queryClient.invalidateQueries({ queryKey: ['profiles'] })
            setDeleteTarget(null)
        }
    }

    const handleChangePassword = async () => {
        if (!pwTarget) return
        setPwLoading(true)
        const result = await changeEmployeePassword(pwTarget.id, newPassword)
        setPwLoading(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(`Contraseña de "${pwTarget.name}" actualizada`)
            setPwTarget(null)
            setNewPassword('')
        }
    }

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
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Rol</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {profiles?.map(profile => (
                                            <TableRow key={profile.id}>
                                                <TableCell className="font-medium">
                                                    {profile.full_name || profile.id}
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
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => toggleActiveMutation.mutate({ id: profile.id, active: !profile.active })}
                                                        className={profile.active ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-red-500 border-red-200 hover:bg-red-50'}
                                                        disabled={toggleActiveMutation.isPending}
                                                    >
                                                        {profile.active ? 'Activo' : 'Inactivo'}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Cambiar contraseña"
                                                            onClick={() => { setPwTarget({ id: profile.id, name: profile.full_name || profile.id }); setNewPassword('') }}
                                                        >
                                                            <KeyRound className="h-4 w-4 text-slate-500" />
                                                        </Button>
                                                        {profile.id !== currentProfile?.id && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Eliminar usuario"
                                                                onClick={() => setDeleteTarget({ id: profile.id, name: profile.full_name || profile.id })}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        )}
                                                    </div>
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

            {/* Delete user dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar usuario</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        ¿Estás seguro de eliminar a <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Esta acción no se puede deshacer.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteLoading}>
                            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change password dialog */}
            <Dialog open={!!pwTarget} onOpenChange={(open) => { if (!open) { setPwTarget(null); setNewPassword('') } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cambiar contraseña</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground mb-2">
                        Nueva contraseña para <span className="font-semibold text-foreground">{pwTarget?.name}</span>
                    </p>
                    <Input
                        type="password"
                        placeholder="Nueva contraseña (mín. 6 caracteres)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={6}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setPwTarget(null); setNewPassword('') }} disabled={pwLoading}>Cancelar</Button>
                        <Button onClick={handleChangePassword} disabled={pwLoading || newPassword.length < 6}>
                            {pwLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
