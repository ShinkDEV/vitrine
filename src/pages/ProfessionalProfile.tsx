import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, CreditCard, X, Copy, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

const getPaymentIcon = (method: string): string => {
  const lower = method.toLowerCase();
  if (lower.includes("pix")) return "🟢";
  if (lower.includes("crédito") || lower.includes("credito")) return "💳";
  if (lower.includes("débito") || lower.includes("debito")) return "💳";
  if (lower.includes("dinheiro")) return "💵";
  if (lower.includes("transferência") || lower.includes("transferencia") || lower.includes("ted") || lower.includes("doc")) return "🏦";
  if (lower.includes("boleto")) return "🧾";
  return "💰";
};

const ProfessionalProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

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

  const { data: workingHours } = useQuery({
    queryKey: ["professional-hours", professional?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("working_hours")
        .select("*")
        .eq("professional_id", professional!.id)
        .order("day_of_week");
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
    "Olá! Vim da Vitrine Rô Siqueira e gostaria de fazer um agendamento!"
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
    <div className="min-h-screen bg-background pb-32">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Profile status banner */}
        {professional.status !== "publicado" && (
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 animate-fade-in">
            <span className="text-lg">👁️</span>
            Pré-visualização — Este perfil ainda não está publicado.
          </div>
        )}
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
            <button
              onClick={() => {
                const addr = [professional.address_street, professional.address_number, professional.address_neighborhood, professional.city, professional.state].filter(Boolean).join(", ");
                navigator.clipboard.writeText(addr);
                toast.success("Endereço copiado!");
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 mt-0.5"
            >
              {[professional.address_street, professional.address_number, professional.address_neighborhood]
                .filter(Boolean)
                .join(", ")}
              <Copy className="h-3 w-3 ml-1" />
            </button>
          )}
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
              <p className="text-sm font-medium text-foreground mb-2">Formações</p>
              <div className="grid grid-cols-3 gap-3 justify-items-center">
                {seals.map((ps: any) => (
                  <div key={ps.id} className="flex flex-col items-center gap-1 min-w-0">
                    {ps.seal?.image_url ? (
                      <img src={ps.seal.image_url} alt={ps.seal?.name} className="w-14 h-14 object-contain" />
                    ) : (
                      <span className="text-3xl">{ps.seal?.icon}</span>
                    )}
                    <span className="text-xs text-muted-foreground font-medium text-center leading-tight">{ps.seal?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* About */}
        {professional.bio && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-lg font-display font-semibold text-foreground mb-3">Sobre o profissional</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{professional.bio}</p>
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
                      {service.price != null && service.price > 0 ? (
                        <span className="flex items-center gap-1">
                          R$ {Number(service.price).toFixed(2)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 italic">
                          Sob Consulta
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

        {/* Working Hours */}
        {workingHours && workingHours.length > 0 && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
            <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horários de atendimento
            </h2>
            <div className="space-y-2">
              {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((dayName, i) => {
                const found = workingHours.find((h) => h.day_of_week === i);
                return (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                    <span className="text-foreground font-medium">{dayName}</span>
                    {found ? (
                      <span className="text-muted-foreground">
                        {found.open_time.slice(0, 5)} — {found.close_time.slice(0, 5)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Payment Methods */}
        {professional.payment_methods && professional.payment_methods.length > 0 && (
          <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Formas de pagamento
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {professional.payment_methods.map((method) => {
                const icon = getPaymentIcon(method);
                return (
                  <div key={method} className="flex items-center gap-3 p-3 rounded-xl bg-accent/50 border border-border/50">
                    <span className="text-xl">{icon}</span>
                    <span className="text-sm font-medium text-foreground">{method}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {professional.portfolio_photos && professional.portfolio_photos.length > 0 && (() => {
          const sortedPhotos = [...professional.portfolio_photos].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
          const current = sortedPhotos[carouselIndex];
          return (
            <div className="bg-card rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <h2 className="text-lg font-display font-semibold text-foreground mb-4">Portfólio</h2>
              <div
                className="relative"
                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null) return;
                  const diff = touchStartX.current - e.changedTouches[0].clientX;
                  if (Math.abs(diff) > 50) {
                    if (diff > 0) setCarouselIndex((carouselIndex + 1) % sortedPhotos.length);
                    else setCarouselIndex((carouselIndex - 1 + sortedPhotos.length) % sortedPhotos.length);
                  }
                  touchStartX.current = null;
                }}
              >
                >
                  <img src={current.photo_url} alt={current.title || "Portfólio"} className="w-full h-full object-cover" />
                </button>
                {sortedPhotos.length > 1 && (
                  <>
                    <button
                      onClick={() => setCarouselIndex((carouselIndex - 1 + sortedPhotos.length) % sortedPhotos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur-sm rounded-full p-1.5 shadow-md hover:bg-card transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <button
                      onClick={() => setCarouselIndex((carouselIndex + 1) % sortedPhotos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur-sm rounded-full p-1.5 shadow-md hover:bg-card transition-colors"
                    >
                      <ChevronRight className="h-5 w-5 text-foreground" />
                    </button>
                  </>
                )}
              </div>
              {current.title && (
                <p className="text-sm text-foreground font-medium mt-3 text-center">{current.title}</p>
              )}
              {sortedPhotos.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {sortedPhotos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCarouselIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === carouselIndex ? "bg-primary" : "bg-border"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Member since */}
        <div className="text-center text-xs text-muted-foreground py-2 animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
          Membro desde {new Date(professional.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
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

      {/* Sticky WhatsApp - All devices */}
      {professional.whatsapp_number && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/90 backdrop-blur-md border-t border-border z-40">
          <div className="max-w-2xl mx-auto">
            <Button variant="whatsapp" size="lg" className="w-full" asChild>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Agendar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalProfile;
