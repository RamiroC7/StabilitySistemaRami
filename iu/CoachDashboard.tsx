export default function Dashboard() {
    return (
        <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome to the Professors Platform.</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Placeholder for stats cards */}
                <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
                    <div className="flex flex-col space-y-1.5">
                        <h3 className="font-semibold leading-none tracking-tight">Total Students</h3>
                    </div>
                    <div className="p-0 pt-4">
                        <div className="text-2xl font-bold">1,234</div>
                        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
