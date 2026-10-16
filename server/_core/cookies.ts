import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

export function getSessionCookieOptions(_req: Request): CookieOptions {
  // Secure sempre em HTTPS (VPS/produção). Em http://localhost (dev), o
  // browser recusaria cookies Secure — aí permite-se http-only local.
  const secure = ENV.appUrl ? ENV.appUrl.startsWith("https://") : true;
  return { httpOnly: true, path: "/", sameSite: secure ? "none" : "lax", secure };
}
