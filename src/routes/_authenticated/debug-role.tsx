import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/debug-role")({
  ssr: false,
  component: DebugRole,
});

function DebugRole() {
  const { user, loading } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const load = async () => {
    if (!user) return;
    setChecking(true);
    setError(null);
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (error) setError(error.message);
    setRoles((data ?? []).map((r: any) => r.role));
    setChecking(false);
  };

  useEffect(() => {
    if (!loading && user) load();
  }, [loading, user?.id]);

  const isAdmin = roles.includes("admin");

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
      <h1 className="text-2xl font-bold">Debug de Permissões</h1>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Usuário</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : user ? (
          <>
            <div className="text-sm">
              <span className="text-muted-foreground">E-mail:</span> {user.email}
            </div>
            <div className="text-xs font-mono break-all">
              <span className="text-muted-foreground">ID:</span> {user.id}
            </div>
          </>
        ) : (
          <p className="text-sm text-destructive">Não autenticado</p>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Papéis (user_roles)</h2>
          <Button size="sm" variant="outline" onClick={load} disabled={checking}>
            Recarregar
          </Button>
        </div>
        {checking ? (
          <p className="text-sm text-muted-foreground">Consultando...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro: {error}</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum papel atribuído. Você não conseguirá acessar /admin.
          </p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {roles.map((r) => (
              <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                {r}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Acesso a /admin</h2>
        {isAdmin ? (
          <>
            <p className="text-sm text-green-600">✓ Você tem permissão de administrador.</p>
            <Button asChild size="sm">
              <Link to="/admin">Ir para /admin</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-destructive">
            ✗ Sem papel <code>admin</code>. O guard de /admin vai redirecionar para /dashboard.
          </p>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Dica: após mudanças de papel no banco, faça logout/login para atualizar a sessão.
      </p>
    </div>
  );
}
