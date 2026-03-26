/// <reference types="@cloudflare/workers-types" />

declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET: string;
    DATABASE_PATH: string;
  }
}

// Cloudflare Worker bindings
interface CloudflareEnv {
  ADMIN_DB: D1Database;
  CORE_DB: D1Database;
  JWT_SECRET: string;
}
