/* Vercel serverless boundary: GitHub credentials never reach the browser. */
import { createClient } from "@supabase/supabase-js";

const env = (name: string) => process.env[name] || "";
const github = () => ({ owner: env("GITHUB_OWNER"), repo: env("GITHUB_REPO"), branch: env("GITHUB_BRANCH") || "main", token: env("GITHUB_TOKEN"), cmsBranch: env("GITHUB_CMS_BRANCH") || "cms-data" });
const b64 = (value: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(value, null, 2))));
const decode = (value: string) => JSON.parse(decodeURIComponent(escape(atob(value.replace(/\n/g, "")))));
async function requireAdmin(req: any) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Não autenticado.");
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.email?.toLowerCase() !== env("CMS_ADMIN_EMAIL").toLowerCase()) throw new Error("Sem permissão administrativa.");
}
async function gh(path: string, init: RequestInit = {}) { const cfg = github(); const response = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json", ...(init.headers || {}) } }); return response; }
async function ensureBranch() { const cfg = github(); const exists = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${cfg.cmsBranch}`, { headers: { Authorization: `Bearer ${cfg.token}` } }); if (exists.ok) return; const base = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${cfg.branch}`, { headers: { Authorization: `Bearer ${cfg.token}` } }); const ref = await base.json(); if (!base.ok || !ref.object?.sha) throw new Error("Não foi possível preparar o repositório."); const created = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/refs`, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ref: `refs/heads/${cfg.cmsBranch}`, sha: ref.object.sha }) }); if (!created.ok) throw new Error("Não foi possível criar a área de conteúdo."); }
async function readData() { const cfg = github(); const response = await gh(`data.json?ref=${cfg.cmsBranch}`); if (!response.ok) throw new Error("Conteúdo ainda não publicado."); const item = await response.json(); return decode(item.content); }
export default async function handler(req: any, res: any) {
  if (!github().owner || !github().repo || !github().token) return res.status(500).json({ error: "Integração segura do servidor não configurada." });
  try {
    if (req.method === "GET") return res.status(200).json(await readData());
    if (req.method !== "POST") return res.status(405).end();
    await requireAdmin(req); const { action, data, url } = req.body || {};
    if (action === "publish") { await ensureBranch(); const cfg = github(); const current = await gh(`data.json?ref=${cfg.cmsBranch}`); const existing = current.ok ? await current.json() : null; const body: Record<string, unknown> = { message: "CMS: conteúdo publicado", content: b64(data), branch: cfg.cmsBranch }; if (existing?.sha) body.sha = existing.sha; const saved = await gh("data.json", { method: "PUT", body: JSON.stringify(body) }); if (!saved.ok) throw new Error("O GitHub recusou a publicação."); return res.status(200).json({ ok: true }); }
    if (action === "delete-media" && typeof url === "string" && url.includes("/storage/v1/object/public/cms-media/")) { const path = url.split("/cms-media/")[1]; const client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")); const { error } = await client.storage.from("cms-media").remove([decodeURIComponent(path)]); if (error) throw error; return res.status(200).json({ ok: true }); }
    return res.status(400).json({ error: "Operação inválida." });
  } catch (error) { return res.status(403).json({ error: error instanceof Error ? error.message : "Operação negada." }); }
}
