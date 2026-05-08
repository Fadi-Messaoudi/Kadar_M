import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTestJiraConnection, useCreateAuditSession } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Server, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";

const formSchema = z.object({
  jiraUrl: z.string().url({ message: "Must be a valid URL (e.g., https://jira.company.com)" }),
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password/PAT is required" }),
  label: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewAudit() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const testConnection = useTestJiraConnection();
  const createAudit = useCreateAuditSession();
  
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    version?: string;
    type?: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jiraUrl: "",
      username: "",
      password: "",
      label: "",
    },
  });

  const onTestConnection = async () => {
    const valid = await form.trigger(["jiraUrl", "username", "password"]);
    if (!valid) return;
    
    const values = form.getValues();
    
    try {
      const result = await testConnection.mutateAsync({
        data: {
          jiraUrl: values.jiraUrl,
          username: values.username,
          password: values.password,
        }
      });
      
      setTestResult({
        success: result.success,
        message: result.message,
        version: result.jiraVersion,
        type: result.deploymentType,
      });
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Connected to Jira ${result.deploymentType} v${result.jiraVersion}`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to connect to Jira instance. Check credentials and URL.",
      });
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const session = await createAudit.mutateAsync({
        data: {
          jiraUrl: values.jiraUrl,
          username: values.username,
          password: values.password,
          label: values.label,
        }
      });
      
      toast({
        title: "Audit Started",
        description: "Your migration readiness audit is now running.",
      });
      
      setLocation(`/audit/${session.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start audit session.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">New Audit Session</h1>
        <p className="text-muted-foreground mt-1">Connect to a Jira Server or Data Center instance to assess Cloud migration readiness.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instance Credentials</CardTitle>
          <CardDescription>
            Provide admin-level access to extract configuration, user data, and plugin details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="jiraUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jira Base URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://jira.yourcompany.com" {...field} data-testid="input-jira-url" />
                    </FormControl>
                    <FormDescription>The publicly accessible URL of your Jira instance.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Username</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" {...field} data-testid="input-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password / PAT</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormDescription>Personal Access Token recommended.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Label (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Pre-Prod Audit 2024" {...field} data-testid="input-label" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {testResult && (
                <Alert variant={testResult.success ? "default" : "destructive"} className={testResult.success ? "border-emerald-500/50 bg-emerald-500/5" : ""}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{testResult.success ? "Connection Verified" : "Connection Failed"}</AlertTitle>
                  <AlertDescription>
                    {testResult.message}
                    {testResult.success && testResult.version && (
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="bg-background">v{testResult.version}</Badge>
                        {testResult.type && <Badge variant="outline" className="bg-background capitalize">{testResult.type}</Badge>}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onTestConnection}
                  disabled={testConnection.isPending || createAudit.isPending}
                  data-testid="button-test-connection"
                >
                  {testConnection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Connection
                </Button>
                <Button 
                  type="submit"
                  disabled={createAudit.isPending || testConnection.isPending}
                  data-testid="button-start-audit"
                >
                  {createAudit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Server className="mr-2 h-4 w-4" />
                  Run Full Audit
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="mt-8">
        <Alert>
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <AlertTitle className="text-muted-foreground">Security Note</AlertTitle>
          <AlertDescription className="text-muted-foreground text-xs">
            Credentials are only used for the duration of the audit session to extract metadata. They are not stored persistently in our database. The audit process is read-only and will not modify your Jira instance.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}