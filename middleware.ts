import { proxy } from "./src/proxy";

export const config = {
  matcher: [
    "/((?!api|_next|monitoring|.*\\.[^/]+$).*)",
    "/api/account/:path*",
  ],
};

export default proxy;