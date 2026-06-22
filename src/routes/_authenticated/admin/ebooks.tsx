import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/ebooks")({
  component: AdminEbooks,
});

type Ebook = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  autor: string | null;
  capa_url: string | null;
  preco: number | null;
  publicado: boolean;
  capitulos: any;
};

const empty: Partial<Ebook> = {
  titulo: "",
  subtitulo: "",
  descricao: "",
  autor: "",
  capa_url: "",
  preco: 0,
  publicado: true,
  capitulos: [],
};

function AdminEbooks() {
  const [list, setList] = useState<Ebook[]>([]);
  const [editing, setEditing] = useState<Partial<Ebook> | null>(null);
  const [capitulosText, setCapitulosText] = useState("");

  const load = async () => {
    const { data } = await supabase.from("ebooks").select("*").order("created_at", { ascending: false });
    setList((data as Ebook[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const openEdit = (e?: Ebook) => {
    if (e) {
      setEditing(e);
      setCapitulosText(JSON.stringify(e.capitulos ?? [], null, 2));
    } else {
      setEditing(empty);
      setCapitulosText("[]");
    }
  };

  const save = async () => {
    if (!editing?.titulo) return toast.error("Título é obrigatório");
    let capitulos: any = [];
    try {
      capitulos = JSON.parse(capitulosText || "[]");
    } catch {
      return toast.error("JSON dos capítulos inválido");
    }
    const payload = { ...editing, capitulos } as any;
    const { error } = editing.id
      ? await supabase.from("ebooks").update(payload).eq("id", editing.id)
      : await supabase.from("ebooks").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este eBook?")) return;
    const { error } = await supabase.from("ebooks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Produtos (eBooks)</h2>
        <Button onClick={() => openEdit()} size="sm">
          <Plus className="size-4 mr-1" /> Novo
        </Button>
      </div>
      <div className="grid gap-3">
        {list.map((e) => (
          <Card key={e.id} className="p-4 flex items-center gap-3">
            {e.capa_url ? (
              <img src={e.capa_url} alt="" className="size-14 rounded object-cover" />
            ) : (
              <div className="size-14 rounded bg-muted" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{e.titulo}</div>
              <div className="text-xs text-muted-foreground truncate">{e.subtitulo}</div>
              <div className="text-xs mt-1">
                {e.publicado ? (
                  <span className="text-secondary">Publicado</span>
                ) : (
                  <span className="text-muted-foreground">Rascunho</span>
                )}{" "}
                · R$ {Number(e.preco ?? 0).toFixed(2)}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
              <Pencil className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </Card>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum eBook cadastrado.</p>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar eBook" : "Novo eBook"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input value={editing.titulo ?? ""} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={editing.subtitulo ?? ""} onChange={(e) => setEditing({ ...editing, subtitulo: e.target.value })} />
              </div>
              <div>
                <Label>Autor</Label>
                <Input value={editing.autor ?? ""} onChange={(e) => setEditing({ ...editing, autor: e.target.value })} />
              </div>
              <div>
                <Label>URL da capa</Label>
                <Input value={editing.capa_url ?? ""} onChange={(e) => setEditing({ ...editing, capa_url: e.target.value })} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.preco ?? 0}
                  onChange={(e) => setEditing({ ...editing, preco: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={editing.descricao ?? ""}
                  onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                />
              </div>
              <div>
                <Label>Capítulos (JSON)</Label>
                <Textarea
                  rows={8}
                  className="font-mono text-xs"
                  value={capitulosText}
                  onChange={(e) => setCapitulosText(e.target.value)}
                  placeholder='[{"titulo":"Cap 1","conteudo":"..."}]'
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.publicado ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, publicado: v })}
                />
                <Label>Publicado</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
