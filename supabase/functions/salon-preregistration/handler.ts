/** Pas de journalisation des coordonnées, du jeton ou des secrets. */
export async function handle(
  request: Request,
  env: Record<string, string>,
  network: typeof fetch = fetch,
): Promise<Response> {
  const origin = request.headers.get("origin") || "";
  const origins = (env.ALLOWED_ORIGINS || "")
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
  const reply = (status: number, message: unknown) =>
    new Response(JSON.stringify(message), { status, headers });
  if (!origins.includes(origin))
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
    return reply(503, { error: "Préinscription temporairement indisponible." });
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply(415, { error: "Format invalide." });
    // Lecture bornée même en l’absence de Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "Formulaire vide." });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16000) {
        await reader.cancel();
        return reply(413, { error: "Formulaire trop volumineux." });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    const input = JSON.parse(new TextDecoder().decode(bytes));
    if (!input || typeof input !== "object" || Array.isArray(input))
      return reply(400, { error: "Formulaire invalide." });
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const field of ["submission_key", "event_id", "notice_version"])
      if (typeof input[field] !== "string" || !uuid.test(input[field]))
        return reply(400, { error: "Recharge le formulaire puis réessaie." });
    if (input.consent !== true)
      return reply(400, {
        error: "Merci de prendre connaissance de la notice.",
      });
    const fields: Record<string, string> = {};
    for (const [key, max] of Object.entries({
      first_name: 100,
      last_name: 100,
      email: 254,
      phone: 60,
      organization: 200,
      interest: 20,
      message: 2000,
    })) {
      if (typeof input[key] !== "string" || input[key].trim().length > max)
        return reply(400, { error: "Un champ est absent ou trop long." });
      fields[key] = input[key].trim();
    }
    fields.email = fields.email!.toLowerCase();
    if (
      !fields.first_name ||
      !fields.last_name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ||
      !["visitor", "exhibitor", "partner", "press"].includes(fields.interest!)
    )
      return reply(400, {
        error: "Vérifie le nom, le prénom, l’email et le profil.",
      });
    if (
      typeof input.token !== "string" ||
      !input.token ||
      input.token.length > 2048
    )
      return reply(400, { error: "Vérification anti-robot requise." });
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
      captcha.action !== "salon-preregistration" ||
      captcha.hostname !== new URL(origin).hostname
    )
      return reply(400, {
        error: "Vérification anti-robot expirée ou refusée. Réessaie.",
      });
    const canonical = JSON.stringify([
      input.event_id,
      input.notice_version,
      fields,
    ]);
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(canonical),
        ),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const response = await network(
      `${env.SUPABASE_URL}/rest/v1/rpc/submit_salon_preregistration`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_key: input.submission_key,
          p_hash: hash,
          p_event: input.event_id,
          p_version: input.notice_version,
          p_first: fields.first_name,
          p_last: fields.last_name,
          p_email: fields.email,
          p_phone: fields.phone,
          p_organization: fields.organization,
          p_interest: fields.interest,
          p_message: fields.message,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      if (result.code === "P0001")
        return reply(429, {
          error:
            "Trop de demandes pour cette adresse. Réessaie dans une heure.",
        });
      if (result.code === "22023")
        return reply(409, {
          error:
            "Le formulaire a changé, les préinscriptions sont fermées ou cette demande a déjà été modifiée. Recharge la page.",
        });
      return reply(503, {
        error: "Enregistrement impossible pour le moment. Réessaie.",
      });
    }
    if (typeof result.reference !== "string")
      return reply(503, {
        error: "Réponse inattendue. Réessaie avec le même formulaire.",
      });
    return reply(200, { reference: result.reference });
  } catch {
    return reply(503, {
      error: "Envoi interrompu. Tes saisies sont conservées. Réessaie.",
    });
  }
}
