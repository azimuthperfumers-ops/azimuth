export default {
  async scheduled(_event, env, _ctx) {
    try {
      const res = await fetch(env.SERVER_URL + "/health");
      console.log(`keepalive: ${res.status}`);
    } catch (e) {
      console.error(`keepalive failed: ${e.message}`);
    }
  },
};
