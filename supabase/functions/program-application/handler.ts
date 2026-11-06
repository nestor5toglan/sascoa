// Données, jetons et secrets ne sont jamais écrits dans les logs.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PDF = 5 * 1024 * 1024,
  MAX_BODY = 8 * 1024 * 1024;
class Invalid extends Error {}
const digest = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
export function normalize(input: Record<string, unknown>) {
  if (
    !["pitch", "hackathon"].includes(String(input.program)) ||
    typeof input.submission_key !== "string" ||
    !UUID.test(input.submission_key) ||
    typeof input.notice_version !== "string" ||
    !UUID.test(input.notice_version) ||
    input.consent !== true
  )
    throw new Invalid(
      "Recharge le formulaire et prends connaissance de la notice.",
    );
  const fields: Record<string, unknown> = {};
  for (const [key, max] of Object.entries({
    full_name: 200,
    email: 254,
    phone: 60,
    organization: 200,
    project_name: 200,
    description: 5000,
    objective: 3000,
    skills: 1000,
    team_name: 120,
  })) {
    if (typeof input[key] !== "string" || input[key].trim().length > max)
      throw new Invalid("Un champ est absent ou trop long.");
    fields[key] = input[key].trim();
  }
  fields.email = String(fields.email).toLowerCase();
  if (!fields.full_name || !/^\S+@[^\s@]+\.[^\s@]+$/.test(String(fields.email)))
    throw new Invalid("Vérifie le nom et l’email.");
  if (
    !["individual", "team"].includes(String(input.participation_mode)) ||
    !Array.isArray(input.members) ||
    input.members.length > 19 ||
    typeof input.members_authorized !== "boolean"
  )
    throw new Invalid("Composition d’équipe invalide.");
  fields.participation_mode = input.participation_mode;
  fields.members_authorized = input.members_authorized;
  fields.members = input.members.map((member: unknown) => {
    if (!member || typeof member !== "object" || Array.isArray(member))
      throw new Invalid("Membre invalide.");
    const m = member as Record<string, unknown>;
    if (
      typeof m.full_name !== "string" ||
      !m.full_name.trim() ||
      m.full_name.trim().length > 100 ||
      typeof m.skills !== "string" ||
      m.skills.trim().length > 500
    )
      throw new Invalid("Vérifie les noms et compétences des membres.");
    return { full_name: m.full_name.trim(), skills: m.skills.trim() };
  });
  if (
    input.participation_mode === "individual" &&
    (input.members.length || fields.team_name || input.members_authorized)
  )
    throw new Invalid(
      "Une candidature individuelle ne comporte pas de membres.",
    );
  if (
    input.participation_mode === "team" &&
    (input.program !== "hackathon" ||
      !fields.team_name ||
      !input.members.length ||
      !input.members_authorized)
  )
    throw new Invalid(
      "Vérifie le nom de l’équipe et l’autorisation de transmettre ses membres.",
    );
  if (
    input.program === "pitch" &&
    (!fields.project_name ||
      !fields.description ||
      !fields.objective ||
      input.participation_mode !== "individual")
  )
    throw new Invalid("Renseigne le projet, sa présentation et son objectif.");
  if (input.program === "hackathon" && !fields.skills)
    throw new Invalid(
      "Renseigne les compétences du candidat ou du responsable.",
    );
  return fields;
}
function pdfFile(raw: unknown) {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Invalid("Document invalide.");
  const f = raw as Record<string, unknown>;
  if (
    typeof f.base64 !== "string" ||
    !f.base64.length ||
    f.base64.length > Math.ceil(MAX_PDF / 3) * 4 ||
    f.base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(f.base64) ||
    typeof f.name !== "string" ||
    f.name.length > 250
  )
    throw new Invalid("Choisis un PDF de 5 Mo maximum.");
  const binary = atob(f.base64),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (
    !bytes.length ||
    bytes.length > MAX_PDF ||
    !/^%PDF-[12]\.[0-9]/.test(new TextDecoder().decode(bytes.slice(0, 8)))
  )
    throw new Invalid("Le fichier doit être un véritable PDF de 5 Mo maximum.");
  const name =
    (f.name.split(/[\\/]/).pop() || "presentation.pdf")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 120) || "presentation.pdf";
  return { bytes, name };
}
export async function handle(
  request: Request,
  env: Record<string, string>,
  network: typeof fetch = fetch,
): Promise<Response> {
  const origin = request.headers.get("origin") || "",
    allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  const headers = {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "content-type,apikey,authorization,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!allowed.includes(origin))
    return new Response("Origin refusée", { status: 403 });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply(405, { error: "Méthode refusée." });
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.TURNSTILE_SECRET_KEY
  )
    return reply(503, { error: "Candidatures temporairement indisponibles." });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply(415, { error: "Format invalide." });
    const reader = request.body?.getReader();
    if (!reader) throw new Invalid("Formulaire vide.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) {
        await reader.cancel();
        return reply(413, { error: "Formulaire et document trop volumineux." });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Invalid("Formulaire invalide.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Invalid("Formulaire invalide.");
    const fields = normalize(input),
      pdf = pdfFile(input.document);
    if (
      typeof input.token !== "string" ||
      !input.token ||
      input.token.length > 2048
    )
      throw new Invalid("Vérification anti-robot requise.");
    const captchaResponse = await network(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: input.token,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const captcha = await captchaResponse.json();
    if (
      !captchaResponse.ok ||
      captcha.success !== true ||
      captcha.action !== "program-application" ||
      captcha.hostname !== new URL(origin).hostname
    )
      throw new Invalid(
        "Vérification anti-robot expirée ou refusée. Réessaie.",
      );
    const fileHash = pdf ? await digest(pdf.bytes) : null;
    const canonical = new TextEncoder().encode(
      JSON.stringify([
        input.program,
        input.notice_version,
        fields,
        pdf?.name || null,
        pdf?.bytes.length || 0,
        fileHash,
      ]),
    );
    const hash = await digest(canonical);
    const auth = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    };
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const res = await network(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(15000),
      });
      return { ok: res.ok, data: await res.json() };
    };
    const failure = (result: { code?: string }) =>
      result.code === "P0001"
        ? reply(429, {
            error:
              "La limite de candidatures est atteinte. Réessaie plus tard ou contacte l’organisation.",
          })
        : result.code === "22023"
          ? reply(409, {
              error:
                "Le formulaire a changé, les candidatures sont fermées ou la composition ne respecte plus la limite. Actualisez les règles du formulaire puis vérifiez sa composition et son ouverture.",
            })
          : reply(503, {
              error:
                "Enregistrement interrompu. Réessaie avec les mêmes informations et le même document.",
            });
    const reservation = await rpc("reserve_program_application", {
      p_key: input.submission_key,
      p_hash: hash,
      p_program: input.program,
      p_version: input.notice_version,
      p_payload: fields,
      p_file_name: pdf?.name || null,
      p_file_size: pdf?.bytes.length || 0,
      p_file_hash: fileHash,
    });
    if (!reservation.ok) return failure(reservation.data);
    if (typeof reservation.data.reference === "string")
      return reply(200, { reference: reservation.data.reference });
    if (
      typeof reservation.data.intent_id !== "string" ||
      !UUID.test(reservation.data.intent_id)
    )
      throw new Error("response");
    if (pdf) {
      const path = reservation.data.file_path;
      if (
        typeof path !== "string" ||
        path !== `applications/${reservation.data.intent_id}.pdf` ||
        !/^applications\/[0-9a-f-]{36}\.pdf$/i.test(path)
      )
        throw new Error("path");
      const upload = await network(
        `${env.SUPABASE_URL}/storage/v1/object/sascoa-private/${path}`,
        {
          method: "POST",
          headers: {
            ...auth,
            "Content-Type": "application/pdf",
            "x-upsert": "false",
            "cache-control": "no-store",
          },
          body: pdf.bytes.buffer,
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!upload.ok) {
        const issue = await upload.json().catch(() => ({}));
        if (
          ![400, 409].includes(upload.status) ||
          !(
            issue.error === "Duplicate" ||
            issue.code === "Duplicate" ||
            /already exists/i.test(String(issue.message || ""))
          )
        )
          throw new Error("upload");
      }
    }
    const final = await rpc("finalize_program_application", {
      p_intent: reservation.data.intent_id,
      p_hash: hash,
    });
    if (!final.ok) return failure(final.data);
    if (typeof final.data.reference !== "string") throw new Error("response");
    return reply(200, { reference: final.data.reference });
  } catch (e) {
    return e instanceof Invalid
      ? reply(400, { error: e.message })
      : reply(503, {
          error:
            "Envoi interrompu. Tes saisies sont conservées. Réessaie avec le même document.",
        });
  }
}
