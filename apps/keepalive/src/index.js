export default {
  async scheduled(_event, env, _ctx) {
    const targets = [
      { name: "server", url: env.SERVER_URL + "/health" },
      // The worker has no public hostname — Caddy proxies its health server
      // under the API domain, so ping that route rather than a worker.* host.
      { name: "worker", url: env.SERVER_URL + "/worker-health" },
    ];

    await Promise.all(
      targets.map(async ({ name, url }) => {
        try {
          const res = await fetch(url);
          console.log(`keepalive [${name}]: ${res.status}`);
        } catch (e) {
          console.error(`keepalive [${name}] failed: ${e.message}`);
        }
      }),
    );
  },
};
