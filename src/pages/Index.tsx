import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import SearchFilters from "@/components/SearchFilters";
import ProfessionalCard from "@/components/ProfessionalCard";

import { Sparkles, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import BannerCarousel from "@/components/BannerCarousel";
import Footer from "@/components/Footer";
import heroBg from "@/assets/hero-bg.webp";
import heroBgMobile from "@/assets/hero-bg-mobile.png";

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
      <section className="relative overflow-hidden">
        {/* === MOBILE: image on top, text below === */}
        <div className="block md:hidden">
          <div className="relative w-full aspect-square">
            <img
              src={heroBgMobile}
              alt="Especialistas da Beleza"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="px-4 py-8 text-center bg-background">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              Profissionais certificados
            </span>
            <h1 className="text-2xl font-display font-bold text-foreground mb-3 leading-tight">
              Encontre um Especialista da Beleza na sua cidade
            </h1>
            <p className="text-base text-muted-foreground mb-1">
              Profissionais formados e certificados, prontos para transformar seu visual.
            </p>
            <p className="text-sm text-muted-foreground">
              Use os filtros abaixo para encontrar o profissional ideal perto de você.
            </p>
          </div>
        </div>

        {/* === DESKTOP: image with overlay text === */}
        <div className="hidden md:block relative w-full" style={{ aspectRatio: '1920/800' }}>
          <img
            src={heroBg}
            alt="Especialistas da Beleza"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="container mx-auto px-4">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-white text-sm font-medium backdrop-blur-sm mb-6">
                  <Sparkles className="h-4 w-4" />
                  Profissionais certificados
                </span>
                <h1 className="text-5xl font-display font-bold text-white mb-4 leading-tight">
                  Encontre um Especialista da Beleza na sua cidade
                </h1>
                <p className="text-lg text-white/85 mb-2">
                  Profissionais formados e certificados, prontos para transformar seu visual com técnica, segurança e excelência.
                </p>
                <p className="text-sm text-white/70">
                  Use os filtros abaixo para encontrar o profissional ideal perto de você.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search filters below hero */}
        <div className="container mx-auto px-4 -mt-8 relative z-10">
          <SearchFilters onSearch={setFilters} />
        </div>
        <div className="h-8" />
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

      <BannerCarousel placement="home" />
      <Footer />
    </div>
  );
};

export default Index;
