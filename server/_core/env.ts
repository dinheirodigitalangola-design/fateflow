// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get appId() { return process.env.MANUS_PROJECT_ID ?? ""; },
  get cookieSecret() { return process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
  // --- FateFlow auth própria (Google OAuth, sem Manus) ---
  /** Base pública da app, ex: https://fateflow.exemplo.com. Usada no redirect_uri e cookies. */
  get appUrl() { return (process.env.APP_URL ?? "").replace(/\/+$/, ""); },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID ?? ""; },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ""; },
  /** Segredo HS256 das sessões (≥32 bytes aleatórios). Nunca commitar o valor real. */
  get sessionSecret() { return process.env.SESSION_SECRET ?? ""; },
};
