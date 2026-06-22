import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, ArrowUp, ArrowDown, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadCover, deleteCover } from "@/lib/ebook-covers";
import { CoverImage } from "@/components/CoverImage";

export const Route = createFileRoute("/_authenticated/admin/ebooks")({
  component: AdminEbooks,
});

const chapterSchema = z.object({
  titulo: z.string().trim().min(1, "Título do capítulo é obrigatório").max(200),
  conteudo: z.string().trim().min(1, "Conteúdo do capítulo é obrigatório").max(50000),
});

const ebookSchema = z.object({
  titulo: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  subtitulo: z.string().trim().max(200).optional().nullable(),
  autor: z.string().trim().max(120).optional().nullable(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  capa_url: z.string().trim().max(500).optional().nullable(),
  preco: z.number().min(0, "Preço não pode ser negativo").max(99999),
  publicado: z.boolean(),
  capitulos: z.array(chapterSchema),
});

type Chapter = z.infer<typeof chapterSchema>;
type Ebook = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  autor: string | null;
  capa_url: string | null;
  preco: number | null;
  publicado: boolean;
  capitulos: Chapter[];
};

const empty = (): Partial<Ebook> => ({
  titulo: "",
  subtitulo: "",
  descricao: "",
  autor: "",
  capa_url: "",
  preco: 0,
  publicado: false,
  capitulos: [],
});

