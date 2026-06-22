import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/billing")({
  component: AdminBilling,
});

function AdminBilling() {
  return (
    <div className="space-y-4">
      <Card className="p-6 text-center">
        <Receipt className="size-10 mx-auto text-primary mb-3" />
        <h2 className="text-lg font-semibold mb-1">Faturamento</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Integre um provedor de pagamento (Stripe ou Paddle) para começar a vender seus eBooks e
          assinaturas. Quando conectado, suas vendas, assinaturas ativas e receita aparecerão aqui.
        </p>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Receita (mês)</div>
          <div className="text-2xl font-bold">R$ 0,00</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vendas (mês)</div>
          <div className="text-2xl font-bold">0</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Assinaturas ativas</div>
          <div className="text-2xl font-bold">0</div>
        </Card>
      </div>
    </div>
  );
}
