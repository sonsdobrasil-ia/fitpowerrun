import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, ShieldCheck } from "lucide-react";
import { BENEFICIOS } from "@/lib/plans";
import { usePlans, formatBRL, periodoLabel } from "@/lib/use-plans";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/planos")({
  ssr: false,
  component: PlanosPage,
  head: () => ({
    meta: [
      { title: "Planos FitPower — acesso completo por R$ 9,90/mês" },
      {
        name: "description",
        content:
          "Assine o FitPower e libere todos os eBooks, o plano de 4 semanas, o timer guiado e o certificado de 5km. Mensal R$ 9,90 ou anual R$ 99,00.",
      },
      { property: "og:title", content: "Planos FitPower — tudo liberado por assinatura" },
      {
        property: "og:description",
        content: "Biblioteca completa de eBooks, treinos e progresso por R$ 9,90 por mês.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PlanosPage() {
  const { user } = useAuth();

  function assinar() {
    toast.info("Pagamentos ainda não estão ativos", {
      description: "Ative a integração de pagamentos para liberar o checkout da assinatura.",
    });
  }

  return (
    <div className="px-5 py-10 max-w-4xl mx-auto">
      <header className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-semibold px-3 py-1">
          <Sparkles className="size-3" /> Um plano, tudo liberado
        </span>
        <h1 className="text-4xl font-bold mt-4 leading-tight">
          Assine o <span className="text-primary">FitPower</span>
        </h1>
        <p className="mt-3 text-muted-foreground text-lg max-w-xl mx-auto">
          Os eBooks não são vendidos separadamente. Com a assinatura você lê toda a biblioteca e usa
          o método completo de corrida.
        </p>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PLANOS.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border bg-card p-6 shadow-soft ${
              p.destaque ? "border-primary shadow-glow" : ""
            }`}
          >
            {p.destaque && (
              <span className="inline-flex rounded-full bg-primary text-primary-foreground text-xs font-bold px-3 py-1">
                Melhor valor
              </span>
            )}
            <h2 className="text-xl font-bold mt-3">{p.nome}</h2>
            <p className="mt-2">
              <span className="text-4xl font-display font-bold text-primary">{p.precoLabel}</span>
              <span className="text-muted-foreground">{p.periodo}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">{p.detalhe}</p>

            {user ? (
              <button
                onClick={assinar}
                className="mt-6 w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3.5 active:scale-[0.98] transition"
              >
                Assinar {p.nome.toLowerCase()}
              </button>
            ) : (
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="mt-6 block text-center w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3.5 active:scale-[0.98] transition"
              >
                Criar conta e assinar
              </Link>
            )}
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">O que está incluído</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {BENEFICIOS.map((b) => (
            <li key={b} className="flex gap-2 text-sm rounded-2xl border bg-card p-4 shadow-soft">
              <Check className="size-4 text-secondary mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-secondary" /> Cancele quando quiser, sem burocracia.
      </p>
    </div>
  );
}
