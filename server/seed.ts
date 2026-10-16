/* Runner manual: pnpm db:seed — nunca importado pelo arranque do servidor. */
import { seedFateFlow } from "./fateflowSeed";

seedFateFlow()
  .then((r) => {
    console.log(`[seed] ok — ${r.works} works, ${r.routes} routes`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("[seed] falhou:", err?.message ?? err);
    process.exit(1);
  });
