export default {
  async scheduled(_event, env, _ctx) {
    const targets = [
      { name: "server", url: env.SERVER_URL + "/health" },
      { name: "worker", url: env.WORKER_URL + "/health" },
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
