// Next 16 renamed the `middleware` file convention to `proxy`. next-intl's
// locale router returns a request handler that works as the proxy function.
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except API routes, Next internals, and files with an
  // extension (e.g. favicon.ico).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
