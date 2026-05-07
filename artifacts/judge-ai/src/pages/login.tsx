import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { Scale, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["UPLOADER", "REVIEWER", "VIEWER"]),
  department: z.string().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { setToken } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "VIEWER" },
  });

  function handleLoginSuccess(token: string, role: string) {
    setToken(token);
    if (role === "UPLOADER") setLocation("/upload");
    else if (role === "REVIEWER") setLocation("/verify");
    else setLocation("/dashboard");
  }

  function onLogin(values: LoginValues) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => handleLoginSuccess(data.token, data.user.role),
        onError: () => toast({ title: "Login failed", description: "Invalid email or password", variant: "destructive" }),
      }
    );
  }

  function onRegister(values: RegisterValues) {
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({ title: "Account created successfully" });
          handleLoginSuccess(data.token, data.user.role);
        },
        onError: () => toast({ title: "Registration failed", description: "Email may already be in use", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3c6e] via-[#1e4a82] to-[#0f2547] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
            <Scale className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ActionBenchAI</h1>
          <p className="text-blue-200 mt-1 text-sm">Court Judgment Intelligence System</p>
          <p className="text-blue-300 text-xs mt-1">Centre for e-Governance</p>
        </div>

        <Card className="shadow-2xl border-0 bg-white">
          <CardHeader className="pb-0 pt-6">
            <div className="flex border-b">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  mode === "login" ? "border-[#1a3c6e] text-[#1a3c6e]" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
                data-testid="tab-login"
              >
                Sign In
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  mode === "register" ? "border-[#1a3c6e] text-[#1a3c6e]" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
                data-testid="tab-register"
              >
                Register
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {mode === "login" ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" {...loginForm.register("email")} data-testid="input-email" className="mt-1" />
                  {loginForm.formState.errors.email && <p className="text-xs text-red-500 mt-1">{loginForm.formState.errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" {...loginForm.register("password")} data-testid="input-password" className="mt-1" />
                  {loginForm.formState.errors.password && <p className="text-xs text-red-500 mt-1">{loginForm.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full bg-[#1a3c6e] hover:bg-[#15305a]" disabled={loginMutation.isPending} data-testid="button-login">
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div>
                  <Label htmlFor="r-name">Full Name</Label>
                  <Input id="r-name" {...registerForm.register("name")} data-testid="input-name" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="r-email">Email Address</Label>
                  <Input id="r-email" type="email" {...registerForm.register("email")} data-testid="input-register-email" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="r-password">Password</Label>
                  <Input id="r-password" type="password" {...registerForm.register("password")} data-testid="input-register-password" className="mt-1" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select onValueChange={(v) => registerForm.setValue("role", v as "UPLOADER" | "REVIEWER" | "VIEWER")} defaultValue="VIEWER">
                    <SelectTrigger className="mt-1" data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPLOADER">Uploader</SelectItem>
                      <SelectItem value="REVIEWER">Reviewer</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="r-dept">Department (optional)</Label>
                  <Input id="r-dept" {...registerForm.register("department")} data-testid="input-department" className="mt-1" />
                </div>
                <Button type="submit" className="w-full bg-[#1a3c6e] hover:bg-[#15305a]" disabled={registerMutation.isPending} data-testid="button-register">
                  {registerMutation.isPending ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 mt-6 text-blue-200 text-xs">
          <Shield className="h-3 w-3" />
          <span>Secure Government Portal — Authorized Users Only</span>
        </div>
      </div>
    </div>
  );
}
