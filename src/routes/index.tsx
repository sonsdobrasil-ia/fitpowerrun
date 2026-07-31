import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CoverImage } from "@/components/CoverImage";
import { ChevronRight, Zap, Timer, Trophy, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "FitPower — eBooks de corrida e treino para iniciantes" },
      {
        name: "description",
        content:
          "Estante FitPower: eBooks de corrida, treino e nutrição para sair do sofá e cruzar os 5km em 30 dias.",
      },
      { property: "og:title", content: "FitPower — eBooks de corrida e treino" },
      {
        property: "og:description",
        content: "Conheça a estante de eBooks FitPower e comece a correr em 30 dias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

export type ShelfBook = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  categoria: string | null;
  paginas: number | null;
  preco: number | null;
  capa_url: string | null;
};

export function formatPreco(preco: number | null) {
  if (preco == null || preco <= 0) return "Grátis";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Index() {
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ebooks")
        .select("id, titulo, subtitulo, descricao, categoria, paginas, preco, capa_url, pdf_url")
        .eq("publicado", true)
        .order("created_at", { ascending: false });
      setBooks(((data as any[]) ?? []).filter((b) => b.pdf_url) as ShelfBook[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="bg-background">
      <main className="px-5 py-10 max-w-5xl mx-auto w-full">
        <section>
          <h1 className="text-4xl font-bold leading-tight max-w-xl">
            Do <span className="text-primary">sofá aos 5km</span> em 30 dias.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl">
            O método FitPower leva você do zero à linha de chegada, com 3 treinos por semana e um
            plano que respeita o seu corpo.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-3xl">
            <Feature icon={Timer} title="Timer guiado" desc="Alterna correr e caminhar com aviso sonoro." />
            <Feature icon={Zap} title="Plano de 4 semanas" desc="12 treinos progressivos e sem desistência." />
            <Feature icon={Trophy} title="Certificado 5km" desc="Conquiste e exporte sua jornada em PDF." />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold px-6 py-3.5 shadow-glow active:scale-[0.98] transition"
            >
              Começar agora <ChevronRight className="size-5" />
            </Link>
            <a
              href="#estante"
              className="inline-flex items-center rounded-2xl border-2 border-border font-semibold px-6 py-3.5"
            >
              Ver a estante
            </a>
          </div>
        </section>

        <section id="estante" className="mt-16">
          <div className="flex items-center gap-3">
            <BookOpen className="size-6 text-primary" />
            <h2 className="text-2xl font-bold">Estante de eBooks</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Guias práticos para correr, treinar e comer melhor.
          </p>

          {loading ? (
            <p className="mt-8 text-sm text-muted-foreground">Carregando...</p>
          ) : books.length === 0 ? (
            <div className="mt-6 rounded-2xl border bg-card p-6 text-center shadow-soft">
              <p className="font-semibold">Nenhum eBook disponível ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Novos títulos aparecerão aqui em breve.
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/ebooks/$id"
                    params={{ id: b.id }}
                    className="group block rounded-2xl border bg-card p-4 shadow-soft h-full transition hover:shadow-glow"
                  >
                    <CoverImage
                      value={b.capa_url}
                      alt={`Capa do eBook ${b.titulo}`}
                      className="w-full aspect-[3/4] rounded-xl object-cover bg-muted"
                      fallback={<div className="w-full aspect-[3/4] rounded-xl bg-muted" />}
                    />
                    <p className="mt-3 font-bold leading-snug">{b.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {b.categoria} · {b.paginas ?? 0} páginas
                    </p>
                    <p className="mt-2 font-display font-bold text-primary">
                      {formatPreco(b.preco)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 items-start rounded-2xl border bg-card p-4 shadow-soft">
      <div className="size-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="font-bold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
