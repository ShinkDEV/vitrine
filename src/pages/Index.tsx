import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import SearchFilters from "@/components/SearchFilters";
import ProfessionalCard from "@/components/ProfessionalCard";
import Footer from "@/components/Footer";
import { Sparkles, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [filters, setFilters] = useState({ country: "", state: "", city: "", query: "" });

  const { data: professionals, isLoading } = useQuery({
    queryKey: ["professionals", filters],
    queryFn: async () => {
      let q = supabase
        .from("professionals")
        .select("*, services(*)")
        .eq("status", "publicado")
        .order("created_at", { ascending: false });

      if (filters.state) q = q.eq("state", filters.state);
      if (filters.city) q = q.ilike("city", `%${filters.city}%`);
      if (filters.query) {
        q = q.or(`name.ilike.%${filters.query}%,address_neighborhood.ilike.%${filters.query}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-background to-muted opacity-60" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Profissionais certificados
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4 max-w-3xl mx-auto leading-tight">
            Encontre um Especialista da Beleza na sua cidade
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-2">
            Profissionais formados e certificados, prontos para transformar seu visual com técnica, segurança e excelência.
          </p>
          <p className="text-sm text-muted-foreground mb-10">
            Use os filtros abaixo para encontrar o profissional ideal perto de você.
          </p>

          <SearchFilters onSearch={setFilters} />
        </div>
      </section>

      {/* Results */}
      <section className="container mx-auto px-4 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl h-72 animate-pulse shadow-card" />
            ))}
          </div>
        ) : professionals && professionals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {professionals.map((pro) => (
              <ProfessionalCard key={pro.id} professional={pro} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">
              Ainda não há especialistas cadastrados nesta cidade.
            </h2>
            <p className="text-muted-foreground mb-6">
              Estamos expandindo nossa rede. Em breve você poderá encontrar um profissional qualificado na sua região.
            </p>
            <Button variant="outline" onClick={() => setFilters({ country: "", state: "", city: "", query: "" })}>
              Voltar para busca
            </Button>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Vitrine dos Especialistas da Beleza. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default Index;
