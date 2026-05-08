import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { exportPDF, exportExcel } from "@/lib/export";
import { 
  useGetAuditSession, 
  useGetAuditSummary, 
  useGetAuditBlockers, 
  useDeleteAuditSession,
  getGetAuditStatsQueryKey,
  getListAuditSessionsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Server, Puzzle, Layers, GitBranch, Shield, Users, 
  Database, Zap, FolderOpen, AlertCircle, AlertTriangle, 
  Info, Trash2, ArrowLeft, Loader2, FileDown, FileSpreadsheet
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

const ICONS = {
  system_info: Server,
  plugins: Puzzle,
  custom_fields: Layers,
  workflows: GitBranch,
  permissions: Shield,
  users: Users,
  data_volume: Database,
  automation: Zap,
  projects: FolderOpen
};

const READINESS_COLORS = {
  critical: "text-red-500",
  at_risk: "text-orange-500",
  moderate: "text-yellow-500",
  good: "text-teal-500",
  excellent: "text-green-500"
};

export default function AuditDetail() {
  const [, params] = useRoute("/audit/:id");
  const id = params?.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const handleExportPDF = async () => {
    if (!session) return;
    setExporting("pdf");
    try {
      exportPDF(session as any, summary as any);
      toast({ title: "PDF downloaded successfully" });
    } catch {
      toast({ title: "Failed to export PDF", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!session) return;
    setExporting("excel");
    try {
      exportExcel(session as any, summary as any);
      toast({ title: "Excel file downloaded successfully" });
    } catch {
      toast({ title: "Failed to export Excel", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const { data: session, isLoading: sessionLoading } = useGetAuditSession(id, {
    query: {
      enabled: !!id,
      refetchInterval: (query) => {
        const state = query.state.data;
        return (state && (state.status === "pending" || state.status === "running")) ? 3000 : false;
      }
    }
  });

  const isCompleted = session?.status === "completed";

  const { data: summary, isLoading: summaryLoading } = useGetAuditSummary(id, {
    query: { enabled: !!id && isCompleted }
  });

  const { data: blockers, isLoading: blockersLoading } = useGetAuditBlockers(id, {
    query: { enabled: !!id && isCompleted }
  });

  const deleteMutation = useDeleteAuditSession();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Audit session deleted" });
      queryClient.invalidateQueries({ queryKey: getListAuditSessionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAuditStatsQueryKey() });
      setLocation("/");
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const findingsByCategory = useMemo(() => {
    if (!session?.findings) return {};
    const grouped = session.findings.reduce((acc: any, finding) => {
      if (!acc[finding.category]) acc[finding.category] = [];
      acc[finding.category].push(finding);
      return acc;
    }, {});
    
    // Sort findings within category: blocker > warning > info
    const severityOrder = { blocker: 0, warning: 1, info: 2 };
    Object.keys(grouped).forEach(k => {
      grouped[k].sort((a: any, b: any) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]);
    });
    return grouped;
  }, [session?.findings]);

  if (sessionLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!session) {
    return <div>Audit not found</div>;
  }

  if (session.status === "pending" || session.status === "running") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
        <div className="relative">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {session.status === "pending" ? "0%" : "50%"}
            </span>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Audit in Progress</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            Scanning {session.jiraUrl}. This may take a few minutes depending on the size of the instance.
          </p>
        </div>
      </div>
    );
  }

  if (session.status === "failed") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/20">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Audit
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Audit Session</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this audit session and all related findings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Audit Failed</AlertTitle>
          <AlertDescription>
            {session.errorMessage || "An unexpected error occurred during the audit process."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-2">
          {isCompleted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exporting !== null}
                data-testid="button-export-excel"
              >
                {exporting === "excel" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                )}
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={exporting !== null}
                data-testid="button-export-pdf"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4 text-red-500" />
                )}
                Export PDF
              </Button>
            </>
          )}

          <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/20">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Audit Session</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this audit session and all related findings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {session.label || session.serverTitle || "Jira Audit Results"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{session.jiraUrl}</span>
            {session.jiraVersion && <Badge variant="outline">v{session.jiraVersion}</Badge>}
            {session.deploymentType && <Badge variant="outline" className="capitalize">{session.deploymentType}</Badge>}
            <span>•</span>
            <span>{format(new Date(session.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
        
        {summary && (
          <Card className="w-full lg:w-auto min-w-[300px] border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex items-center justify-between gap-6">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Migration Readiness</div>
                <div className={`text-xl font-semibold capitalize ${READINESS_COLORS[summary.readinessLevel as keyof typeof READINESS_COLORS]}`}>
                  {summary.readinessLevel.replace("_", " ")}
                </div>
              </div>
              <div className="relative flex items-center justify-center h-20 w-20 rounded-full border-4 border-muted">
                <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle className="text-muted/20" strokeWidth="8" stroke="currentColor" fill="transparent" r="46" cx="50" cy="50" />
                  <circle 
                    className={`${READINESS_COLORS[summary.readinessLevel as keyof typeof READINESS_COLORS]}`} 
                    strokeWidth="8" 
                    strokeDasharray={`${summary.readinessScore * 2.89} 289`} 
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="46" cx="50" cy="50" 
                  />
                </svg>
                <span className="text-2xl font-bold">{summary.readinessScore}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" /> Hard Blockers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{session.blockerCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Must resolve before migration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{session.warningCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Review for potential issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" /> Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{session.infoCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">General observations</p>
          </CardContent>
        </Card>
      </div>

      {blockers && blockers.length > 0 && (
        <Card className="border-destructive/30 shadow-sm shadow-destructive/5">
          <CardHeader className="bg-destructive/5 border-b border-destructive/10">
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Critical Blockers
            </CardTitle>
            <CardDescription>These issues will prevent a successful migration to Jira Cloud.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {blockers.map(blocker => (
              <div key={blocker.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex gap-4">
                  <div className="mt-1">
                    <Badge variant="destructive" className="uppercase text-[10px] tracking-wider px-2">Blocker</Badge>
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold text-base">{blocker.title}</h4>
                    <p className="text-sm text-muted-foreground">{blocker.description}</p>
                    {blocker.migrationNote && (
                      <div className="mt-3 p-3 bg-muted rounded-md text-sm border border-border/50">
                        <span className="font-semibold mr-2">Action Required:</span>
                        {blocker.migrationNote}
                      </div>
                    )}
                  </div>
                  {blocker.count && blocker.count > 1 && (
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs font-mono">{blocker.count} instances</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary && summary.categoryBreakdown.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Category Breakdown</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summary.categoryBreakdown.map(cat => {
              const Icon = ICONS[cat.category as keyof typeof ICONS] || Puzzle;
              return (
                <Card key={cat.category} className="overflow-hidden">
                  <div className="p-4 flex items-center gap-3 border-b bg-muted/20">
                    <div className="p-2 bg-background rounded-md border shadow-sm">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold capitalize text-sm">{cat.category.replace("_", " ")}</h3>
                    </div>
                    <div className="text-sm font-bold">{cat.score}%</div>
                  </div>
                  <Progress value={cat.score} className="h-1 rounded-none" />
                  <div className="p-3 bg-background flex justify-between text-xs text-muted-foreground">
                    <span className={cat.blockers > 0 ? "text-destructive font-medium" : ""}>
                      {cat.blockers} Blockers
                    </span>
                    <span className={cat.warnings > 0 ? "text-amber-600 font-medium" : ""}>
                      {cat.warnings} Warnings
                    </span>
                    <span>{cat.infos} Info</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight">All Findings</h2>
        {Object.entries(findingsByCategory).map(([category, findings]: [string, any]) => {
          const Icon = ICONS[category as keyof typeof ICONS] || Puzzle;
          return (
            <Card key={category} className="overflow-hidden">
              <CardHeader className="bg-muted/20 py-3 border-b flex flex-row items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <CardTitle className="text-base capitalize m-0">{category.replace("_", " ")}</CardTitle>
                <Badge variant="secondary" className="ml-auto">{findings.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {findings.map((finding: any) => (
                  <div key={finding.id} className="p-4 hover:bg-muted/10 transition-colors flex gap-4">
                    <div className="pt-0.5">
                      {finding.severity === 'blocker' && <AlertCircle className="h-4 w-4 text-destructive" />}
                      {finding.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      {finding.severity === 'info' && <Info className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-foreground">{finding.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
                    </div>
                    {finding.count && finding.count > 0 && (
                      <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        n={finding.count}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}