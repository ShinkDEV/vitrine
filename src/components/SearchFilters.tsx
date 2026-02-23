import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

interface SearchFiltersProps {
  onSearch: (filters: { country: string; state: string; city: string; query: string }) => void;
}

const SearchFilters = ({ onSearch }: SearchFiltersProps) => {
  const [country] = useState("Brasil");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ country, state, city, query });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="bg-card rounded-2xl shadow-card p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">País</label>
            <Input value={country} disabled className="bg-muted" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estado</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todos os estados</option>
              {BRAZILIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cidade</label>
            <Input
              placeholder="Digite a cidade"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Buscar por nome ou bairro</label>
          <Input
            placeholder="Nome do profissional ou bairro..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Button type="submit" variant="gradient" className="w-full" size="lg">
          <Search className="h-4 w-4 mr-2" />
          Buscar profissionais
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Resultados atualizados automaticamente conforme sua busca.
        </p>
      </div>
    </form>
  );
};

export default SearchFilters;
