import "dotenv/config";

import { app } from "./app";
import { env } from "./lib/env";

app.get("/health", (_req, res) => res.json({ health: "ok" }));

app.listen(env.PORT, () => {
  console.log(`server listening on http://localhost:${env.PORT}`);
});
