'use client'

import React from 'react'
import { ReceivablesList } from '@/components/admin/receivables-list'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ReceivablesPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/reports/calendar">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Cartera</h2>
                    <p className="text-muted-foreground">Gestiona las cuentas por cobrar.</p>
                </div>
            </div>

            <ReceivablesList />
        </div>
    )
}
