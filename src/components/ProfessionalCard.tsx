import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";

interface ProfessionalCardProps {
  professional: Tables<"professionals"> & {
    services?: Tables<"services">[];
  };
}

const ProfessionalCard = ({ professional }: ProfessionalCardProps) => {
  const topServices = professional.services?.slice(0, 3) ?? [];

  return (
    <div className="bg-card rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group animate-fade-in">
      <div className="p-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-[3px] border-primary/20 group-hover:border-primary/40 transition-colors">
          {professional.profile_photo_url ? (
            <img
              src={professional.profile_photo_url}
              alt={professional.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-display">
              {professional.name.charAt(0)}
            </div>
          )}
        </div>

        <h3 className="text-lg font-display font-semibold text-foreground mb-1">
          {professional.name}
        </h3>

        <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
          <MapPin className="h-3.5 w-3.5" />
          {professional.city}{professional.state ? ` / ${professional.state}` : ""}
        </p>

        {topServices.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {topServices.map((service) => (
              <span
                key={service.id}
                className="px-3 py-1 text-xs font-medium rounded-full bg-accent text-accent-foreground"
              >
                {service.title}
              </span>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={`/p/${professional.slug}`}>Ver perfil</Link>
        </Button>
      </div>
    </div>
  );
};

export default ProfessionalCard;
