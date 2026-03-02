import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Header from "@/components/Header";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Check if user is collaborator/admin only (no professional role)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const roleList = roles?.map((r) => r.role) ?? [];
      const isCollabOnly = !roleList.includes("professional") && (roleList.includes("colaborador") || roleList.includes("admin"));
      
      toast.success("Login realizado com sucesso!");
      navigate(isCollabOnly ? "/admin" : "/dashboard");
    } catch (err: any) {
      const msg = err.message || "";
      const translated =
        msg.includes("Invalid login credentials")
          ? "Email ou senha incorretos."
          : msg.includes("Email not confirmed")
          ? "Seu email ainda não foi confirmado. Verifique sua caixa de entrada."
          : msg.includes("Invalid Refresh Token")
          ? "Sessão expirada. Faça login novamente."
          : msg.includes("Too many requests")
          ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
          : "Erro ao fazer login.";
      toast.error(translated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-foreground text-center mb-2">
            Entrar na sua conta
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Acesse seu painel profissional
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Senha</label>
              <Input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-4">
            <Link to="/esqueci-senha" className="text-primary font-medium hover:underline">
              Esqueci minha senha
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
