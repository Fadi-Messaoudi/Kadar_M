import { useListAuditSessions, useGetAuditStats } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { PlusCircle, Activity, AlertCircle, AlertTriangle, Info, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAuditStats();
  const { data: sessions, isLoading: sessionsLoading } = useListAuditSessions();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Audit status across your Atlassian ecosystem.</p>
        </div>
        <Link href="/audit/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2" data-testid="button-new-audit-header">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Audit
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Audits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-16" /> : (
              <div className="text-2xl font-bold" data-testid="stat-total-sessions">{stats?.totalSessions ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Readiness</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-16" /> : (
              <div className="text-2xl font-bold" data-testid="stat-avg-readiness">{stats?.averageReadinessScore ? Math.round(stats.averageReadinessScore) : 0}%</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Blockers</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-16" /> : (
              <div className="text-2xl font-bold text-destructive" data-testid="stat-total-blockers">{stats?.totalBlockersFound ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-16" /> : (
              <div className="text-2xl font-bold text-amber-600" data-testid="stat-total-warnings">{stats?.totalWarningsFound ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Recent Sessions</h2>
        {sessionsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Link key={session.id} href={`/audit/${session.id}`} className="block group">
                <Card className="hover-elevate transition-shadow hover:border-primary/50 cursor-pointer" data-testid={`card-session-${session.id}`}>
                  <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {session.label || session.serverTitle || 'Unnamed Audit'}
                        </span>
                        <StatusBadge status={session.status} />
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="truncate max-w-[200px] sm:max-w-xs">{session.jiraUrl}</span>
                        {session.jiraVersion && <span>• v{session.jiraVersion}</span>}
                        {session.deploymentType && <span>• {session.deploymentType}</span>}
                      </p>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {session.status === "completed" && session.readinessScore !== undefined && (
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Readiness</div>
                          <div className="text-xl font-bold">
                            {session.readinessScore}%
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Blockers</span>
                          <Badge variant="outline" className="text-destructive border-destructive/30 mt-1">
                            {session.blockerCount ?? '-'}
                          </Badge>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Warnings</span>
                          <Badge variant="outline" className="text-amber-600 border-amber-600/30 mt-1">
                            {session.warningCount ?? '-'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-2">No audits found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Start by connecting to a Jira Server or Data Center instance to analyze migration readiness.
            </p>
            <Link href="/audit/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2" data-testid="button-empty-new-audit">
              <PlusCircle className="mr-2 h-4 w-4" />
              Start First Audit
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Completed</Badge>;
    case 'running':
      return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 flex items-center gap-1"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span> Running</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'pending':
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}