function AdminEbooks() {
  const [list, setList] = useState<Ebook[]>([]);
  const [editing, setEditing] = useState<Partial<Ebook> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    const { data, error } = await supabase
      .from("ebooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setList(
      ((data as any[]) ?? []).map((e) => ({
        ...e,
        capitulos: Array.isArray(e.capitulos) ? e.capitulos : [],
      })),
    );
  };
  useEffect(() => {
    load();
  }, []);

  const open = (e?: Ebook) => {
    setErrors({});
    setEditing(e ? { ...e, capitulos: [...(e.capitulos ?? [])] } : empty());
  };

  const updateChapter = (i: number, patch: Partial<Chapter>) => {
    if (!editing) return;
    const cap = [...(editing.capitulos ?? [])];
    cap[i] = { ...cap[i], ...patch } as Chapter;
    setEditing({ ...editing, capitulos: cap });
  };
  const addChapter = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      capitulos: [...(editing.capitulos ?? []), { titulo: "", conteudo: "" }],
    });
  };
  const removeChapter = (i: number) => {
    if (!editing) return;
    const cap = [...(editing.capitulos ?? [])];
    cap.splice(i, 1);
    setEditing({ ...editing, capitulos: cap });
  };
  const moveChapter = (i: number, dir: -1 | 1) => {
    if (!editing) return;
    const cap = [...(editing.capitulos ?? [])];
    const j = i + dir;
    if (j < 0 || j >= cap.length) return;
    [cap[i], cap[j]] = [cap[j], cap[i]];
    setEditing({ ...editing, capitulos: cap });
  };

  const onUpload = async (file: File) => {
    if (!editing) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem");
    if (file.size > 4 * 1024 * 1024) return toast.error("Imagem deve ter até 4MB");
    setUploading(true);
    try {
      const path = await uploadCover(file);
      if (editing.capa_url && !/^https?:\/\//i.test(editing.capa_url)) {
        await deleteCover(editing.capa_url);
      }
      setEditing({ ...editing, capa_url: path });
      toast.success("Capa enviada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    const parsed = ebookSchema.safeParse({
      titulo: editing.titulo ?? "",
      subtitulo: editing.subtitulo ?? null,
      autor: editing.autor ?? null,
      descricao: editing.descricao ?? null,
      capa_url: editing.capa_url ?? null,
      preco: Number(editing.preco ?? 0),
      publicado: !!editing.publicado,
      capitulos: editing.capitulos ?? [],
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[i.path.join(".")] = i.message;
      });
      setErrors(errs);
      return toast.error("Corrija os campos destacados");
    }
    if (parsed.data.publicado && parsed.data.capitulos.length === 0) {
      setErrors({ capitulos: "Adicione ao menos um capítulo para publicar" });
      return toast.error("Adicione capítulos antes de publicar");
    }
    setSaving(true);
    const payload = parsed.data as any;
    const { error } = editing.id
      ? await supabase.from("ebooks").update(payload).eq("id", editing.id)
      : await supabase.from("ebooks").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setEditing(null);
    setErrors({});
    load();
  };

  const remove = async (e: Ebook) => {
    if (!confirm(`Excluir "${e.titulo}"?`)) return;
    if (e.capa_url) await deleteCover(e.capa_url);
    const { error } = await supabase.from("ebooks").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  };

  const togglePublish = async (e: Ebook) => {
    if (!e.publicado && (!e.capitulos || e.capitulos.length === 0)) {
      return toast.error("Adicione capítulos antes de publicar");
    }
    const { error } = await supabase
      .from("ebooks")
      .update({ publicado: !e.publicado })
      .eq("id", e.id);
    if (error) return toast.error(error.message);
    load();
  };

  const err = (k: string) => errors[k];
  const chapterErrors = useMemo(() => {
    const map: Record<number, { titulo?: string; conteudo?: string }> = {};
    Object.entries(errors).forEach(([k, v]) => {
      const m = k.match(/^capitulos\.(\d+)\.(titulo|conteudo)$/);
      if (m) {
        const i = Number(m[1]);
        map[i] = { ...map[i], [m[2]]: v };
      }
    });
    return map;
  }, [errors]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Produtos (eBooks)</h2>
        <Button onClick={() => open()} size="sm">
          <Plus className="size-4 mr-1" /> Novo
        </Button>
      </div>
      <div className="grid gap-3">
        {list.map((e) => (
          <Card key={e.id} className="p-4 flex items-center gap-3">
            <CoverImage
              value={e.capa_url}
              className="size-14 rounded object-cover bg-muted shrink-0"
              alt={e.titulo}
              fallback={<div className="size-14 rounded bg-muted shrink-0" />}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{e.titulo}</div>
              <div className="text-xs text-muted-foreground truncate">{e.subtitulo}</div>
              <div className="text-xs mt-1 flex items-center gap-2">
                <Badge variant={e.publicado ? "default" : "secondary"}>
                  {e.publicado ? "Publicado" : "Rascunho"}
                </Badge>
                <span>R$ {Number(e.preco ?? 0).toFixed(2)}</span>
                <span className="text-muted-foreground">· {e.capitulos?.length ?? 0} cap.</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => togglePublish(e)}>
              {e.publicado ? "Despublicar" : "Publicar"}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => open(e)}>
              <Pencil className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(e)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </Card>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum eBook cadastrado.</p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && (setEditing(null), setErrors({}))}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar eBook" : "Novo eBook"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-[140px_1fr] gap-4">
                <div>
                  <Label className="mb-2 block">Capa</Label>
                  <div className="relative size-32 rounded-md border bg-muted overflow-hidden">
                    <CoverImage
                      value={editing.capa_url}
                      className="size-full object-cover"
                      fallback={
                        <div className="size-full grid place-items-center text-xs text-muted-foreground">
                          Sem capa
                        </div>
                      }
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 grid place-items-center">
                        <Loader2 className="size-6 animate-spin text-white" />
                      </div>
                    )}
                    {editing.capa_url && !uploading && (
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteCover(editing.capa_url);
                          setEditing({ ...editing, capa_url: "" });
                        }}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                  <label className="mt-2 inline-flex items-center gap-1 text-xs text-primary cursor-pointer">
                    <Upload className="size-3" /> Enviar imagem
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <div className="space-y-3">
                  <Field label="Título *" error={err("titulo")}>
                    <Input
                      value={editing.titulo ?? ""}
                      onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                      maxLength={200}
                    />
                  </Field>
                  <Field label="Subtítulo" error={err("subtitulo")}>
                    <Input
                      value={editing.subtitulo ?? ""}
                      onChange={(e) => setEditing({ ...editing, subtitulo: e.target.value })}
                      maxLength={200}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Autor" error={err("autor")}>
                      <Input
                        value={editing.autor ?? ""}
                        onChange={(e) => setEditing({ ...editing, autor: e.target.value })}
                        maxLength={120}
                      />
                    </Field>
                    <Field label="Preço (R$)" error={err("preco")}>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editing.preco ?? 0}
                        onChange={(e) => setEditing({ ...editing, preco: Number(e.target.value) })}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <Field label="Descrição" error={err("descricao")}>
                <Textarea
                  rows={3}
                  value={editing.descricao ?? ""}
                  onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                  maxLength={2000}
                />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Capítulos ({editing.capitulos?.length ?? 0})</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addChapter}>
                    <Plus className="size-3 mr-1" /> Capítulo
                  </Button>
                </div>
                {err("capitulos") && (
                  <p className="text-xs text-destructive mb-2">{err("capitulos")}</p>
                )}
                <div className="space-y-3">
                  {(editing.capitulos ?? []).map((c, i) => (
                    <Card key={i} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6">
                          {i + 1}.
                        </span>
                        <Input
                          placeholder="Título do capítulo"
                          value={c.titulo}
                          onChange={(e) => updateChapter(i, { titulo: e.target.value })}
                          maxLength={200}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => moveChapter(i, -1)}
                          disabled={i === 0}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => moveChapter(i, 1)}
                          disabled={i === (editing.capitulos?.length ?? 0) - 1}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeChapter(i)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                      {chapterErrors[i]?.titulo && (
                        <p className="text-xs text-destructive">{chapterErrors[i].titulo}</p>
                      )}
                      <Textarea
                        rows={5}
                        placeholder="Conteúdo do capítulo (texto ou markdown)"
                        value={c.conteudo}
                        onChange={(e) => updateChapter(i, { conteudo: e.target.value })}
                        maxLength={50000}
                      />
                      {chapterErrors[i]?.conteudo && (
                        <p className="text-xs text-destructive">{chapterErrors[i].conteudo}</p>
                      )}
                    </Card>
                  ))}
                  {(editing.capitulos?.length ?? 0) === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                      Nenhum capítulo. Clique em "Capítulo" para adicionar.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-md">
                <Switch
                  checked={editing.publicado ?? false}
                  onCheckedChange={(v) => setEditing({ ...editing, publicado: v })}
                />
                <div className="flex-1">
                  <Label>{editing.publicado ? "Publicado" : "Rascunho"}</Label>
                  <p className="text-xs text-muted-foreground">
                    {editing.publicado
                      ? "Visível para todos os usuários autenticados."
                      : "Apenas administradores podem visualizar."}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => (setEditing(null), setErrors({}))}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || uploading}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
