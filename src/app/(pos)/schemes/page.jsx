'use client'

import { Suspense } from "react"
import { RefreshCw, LayoutGrid } from 'lucide-react';
import { useScheme } from "@/hooks/schemes/useSchemes";
import SchemeCard from "@/components/features/schemes/SchemeCard";
import PageLoader from "@/components/shared/PageLoader";

function SchemesScreen() {
    const { schemes, isLoading, isError, refetch } = useScheme()

    if(isLoading) return <PageLoader />

    if(isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
                <p className="text-sm text-muted-foreground text-center">
                    Failed to load schemes. Please try again.
                </p>
                <button onClick={() => refetch} className="flex items-center gap-2 text-sm font-medium text-primary">
                    <RefreshCw className="w-4 h-4" />
                    Retry
                </button>
            </div>
        )
    }

    if(schemes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6">
                <LayoutGrid className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground text-center">
                    No schemes available.
                </p>
            </div>
        )
    }

    return (
        <div className="p-4 pb-8">
            {/* Header */}
            <div className="mb-5">
                <h1 className="text-xl font-semibold text-foreground">Schemes</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {schemes.length} scheme{schemes.length !== 1 ? 's' : ''} available
                </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {schemes.map((scheme) => (
                    <SchemeCard key={scheme.scheme_id} scheme={scheme} />
                ))}
            </div>
        </div>
    )
}

export default function SchemesPage() {
    return (
        <Suspense fallback={<PageLoader />}>
            <SchemesScreen />
        </Suspense>
    )
}