import { createBridgeServer } from "./bridge.js";

const port = Number(process.env.PORT ?? 8090);
createBridgeServer().listen(port, () => {
  console.log(`[voice-bridge] listening on :${port} (ws path /twilio, health /health)`);
});
