# The schema, and keeping this copy honest

`00_live_schema_2026-09-05.sql` is a full dump of the live `catalog` schema:
19 tables, 32 functions, 10 views, 39 row-level-security policies, and the
grants. It was taken on 2026-09-05 from project `vcrzauuxvgpsbforiszz` and
verified column-by-column against `information_schema` — every table matches.

## Why it exists

The catalog repo carried a file saying, correctly, that the real schema lived
only inside the Supabase project. The policies **are** the access control —
the admin panel hiding a tab is presentation, the database is the rule — so
losing the project meant reconstructing the security model by reading HTML and
inferring what it must have been.

That gap is now closed. Keep it closed: **the commit that changes the database
is the commit that updates this file.** A dump with no date is a dump nobody
trusts, so the date is in the filename and at the top of the file.

## Re-taking it

Run these four queries and paste each result into the matching section. They
are read-only.

```sql
-- functions
select string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'catalog';

-- policies
select string_agg('create policy "' || policyname || '" on catalog.' || tablename
  || ' for ' || cmd || coalesce(' to ' || array_to_string(roles, ', '), '')
  || coalesce(' using (' || qual || ')', '')
  || coalesce(' with check (' || with_check || ')', '') || ';',
  E'\n' order by tablename, policyname)
  from pg_policies where schemaname = 'catalog';

-- views
select string_agg('create or replace view catalog.' || viewname || ' as ' || definition,
  E'\n' order by viewname) from pg_views where schemaname = 'catalog';

-- columns, to check the hand-written table DDL still matches
select table_name, string_agg(column_name, ',' order by column_name)
  from information_schema.columns where table_schema = 'catalog'
 group by table_name order by table_name;
```

The table DDL in the dump is written by hand rather than generated, because a
generated `create table` carries no comments and the comments are half the
value. The fourth query is what keeps it truthful.

## What is deliberately not in it

- **`auth.users`** and anything else Supabase owns. Not ours to recreate.
- **Data.** This is the shape. The catalogue lives in
  `lib/catalogue/fallback.json`; the customer list is not something to keep a
  copy of in a repository.
- **Secrets.** The Fast2SMS key and the Send SMS hook secret are edge-function
  secrets. The queries above cannot reach them, and nothing pasted back should
  contain them — check before committing.

## PostgREST has to expose `catalog`

Everything is in `catalog`, not `public`, and PostgREST serves only the schemas
in its `db-schemas` setting. Exposing it takes two steps, and doing only the
first is why this once looked unfixed for a whole round:

```sql
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, catalog';
notify pgrst, 'reload config';   -- picks up the new schema list
notify pgrst, 'reload schema';   -- rebuilds the table cache  <-- easy to miss
```

| Code | Meaning |
|---|---|
| `PGRST106` | the schema itself is not exposed |
| `PGRST205` | schema is fine, the **table cache** is stale |

Set **Settings → API → Exposed schemas** to include `catalog` too, so the
dashboard and the role setting agree — a dashboard change can rewrite
`db_schemas` and drop it, which brings the 404s straight back.

## Open finding: the image bucket is not in step

Checked 2026-09-05, and this **gates serving photos from Supabase Storage**:

| | in the repo | in the `catalog-images` bucket |
|---|---|---|
| photos | 914 | 897 |
| thumbnails | 904 | **0** |
| total | 1,818 | 897 |

900 distinct photo paths are referenced by the catalogue, and every product has
at least one. The bucket is missing 17 photos and every single thumbnail.

The `sync-images.yml` Action in the catalog repo was written to fix exactly
this and only triggers on a push touching `images/**`; there has not been one
since it landed, so it has never actually run. Serving images from the bucket
would today give a grid of broken thumbnails on every dealer's phone.

Resolve this before Phase 2 renders a product grid. Until then the image
helper points at whatever source is known good.
