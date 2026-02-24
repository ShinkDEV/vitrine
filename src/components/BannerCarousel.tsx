import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface BannerCarouselProps {
  placement: "home" | "dashboard";
}

const BannerCarousel = ({ placement }: BannerCarouselProps) => {
  const { data: banners } = useQuery({
    queryKey: ["banners", placement],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("placement", placement)
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (!banners?.length) return null;

  return (
    <section className="container mx-auto px-4 lg:px-16 pb-8">
      <p className="text-xs text-muted-foreground mb-2">Anúncio Patrocinado</p>
      <div className="space-y-4">
        {banners.map((banner) => (
          <div key={banner.id} className="rounded-xl overflow-hidden shadow-card">
            {banner.link_url ? (
              <a href={banner.link_url} target="_blank" rel="noopener noreferrer">
                <AspectRatio ratio={4 / 1}>
                  <img
                    src={banner.image_url}
                    alt={banner.title || "Banner"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </AspectRatio>
              </a>
            ) : (
              <AspectRatio ratio={4 / 1}>
                <img
                  src={banner.image_url}
                  alt={banner.title || "Banner"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </AspectRatio>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default BannerCarousel;
