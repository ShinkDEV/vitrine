import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, GraduationCap } from "lucide-react";

const COURSE_OPTIONS = [
  "O Segredo do Corte Perfeito",
  "Cabeleireiro Experience",
  "Master in Hair",
  "Mão na Massa",
  "Expert em Bob Cut",
];

interface Props {
  professionalId?: string;
}

const CourseCertificatesSection = ({ professionalId }: Props) => {
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState("");
  const [courseYear, setCourseYear] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: courses } = useQuery({
    queryKey: ["my-courses", professionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_courses")
        .select("*")
        .eq("professional_id", professionalId!)
        .order("course_name", { ascending: true })
        .order("course_year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!professionalId,
  });

  const handleAdd = async () => {
    if (!selectedCourse || !courseYear || !professionalId) {
      toast.error("Selecione o curso e informe o ano.");
      return;
    }

    const year = parseInt(courseYear);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 2000 || year > currentYear) {
      toast.error(`Ano inválido. Informe entre 2000 e ${currentYear}.`);
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from("professional_courses").insert({
        professional_id: professionalId,
        course_name: selectedCourse,
        course_year: year,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Este curso já foi adicionado para esse ano.");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Curso adicionado!");
      setSelectedCourse("");
      setCourseYear("");
      queryClient.invalidateQueries({ queryKey: ["my-courses", professionalId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar curso.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("professional_courses").delete().eq("id", id);
      if (error) throw error;
      toast.success("Curso removido.");
      queryClient.invalidateQueries({ queryKey: ["my-courses", professionalId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover.");
    }
  };

  return (
    <div>
      <h3 className="text-base font-display font-semibold text-foreground mb-1">
        Cursos Realizados ({courses?.length ?? 0})
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Selecione os cursos que você realizou e informe o ano de conclusão.
      </p>

      {courses && courses.length > 0 && (
        <div className="space-y-2 mb-3">
          {courses.map((course) => (
            <div key={course.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <GraduationCap className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="flex-1 text-sm text-foreground">{course.course_name}</span>
              <span className="text-xs text-muted-foreground font-medium">{course.course_year}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(course.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecione o curso" />
          </SelectTrigger>
          <SelectContent>
            {COURSE_OPTIONS.map((course) => (
              <SelectItem key={course} value={course}>
                {course}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Ano"
          value={courseYear}
          onChange={(e) => setCourseYear(e.target.value)}
          className="w-full sm:w-24"
          min={2000}
          max={new Date().getFullYear()}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={adding || !selectedCourse || !courseYear}
          className="whitespace-nowrap"
        >
          <Plus className="h-4 w-4 mr-1" />
          {adding ? "Adicionando..." : "Adicionar"}
        </Button>
      </div>
    </div>
  );
};

export default CourseCertificatesSection;
