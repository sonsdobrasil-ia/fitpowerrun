import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CAPITULOS } from "@/lib/ebook";
import { supabase } from "@/integrations/supabase/client";
import { CoverImage } from "@/components/CoverImage";
import jsPDF from "jspdf";
import { ChevronDown, Download, BookOpen, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ebook/")({
  component: Ebook,
});

type Biblioteca = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  paginas: number | null;
  capa_url: string | null;
  percentual: number;
};

function Ebook() {
  const [open, setOpen] = useState<string | null>(null);
  const [lidos, setLidos] = useState<Set<string>>(new Set());
  const [biblioteca, setBiblioteca] = useState<Biblioteca[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("ebook_progress").select("capitulo").eq("user_id", u.user.id).eq("lido", true);
      setLidos(new Set((data ?? []).map((r) => r.capitulo)));

      const [{ data: books }, { data: progresso }] = await Promise.all([
        supabase
          .from("ebooks")
          .select("id, titulo, descricao, categoria, paginas, capa_url, pdf_url")
          .eq("publicado", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("ebook_reading_progress")
          .select("ebook_id, percentual")
          .eq("user_id", u.user.id),
      ]);
      const map = new Map(
        ((progresso as any[]) ?? []).map((p) => [p.ebook_id, Number(p.percentual ?? 0)]),
      );
      setBiblioteca(
        ((books as any[]) ?? [])
          .filter((b) => b.pdf_url)
          .map((b) => ({ ...b, percentual: map.get(b.id) ?? 0 })),
      );
    })();
  }, []);


  async function marcarLido(capId: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const novoSet = new Set(lidos);
    novoSet.add(capId);
    setLidos(novoSet);
    await supabase.from("ebook_progress").upsert(
      { user_id: u.user.id, capitulo: capId, lido: true },
      { onConflict: "user_id,capitulo" },
    );
  }

  function exportarPDF() {
    const doc = new jsPDF();
    doc.setFillColor(255, 107, 53);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(22); doc.text("FitPower", 14, 20);
    doc.setFontSize(12); doc.text("Do Sofá aos 5km", 14, 27);
    doc.setTextColor(43,43,43);
    let y = 45;
    CAPITULOS.forEach((cap, idx) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(cap.titulo, 14, y, { maxWidth: 180 });
      y += 8;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(cap.conteudo, 180);
      lines.forEach((line: string) => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, 14, y);
        y += 5;
      });
      y += 6;
      if (idx < CAPITULOS.length - 1) y += 4;
    });
    doc.save("ebook-fitpower.pdf");
    toast.success("eBook baixado!");
  }

  const progresso = (lidos.size / CAPITULOS.length) * 100;

  return (
    <div className="px-5 pt-8 pb-4 max-w-xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">eBook</h1>
          <p className="text-muted-foreground mt-1">Do Sofá aos 5km</p>
        </div>
        <BookOpen className="size-8 text-primary mt-1" />
      </header>

      <div className="mt-5 rounded-2xl bg-card border p-4 shadow-soft">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">Progresso de leitura</span>
          <span className="text-muted-foreground">{lidos.size}/{CAPITULOS.length}</span>
        </div>
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-energy" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      <button onClick={exportarPDF} className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-accent text-accent-foreground font-bold py-3.5 shadow-soft">
        <Download className="size-4" /> Baixar eBook em PDF
      </button>

      <ul className="mt-5 space-y-3 mb-6">
        {CAPITULOS.map((cap) => {
          const isOpen = open === cap.id;
          const isLido = lidos.has(cap.id);
          return (
            <li key={cap.id} className="rounded-2xl bg-card border shadow-soft overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : cap.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isLido && <div className="size-6 rounded-full bg-success text-success-foreground flex items-center justify-center shrink-0"><Check className="size-3.5" /></div>}
                  <span className="font-semibold">{cap.titulo}</span>
                </div>
                <ChevronDown className={`size-5 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t">
                  <div className="prose prose-sm max-w-none whitespace-pre-line leading-relaxed text-[15px]">
                    {cap.conteudo}
                  </div>
                  {!isLido && (
                    <button onClick={() => marcarLido(cap.id)} className="mt-4 rounded-xl bg-secondary text-secondary-foreground px-4 py-2 font-semibold text-sm">
                      Marcar como lido
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
