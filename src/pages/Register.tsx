import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Header from "@/components/Header";

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;

      if (data.user) {
        // Create professional profile
        const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
        const { error: proError } = await supabase.from("professionals").insert({
          user_id: data.user.id,
          name,
          slug: slug + "-" + Date.now().toString(36),
          status: "rascunho",
        });
        if (proError) console.error("Error creating professional:", proError);

        // Assign role
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "professional" as const,
        });
      }

      // Send welcome email (fire and forget)
      supabase.functions.invoke("send-welcome-email", {
        body: { name, email },
      }).catch((err) => console.error("Welcome email error:", err));

      toast.success("Conta criada! Verifique seu email para confirmar.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta.");
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
            Faça parte da Vitrine dos Especialistas da Beleza
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Se você concluiu o curso, cadastre-se e seja encontrado por clientes da sua região.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Senha</label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={loading}>
              {loading ? "Criando conta..." : "Criar minha conta"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
