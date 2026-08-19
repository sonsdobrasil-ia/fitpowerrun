import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getEbookPdfAccess } from "@/lib/ebook-pdf.functions";
import { loadPdf, renderPageToCanvas } from "@/lib/pdf";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Paywall, useHasAccess } from "@/components/SubscriptionGate";
import { previewPages } from "@/lib/plans";



export const Route = createFileRoute("/_authenticated/ebook/$id")({
  component: Reader,
});

type EbookRow = {
  id: string;
  titulo: string;
  pdf_url: string | null;
  paginas: number | null;
};

function Reader() {
  const { id } = Route.useParams();
  const { hasAccess, loading: loadingAccess } = useHasAccess();
  const [ebook, setEbook] = useState<EbookRow | null>(null);

  const [pdf, setPdf] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [maxPage, setMaxPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [flip, setFlip] = useState<{ dir: "next" | "prev"; img: string } | null>(null);
  const images = useRef<Map<number, string>>(new Map());
  const [current, setCurrent] = useState<string | null>(null);
  const userId = useRef<string | null>(null);
  const fetchPdfAccess = useServerFn(getEbookPdfAccess);


  // Load ebook + pdf + saved progress
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      userId.current = u.user?.id ?? null;
      const { data, error } = await supabase
        .from("ebooks")
        .select("id, titulo, pdf_url, paginas")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        if (alive) setLoading(false);
        return toast.error("eBook não encontrado");
      }
      if (!alive) return;
      setEbook(data as any);
      const url = await resolvePdfUrl((data as any).pdf_url);
      if (!url) {
        if (alive) setLoading(false);
        return toast.error("PDF indisponível");
      }
      const doc = await loadPdf(url);
      if (!alive) return;
      setPdf(doc);
      setTotal(doc.numPages);
      if (userId.current) {
        const { data: prog } = await supabase
          .from("ebook_reading_progress")
          .select("pagina_atual")
          .eq("user_id", userId.current)
          .eq("ebook_id", id)
          .maybeSingle();
        const p = Math.min(Math.max((prog as any)?.pagina_atual ?? 1, 1), doc.numPages);
        if (alive) {
          setPage(p);
          setMaxPage(p);
        }
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const renderPage = useCallback(
    async (n: number): Promise<string | null> => {
      if (!pdf || n < 1 || n > pdf.numPages) return null;
      const cached = images.current.get(n);
      if (cached) return cached;
      const canvas = document.createElement("canvas");
      await renderPageToCanvas(pdf, n, canvas, 900);
      const data = canvas.toDataURL("image/jpeg", 0.85);
      images.current.set(n, data);
      return data;
    },
    [pdf],
  );

  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    renderPage(page).then((img) => alive && img && setCurrent(img));
    renderPage(page + 1);
    renderPage(page - 1);
    return () => {
      alive = false;
    };
  }, [pdf, page, renderPage]);

  // Persist progress
  useEffect(() => {
    if (!pdf || !userId.current || !ebook) return;
    const t = setTimeout(() => {
      const percentual = Math.round((maxPage / total) * 100);
      supabase
        .from("ebook_reading_progress")
        .upsert(
          {
            user_id: userId.current!,
            ebook_id: ebook.id,
            pagina_atual: page,
            total_paginas: total,
            percentual,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id,ebook_id" },
        )
        .then(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [page, maxPage, total, pdf, ebook]);

  const limitePreview = previewPages(total);
  const limite = hasAccess ? total : Math.min(limitePreview, total || limitePreview);
  const bloqueado = !loadingAccess && !hasAccess && total > 0 && page >= limite;

  // Não deixa a prévia abrir além do limite (progresso salvo anterior)
  useEffect(() => {
    if (loadingAccess || hasAccess || !total) return;
    setPage((p) => (p > limite ? limite : p));
  }, [loadingAccess, hasAccess, total, limite]);


  const go = async (dir: "next" | "prev") => {
    if (flip) return;
    const target = dir === "next" ? page + 1 : page - 1;
    if (target < 1 || target > limite) return;
    const from = current ?? (await renderPage(page));
    if (from) setFlip({ dir, img: dir === "next" ? from : (await renderPage(target)) || from });
    setPage(target);
    setMaxPage((m) => Math.max(m, target));
    setTimeout(() => setFlip(null), 600);
  };

  // Swipe
  const touchX = useRef(0);
  const percent = total ? Math.round((maxPage / total) * 100) : 0;


  return (
    <div className="px-4 pt-6 pb-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/ebook" className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-bold text-lg truncate flex-1">{ebook?.titulo ?? "Leitura"}</h1>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            Página {page} de {total || "—"}
          </span>
          <span>{percent}% lido</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-energy transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div
        className="mt-4 relative select-none"
        style={{ perspective: "1600px" }}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? "next" : "prev");
        }}
      >
        <div className="rounded-2xl overflow-hidden border bg-card shadow-soft min-h-[50vh] grid place-items-center">
          {loading || !current ? (
            <Loader2 className="size-8 animate-spin text-primary my-24" />
          ) : (
            <img src={current} alt={`Página ${page}`} className="w-full block" />
          )}
        </div>
        {flip && (
          <img
            src={flip.img}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full rounded-2xl border bg-card origin-left"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              animation: `${flip.dir === "next" ? "page-flip-next" : "page-flip-prev"} 600ms ease-in-out forwards`,
            }}
          />
        )}
      </div>

      {!loadingAccess && !hasAccess && total > 0 && (
        <div className="mt-4">
          {bloqueado ? (
            <Paywall
              titulo="Fim da prévia gratuita"
              descricao={`Você leu as ${limite} páginas liberadas. Assine o FitPower para continuar a leitura completa e liberar toda a biblioteca.`}
            />
          ) : (
            <p className="text-xs text-center text-muted-foreground">
              Prévia gratuita · {limite} de {total} páginas liberadas
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => go("prev")}
          disabled={page <= 1}
          className="flex-1 flex items-center justify-center gap-1 rounded-2xl border font-semibold py-3 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" /> Anterior
        </button>
        <button
          onClick={() => go("next")}
          disabled={page >= limite}
          className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-primary text-primary-foreground font-bold py-3 disabled:opacity-40"
        >

          Próxima <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
