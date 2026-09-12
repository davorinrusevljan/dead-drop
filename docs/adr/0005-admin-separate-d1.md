# Admin is a separate app with its own D1 database

`apps/admin` (UI on 3011, API worker on a custom domain, dev API on 9091) has
its own D1 (`dead-drop-admin`) for users/sessions **and** a read binding to
the core D1 (`dead-drop-core`) for stats. Auth is JWT (jose) with
`ADMIN_HASH_PEPPER`; users are bootstrapped via `pnpm bootstrap-admin`.

**Why separate**: admin credentials, rate limits, and blast radius must be
isolated from the public service; a core compromise must not leak admin auth.
**Consequence**: schema changes may need migrations in **two** databases.
