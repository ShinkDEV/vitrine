import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, GraduationCap, Upload, FileText, ExternalLink } from "lucide-react";

const COURSE_OPTIONS = [
  "O Segredo do Corte Perfeito",
  "Cabeleireiro Experience",
  "Master in Hair",
  "Mão na Massa",
  "Expert em Bob Cut",
];

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface Props {
  professionalId?: string;
}

const CourseCertificatesSection = ({ professionalId }: Props) => {
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState("");
  const [courseYear, setCourseYear] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato não aceito. Use JPG, PNG ou PDF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleAdd = async () => {
    if (!selectedCourse || !courseYear || !professionalId || !selectedFile) {
      toast.error("Selecione o curso, informe o ano e envie o certificado.");
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
      // Upload file to S3
      const { uploadToStorage } = await import("@/lib/uploadToStorage");
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = selectedCourse.replace(/\s+/g, "-").toLowerCase();
      const path = `courses/${professionalId}/${safeName}-${year}-${Date.now()}.${ext}`;
      const fileUrl = await uploadToStorage(selectedFile, path);

      const { error } = await supabase.from("professional_courses").insert({
        professional_id: professionalId,
        course_name: selectedCourse,
        course_year: year,
        certificate_url: fileUrl,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Este curso já foi adicionado para esse ano.");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Curso adicionado com certificado!");
      setSelectedCourse("");
      setCourseYear("");
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["my-courses", professionalId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar curso.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, certificateUrl?: string) => {
    try {
      if (certificateUrl) {
        const { deleteFromStorage } = await import("@/lib/deleteFromStorage");
        await deleteFromStorage(certificateUrl);
      }
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
        Cursos Realizados ({courses?.length ?? 0}) *
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Selecione os cursos que você realizou, informe o ano e envie o certificado (JPG, PNG ou PDF, máx. 5MB).
      </p>

      {courses && courses.length > 0 && (
        <div className="space-y-2 mb-3">
          {courses.map((course) => (
            <div key={course.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <GraduationCap className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="flex-1 text-sm text-foreground">{course.course_name}</span>
              <span className="text-xs text-muted-foreground font-medium">{course.course_year}</span>
              {course.certificate_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(course.certificate_url, "_blank")}
                  title="Ver certificado"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(course.id, course.certificate_url)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
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
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className="flex-1">
            <Button type="button" variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                {selectedFile ? selectedFile.name : "Enviar certificado"}
              </span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>

          {selectedFile && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {(selectedFile.size / 1024).toFixed(0)}KB
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={adding || !selectedCourse || !courseYear || !selectedFile}
            className="whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-1" />
            {adding ? "Enviando..." : "Adicionar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CourseCertificatesSection;
