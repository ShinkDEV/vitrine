import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { MapPin, MessageCircle, Clock, DollarSign, CreditCard, X } from "lucide-react";
import { useState } from "react";

const ProfessionalProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { data: professional, isLoading } = useQuery({
    queryKey: ["professional", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*, services(*), portfolio_photos(*)")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: seals } = useQuery({
    queryKey: ["professional-seals", professional?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_seals")
        .select("*, seal:seals(*)")
        .eq("professional_id", professional!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!professional?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-card rounded-2xl h-64 animate-pulse shadow-card" />
            <div className="bg-card rounded-2xl h-40 animate-pulse shadow-card" />
          </div>
        </div>
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">Profissional não encontrado</h1>
          <p className="text-muted-foreground">Este perfil não existe ou não está disponível.</p>
        </div>
      </div>
    );
  }

  const whatsappMessage = encodeURIComponent(
    "Olá, vi seu perfil na Vitrine dos Especialistas da Beleza e gostaria de agendar um horário."
  );
  const whatsappUrl = professional.whatsapp_number
    ? `https://wa.me/${professional.whatsapp_number.replace(/\D/g, "")}?text=${whatsappMessage}`
    : "#";

  // Dynamic SEO
  if (typeof document !== "undefined") {
    document.title = `${professional.name} — Cabeleireiro(a) em ${professional.city}/${professional.state} | Vitrine dos Especialistas da Beleza`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", `Conheça o trabalho de ${professional.name}, profissional formado(a) e especializado(a) em ${professional.city}. Veja serviços, portfólio e agende pelo WhatsApp.`);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Profile Header */}
        <div className="bg-card rounded-2xl shadow-card p-8 text-center animate-fade-in">
          <div className="w-32 h-32 rounded-full overflow-hidden mx-auto mb-4 border-4 border-primary/20">
            {professional.profile_photo_url ? (
              <img src={professional.profile_photo_url} alt={professional.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-4xl font-display">
                {professional.name.charAt(0)}
              </div>
            )}
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">{professional.name}</h1>
          <p className="text-muted-foreground flex items-center justify-center gap-1 mb-1">
            <MapPin className="h-4 w-4" />
            {professional.city} / {professional.state}
          </p>
          {(professional.address_street || professional.address_neighborhood) && (
            <p className="text-sm text-muted-foreground">
              {[professional.address_street, professional.address_number, professional.address_neighborhood]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          <Button variant="whatsapp" size="lg" className="mt-6 w-full sm:w-auto" asChild>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5 mr-2" />
              Agendar no WhatsApp
            </a>
          </Button>
        </div>

        {/* Certification Badge */}
        <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-start gap-3">
            <span className="text-3xl">🎓</span>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Especialista Formado pela Escola Rô Siqueira
              </h2>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-primary">✔</span> Formado(a) oficialmente
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-primary">✔</span> Método validado
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-primary">✔</span> Profissional recomendado
                </p>
              </div>
            </div>
          </div>

          {/* Seals */}
          {seals && seals.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">Selos</p>
              <div className="flex flex-wrap gap-2">
                {seals.map((ps: any) => (
                  <span
                    key={ps.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium"
                  >
                    <span>{ps.seal?.icon}</span>
                    {ps.seal?.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* About */}
        {professional.bio && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-lg font-display font-semibold text-foreground mb-3">Sobre o profissional</h2>
            <p className="text-muted-foreground leading-relaxed">{professional.bio}</p>
          </div>
        )}

        {/* Services */}
        {professional.services && professional.services.length > 0 && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">Serviços oferecidos</h2>
            <div className="space-y-3">
              {professional.services
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((service) => (
                  <div key={service.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="font-medium text-foreground">{service.title}</span>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {service.price && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          R$ {Number(service.price).toFixed(2)}
                        </span>
                      )}
                      {service.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {service.duration_minutes} min
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Payment Methods */}
        {professional.payment_methods && professional.payment_methods.length > 0 && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">Formas de pagamento</h2>
            <div className="flex flex-wrap gap-2">
              {professional.payment_methods.map((method) => (
                <span key={method} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                  <CreditCard className="h-3.5 w-3.5" />
                  {method}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {professional.portfolio_photos && professional.portfolio_photos.length > 0 && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">Portfólio</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {professional.portfolio_photos
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo.photo_url)}
                    className="aspect-square rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <img src={photo.photo_url} alt="Portfólio" className="w-full h-full object-cover" />
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-foreground/80 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <button className="absolute top-4 right-4 text-card p-2" onClick={() => setSelectedPhoto(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={selectedPhoto} alt="Portfólio" className="max-w-full max-h-[90vh] rounded-xl object-contain" />
        </div>
      )}

      {/* Sticky WhatsApp - Mobile */}
      {professional.whatsapp_number && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/90 backdrop-blur-md border-t border-border md:hidden z-40">
          <Button variant="whatsapp" size="lg" className="w-full" asChild>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5 mr-2" />
              Agendar no WhatsApp
            </a>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfessionalProfile;
