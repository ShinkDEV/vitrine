import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Header from "@/components/Header";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu email.");
      return;
    }
    setLoading(true);
    try {
      await supabase.functions.invoke("send-password-reset", {
        body: { email, redirectUrl: `${window.location.origin}/redefinir-senha` },
      });
      setSent(true);
      toast.success("Se o email estiver cadastrado, você receberá as instruções.");
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
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
            Esqueceu sua senha?
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Informe seu email e enviaremos um link para redefinir sua senha.
          </p>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
                ✅ Email enviado! Verifique sua caixa de entrada e spam.
              </div>
              <Button variant="outline" asChild>
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Voltar ao login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
