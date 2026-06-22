import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { Logo } from "@/components/Logo";
import { ChevronRight, Zap, Timer, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-8"><Logo /></header>
      <main className="flex-1 flex flex-col px-6 py-10 max-w-xl mx-auto w-full">
        <div className="flex-1">
          <h1 className="text-4xl font-bold leading-tight mt-6">
            Do <span className="text-primary">sofá aos 5km</span><br />em 30 dias.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            O método FitPower leva você do zero à linha de chegada, com 3 treinos por semana e um plano que respeita o seu corpo.
          </p>

          <div className="mt-10 space-y-4">
            <Feature icon={Timer} title="Timer guiado" desc="Alterna correr e caminhar com aviso sonoro e vibração." />
            <Feature icon={Zap} title="Plano de 4 semanas" desc="12 treinos progressivos, do iniciante ao corredor." />
            <Feature icon={Trophy} title="Certificado de 5km" desc="Conquiste e exporte sua jornada em PDF." />
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <Link to="/auth" search={{ mode: "signup" }} className="flex items-center justify-center gap-2 w-full rounded-2xl bg-primary text-primary-foreground font-bold py-4 text-lg shadow-glow active:scale-[0.98] transition">
            Começar agora <ChevronRight className="size-5" />
          </Link>
          <Link to="/auth" search={{ mode: "login" }} className="block text-center w-full rounded-2xl border-2 border-border font-semibold py-3.5">
            Já tenho conta
          </Link>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{className?:string}>; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="size-11 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
