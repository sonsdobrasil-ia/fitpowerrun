import { Link, useLocation } from "@tanstack/react-router";
import { Home, Dumbbell, TrendingUp, BookOpen, User } from "lucide-react";

const items = [
  { to: "/dashboard", icon: Home, label: "Início" },
  { to: "/workouts", icon: Dumbbell, label: "Treinos" },
  { to: "/progress", icon: TrendingUp, label: "Progresso" },
  { to: "/ebook", icon: BookOpen, label: "eBook" },
  { to: "/profile", icon: User, label: "Perfil" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur safe-bottom">
      <ul className="grid grid-cols-5 max-w-xl mx-auto">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`size-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className={active ? "font-semibold" : ""}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
