import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Header from "@/components/Header";

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validatingInvite, setValidatingInvite] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);

  useEffect(() => {
    const validateInvite = async () => {
      if (!inviteCode) {
        setValidatingInvite(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("invites")
          .select("id, expires_at, use_count, max_uses")
          .eq("code", inviteCode)
          .maybeSingle();

        if (error || !data || (data.expires_at && new Date(data.expires_at) < new Date()) || (data.max_uses && data.use_count >= data.max_uses)) {
          setInviteValid(false);
        } else {
          setInviteValid(true);
          setInviteId(data.id);
        }
      } catch {
        setInviteValid(false);
      }
      setValidatingInvite(false);
    };
    validateInvite();
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode || !inviteValid) {
      toast.error("Convite inválido.");
      return;
    }
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
        options: {
          emailRedirectTo: window.location.origin,
          data: { name },
        },
      });
      if (error) throw error;

      // Increment invite use count
      if (inviteId) {
        const { data: currentInvite } = await supabase
          .from("invites")
          .select("use_count")
          .eq("id", inviteId)
          .single();
        if (currentInvite) {
          await supabase
            .from("invites")
            .update({ use_count: currentInvite.use_count + 1 })
            .eq("id", inviteId);
        }
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

  if (validatingInvite) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 max-w-md text-center">
          <p className="text-muted-foreground">Validando convite...</p>
        </div>
      </div>
    );
  }

  if (!inviteCode || !inviteValid) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 max-w-md">
          <div className="bg-card rounded-2xl shadow-card p-8 text-center animate-fade-in">
            <span className="text-4xl mb-4 block">🔒</span>
            <h1 className="text-xl font-display font-bold text-foreground mb-2">
              Cadastro por convite
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              {!inviteCode
                ? "Para se cadastrar, você precisa de um link de convite. Solicite ao administrador."
                : "Este convite é inválido, já foi utilizado ou expirou."}
            </p>
            <Button variant="outline" asChild>
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-2.5 text-sm mb-6 flex items-center gap-2">
            <span>✅</span> Convite válido
          </div>

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
