import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { Bell, Download, LogOut, Moon, Sun, User as UserIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { setTheme, getTheme } from "@/lib/theme";

const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [peso, setPeso] = useState<string>("");
  const [meta, setMeta] = useState("");
  const [dias, setDias] = useState<string[]>([]);
  const [horario, setHorario] = useState("18:00");
  const [tema, setTemaState] = useState<"light" | "dark">("light");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTemaState(getTheme());
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("user_id", u.user.id).maybeSingle();
      if (data) {
        setNome(data.nome ?? "");
        setPeso(data.peso != null ? String(data.peso) : "");
        setMeta(data.meta ?? "");
        setDias(data.dias_lembrete ?? []);
        setHorario(data.horario_lembrete ?? "18:00");
      }
    })();
  }, []);

  async function salvar() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({
      nome, peso: peso ? Number(peso) : null, meta,
      dias_lembrete: dias, horario_lembrete: horario, tema,
      updated_at: new Date().toISOString(),
    }).eq("user_id", u.user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Perfil salvo!");
      configurarLembretes(dias, horario);
    }
  }

  async function pedirNotificacoes() {
    if (!("Notification" in window)) { toast.error("Seu navegador não suporta notificações."); return; }
    const p = await Notification.requestPermission();
    if (p === "granted") toast.success("Notificações ativadas!");
    else toast.error("Permissão negada.");
  }

  function configurarLembretes(dias: string[], horario: string) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (dias.length === 0) return;
    // Agendamento simples: verifica a cada minuto se é hora de notificar
    if ((window as any).__fpReminderInterval) clearInterval((window as any).__fpReminderInterval);
    (window as any).__fpReminderInterval = setInterval(() => {
      const now = new Date();
      const dia = DIAS[now.getDay()];
      const hh = now.getHours().toString().padStart(2,"0");
      const mm = now.getMinutes().toString().padStart(2,"0");
      if (dias.includes(dia) && `${hh}:${mm}` === horario) {
        new Notification("FitPower 💪", { body: "Hora de treinar! Bora cruzar mais um dia rumo aos 5km.", icon: "/icon-192.png" });
      }
    }, 30000);
  }

  function exportarProgresso() {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: logs } = await supabase.from("workout_logs").select("*").eq("user_id", u.user.id).order("data");
      const doc = new jsPDF();
      doc.setFillColor(255,107,53); doc.rect(0,0,210,25,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(20); doc.text("FitPower · Meu Progresso", 14, 17);
      doc.setTextColor(43,43,43); doc.setFontSize(12);
      doc.text(`Atleta: ${nome || "—"}`, 14, 38);
      doc.text(`E-mail: ${email}`, 14, 45);
      doc.text(`Total de treinos: ${logs?.length ?? 0}`, 14, 52);
      const totalMin = (logs ?? []).reduce((a, l) => a + l.duracao, 0);
      doc.text(`Minutos totais: ${totalMin}`, 14, 59);
      doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text("Histórico", 14, 73);
      doc.setFont("helvetica","normal"); doc.setFontSize(10);
      let y = 82;
      (logs ?? []).forEach((l) => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(`${new Date(l.data).toLocaleDateString("pt-BR")} · S${l.semana}-T${l.numero_treino} · ${l.duracao}min · esforço ${l.esforco ?? "-"}/10`, 14, y);
        y += 6;
      });
      doc.save("progresso-fitpower.pdf");
      toast.success("Progresso exportado!");
    })();
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  function toggleTema() {
    const novo = tema === "light" ? "dark" : "light";
    setTemaState(novo); setTheme(novo);
  }

  function toggleDia(d: string) {
    setDias((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  return (
    <div className="px-5 pt-8 pb-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold">Perfil</h1>

      <div className="mt-5 flex items-center gap-4 rounded-2xl bg-card border p-4 shadow-soft">
        <div className="size-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground"><UserIcon className="size-6" /></div>
        <div className="min-w-0"><p className="font-bold truncate">{nome || "Atleta"}</p><p className="text-xs text-muted-foreground truncate">{email}</p></div>
      </div>

      <Section title="Dados">
        <Field label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} className="input" /></Field>
        <Field label="Peso (kg)"><input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} className="input" /></Field>
        <Field label="Sua meta"><input value={meta} onChange={(e) => setMeta(e.target.value)} className="input" placeholder="Ex.: Correr meus primeiros 5km" /></Field>
      </Section>

      <Section title="Lembretes de treino" icon={Bell}>
        <p className="text-xs text-muted-foreground mb-3">Receba notificações para não esquecer de treinar.</p>
        <div className="flex gap-1.5 flex-wrap">
          {DIAS.map((d) => (
            <button key={d} type="button" onClick={() => toggleDia(d)}
              className={`px-3 py-1.5 rounded-full border-2 text-sm font-semibold ${dias.includes(d) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
              {d}
            </button>
          ))}
        </div>
        <Field label="Horário"><input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="input" /></Field>
        <button onClick={pedirNotificacoes} className="mt-2 text-sm text-primary font-semibold underline">Ativar notificações</button>
      </Section>

      <Section title="Aparência">
        <button onClick={toggleTema} className="flex items-center justify-between w-full">
          <span className="flex items-center gap-2 font-semibold">{tema === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />} Modo {tema === "dark" ? "escuro" : "claro"}</span>
          <span className="text-sm text-muted-foreground">Toque para alternar</span>
        </button>
      </Section>

      <button onClick={salvar} disabled={saving} className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold py-3.5 shadow-glow disabled:opacity-60">
        <Save className="size-4" /> {saving ? "Salvando..." : "Salvar alterações"}
      </button>

      <button onClick={exportarProgresso} className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border-2 font-semibold py-3.5">
        <Download className="size-4" /> Exportar meu progresso em PDF
      </button>

      <button onClick={logout} className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-destructive/40 text-destructive font-semibold py-3.5">
        <LogOut className="size-4" /> Sair
      </button>

      <style>{`.input{width:100%;padding:12px 14px;border-radius:12px;border:2px solid var(--color-border);background:var(--color-card);font-size:15px;outline:none;margin-top:6px}.input:focus{border-color:var(--color-primary)}`}</style>
    </div>
  );
}

function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ComponentType<{className?:string}> }) {
  return (
    <section className="mt-6">
      <h3 className="font-bold flex items-center gap-2 mb-2">{Icon && <Icon className="size-4 text-primary" />}{title}</h3>
      <div className="rounded-2xl bg-card border p-4 shadow-soft space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block text-sm font-semibold">{label}{children}</label>);
}
