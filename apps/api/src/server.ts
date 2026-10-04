// Optional standalone dev server. In the cloud the API runs inside Next.js under /api (D-003).
import { buildApp } from "./app";

const port = Number(process.env.API_PORT ?? 4000);
const app = await buildApp({ logger: true });
await app.listen({ port, host: "0.0.0.0" });
