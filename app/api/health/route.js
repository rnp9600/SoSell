import { supabaseServer } from '@/lib/supabase/server';

/** Give the failure a name.
 *
 *  Everything lives in the `catalog` schema, not `public`, and PostgREST only
 *  serves schemas in its db-schemas setting. A dashboard API-settings change
 *  can silently drop it, and then every call 404s and the site looks broken
 *  for no visible reason.
 *
 *    PGRST106  the schema itself is not exposed
 *    PGRST205  the schema is fine, the table cache is stale — needs
 *              `notify pgrst, 'reload schema'`
 *
 *  Knowing which of those two it is turns an afternoon into a minute.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    const sb = await supabaseServer();
    const { error } = await sb.from('departments').select('id').limit(1);
    if (error) {
      const hint =
        error.code === 'PGRST106'
          ? "The `catalog` schema is not exposed. Add it to pgrst.db_schemas, then `notify pgrst, 'reload config'`."
          : error.code === 'PGRST205'
            ? "The schema is exposed but the table cache is stale. Run `notify pgrst, 'reload schema'`."
            : null;
      return Response.json(
        { ok: false, code: error.code, message: error.message, hint, ms: Date.now() - started },
        { status: 503 },
      );
    }
    return Response.json({ ok: true, schema: 'catalog', ms: Date.now() - started });
  } catch (e) {
    return Response.json(
      { ok: false, message: e?.message || 'unreachable', ms: Date.now() - started },
      { status: 503 },
    );
  }
}
