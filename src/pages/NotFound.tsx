import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center animate-fade-in">
        <div className="relative mb-8">
          <span className="text-[10rem] font-display font-bold leading-none bg-gradient-to-br from-primary/30 to-primary/10 bg-clip-text text-transparent select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="h-16 w-16 text-primary/40" />
          </div>
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground mb-3">
          Página não encontrada
        </h1>
        <p className="text-muted-foreground max-w-md mb-8">
          A página que você está procurando não existe ou foi movida. Verifique o endereço ou volte para a página inicial.
        </p>

        <Button variant="gradient" size="lg" asChild>
          <Link to="/">
            <Home className="h-5 w-5 mr-2" />
            Voltar ao início
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
