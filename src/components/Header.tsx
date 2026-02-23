import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, LogOut, LayoutDashboard, Shield } from "lucide-react";
import logo from "@/assets/logo.png";

const Header = () => {
  const { user, signOut } = useAuth();

  const { data: hasAdminAccess } = useQuery({
    queryKey: ["header-admin-access", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .in("role", ["admin", "colaborador"]);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Vitrine Especialistas da Beleza" className="h-10 w-auto" />
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              {hasAdminAccess && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin">
                    <Shield className="h-4 w-4 mr-1" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-1" />
                  Painel
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Entrar</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
