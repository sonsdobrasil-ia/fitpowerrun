import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Webhook da Cakto.
 *
 * URL para configurar no painel da Cakto:
 *   https://project--375b51cf-b5fe-4950-9dbd-c7669480db2a.lovable.app/api/public/webhooks/cakto
 *
 * Autenticação aceita (qualquer uma):
 *   - header `x-cakto-signature` = HMAC-SHA256 (hex) do corpo cru com CAKTO_WEBHOOK_SECRET
 *   - header `x-cakto-secret` / `x-webhook-secret` = CAKTO_WEBHOOK_SECRET
 *   - campo `secret` no corpo JSON = CAKTO_WEBHOOK_SECRET
 */

const payloadSchema = z.object({
  event: z.string().max(120).optional(),
  type: z.string().max(120).optional(),
  secret: z.string().max(500).optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      status: z.string().max(60).optional(),
      customer: z
        .object({
          email: z.string().max(320).optional(),
          name: z.string().max(200).optional(),
          id: z.union([z.string(), z.number()]).optional(),
        })
        .partial()
        .optional(),
      offer: z
        .object({
          id: z.union([z.string(), z.number()]).optional(),
          name: z.string().max(200).optional(),
        })
        .partial()
        .optional(),
      product: z
        .object({
          id: z.union([z.string(), z.number()]).optional(),
          name: z.string().max(200).optional(),
        })
        .partial()
        .optional(),
      subscription: z
        .object({
          id: z.union([z.string(), z.number()]).optional(),
          status: z.string().max(60).optional(),
          next_payment_date: z.string().max(60).optional(),
          nextPaymentDate: z.string().max(60).optional(),
        })
        .partial()
        .optional(),
      paidAt: z.string().max(60).optional(),
      next_payment_date: z.string().max(60).optional(),
    })
    .partial()
    .optional(),
});

const ACTIVE_EVENTS = [
  "purchase_approved",
  "purchase_completed",
  "payment_approved",
  "subscription_created",
  "subscription_renewed",
  "subscription_active",
  "pix_paid",
];
const INACTIVE_EVENTS = [
  "purchase_refunded",
  "purchase_chargeback",
  "purchase_canceled",
  "refund",
  "chargeback",
  "subscription_canceled",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_suspended",
];

function equals(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function authorize(request: Request, rawBody: string, bodySecret: string | undefined, secret: string) {
  const signature = request.headers.get("x-cakto-signature") ?? request.headers.get("x-signature");
  if (signature) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (equals(signature.replace(/^sha256=/, ""), expected)) return true;
  }
  const token =
    request.headers.get("x-cakto-secret") ??
    request.headers.get("x-webhook-secret") ??
    bodySecret ??
    "";
  return token.length > 0 && equals(token, secret);
}

function normalizeEvent(raw: string) {
  return raw.toLowerCase().replace(/[\s.-]+/g, "_");
}

export const Route = createFileRoute("/api/public/webhooks/cakto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CAKTO_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[cakto] CAKTO_WEBHOOK_SECRET não configurado");
          return new Response("Webhook secret not configured", { status: 503 });
        }

        const rawBody = await request.text();
        let json: unknown;
        try {
          json = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(json);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        const body = parsed.data;

        if (!authorize(request, rawBody, body.secret, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const eventType = normalizeEvent(body.event ?? body.type ?? "");
        const data = body.data ?? {};
        const email = data.customer?.email?.trim().toLowerCase() ?? null;
        const offerId = String(data.offer?.id ?? data.product?.id ?? "") || null;
        const subscriptionId = String(data.subscription?.id ?? data.id ?? "") || null;
        const customerId = data.customer?.id != null ? String(data.customer.id) : null;
        const providerStatus = data.subscription?.status ?? data.status ?? null;
        const periodEnd =
          data.subscription?.next_payment_date ??
          data.subscription?.nextPaymentDate ??
          data.next_payment_date ??
          null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: logRow } = await supabaseAdmin
          .from("payment_webhook_events")
          .insert({
            provider: "cakto",
            event_type: eventType || null,
            external_id: subscriptionId,
            email,
            status: providerStatus,
            payload: json as never,
          })
          .select("id")
          .maybeSingle();

        const finish = async (processed: boolean, error?: string) => {
          if (logRow?.id) {
            await supabaseAdmin
              .from("payment_webhook_events")
              .update({ processed, error: error ?? null })
              .eq("id", logRow.id);
          }
          return Response.json({ received: true, processed, error: error ?? null });
        };

        const activates = ACTIVE_EVENTS.includes(eventType);
        const deactivates = INACTIVE_EVENTS.includes(eventType);
        if (!activates && !deactivates) return finish(false, `evento ignorado: ${eventType}`);
        if (!email) return finish(false, "payload sem e-mail do cliente");

        // Encontra o usuário do app pelo e-mail
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .ilike("email", email)
          .maybeSingle();

        if (!profile?.user_id) {
          return finish(false, `nenhum usuário encontrado para ${email}`);
        }

        // Descobre o plano pela oferta cadastrada
        let planId: string | null = null;
        let planSlug: string | null = null;
        if (offerId) {
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("id, slug")
            .eq("cakto_offer_id", offerId)
            .maybeSingle();
          if (plan) {
            planId = plan.id;
            planSlug = plan.slug;
          }
        }

        const { error } = await supabaseAdmin.from("subscribers").upsert(
          {
            user_id: profile.user_id,
            email,
            provider: "cakto",
            provider_customer_id: customerId,
            provider_subscription_id: subscriptionId,
            plan_id: planId,
            plano: planSlug,
            status: activates ? "active" : "canceled",
            current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
          },
          { onConflict: "user_id" },
        );

        if (error) {
          console.error("[cakto] falha ao gravar assinatura", error.message);
          return finish(false, error.message);
        }

        return finish(true);
      },

      GET: async () => Response.json({ ok: true, provider: "cakto" }),
    },
  },
});
