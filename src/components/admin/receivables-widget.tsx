'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { useReceivables } from '@/hooks/use-sales'

export function ReceivablesWidget() {
    const { data: receivables, isLoading } = useReceivables()
    const total = receivables?.reduce((acc: number, r: any) => acc + r.total, 0) || 0

    if (isLoading || total === 0) return null

    return (
        <Link href="/admin/finance/receivables">
            <Button variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800">
                <ShieldAlert className="mr-2 h-4 w-4" />
                Cartera: ${total.toLocaleString()}
            </Button>
        </Link>
    )
}
