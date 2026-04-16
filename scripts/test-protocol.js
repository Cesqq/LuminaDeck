/**
 * LuminaDeck - End-to-End Protocol Test Suite
 *
 * Tests the full WebSocket protocol between client and companion:
 * - Ping/pong heartbeat
 * - Keybind execution
 * - System action execution
 * - App launch validation
 * - Multi-action sequence
 * - Invalid payload rejection
 * - Rate limiting
 * - Pair request/response
 *
 * Usage:
 *   node scripts/test-protocol.js
 *
 * Prerequisites:
 *   - Companion binary running (target/debug/luminadeck-companion.exe)
 *   - Server on wss://localhost:9876 with self-signed cert
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SERVER_URL = "wss://localhost:9876";

let passed = 0;
let failed = 0;

function ts() {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

async function main() {
  console.log(`\n=== LuminaDeck Protocol Test Suite ===`);
  console.log(`Connecting to ${SERVER_URL} ...\n`);

  const ws = new WebSocket(SERVER_URL);

  const responses = [];
  let resolveNext = null;

  function waitForResponse(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (responses.length > 0) {
        resolve(responses.shift());
        return;
      }
      const timer = setTimeout(() => {
        resolveNext = null;
        reject(new Error("Timeout"));
      }, timeoutMs);
      resolveNext = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
    });
  }

  ws.addEventListener("message", (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      data = { raw: event.data };
    }
    if (resolveNext) {
      const cb = resolveNext;
      resolveNext = null;
      cb(data);
    } else {
      responses.push(data);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", (e) => reject(new Error(e.message || "Connection failed")), { once: true });
  });

  console.log(`[${ts()}] Connected.\n`);

  // --- Test 1: Ping ---
  console.log("Test 1: Ping/Pong");
  ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
  const pong = await waitForResponse();
  assert(pong.type === "pong", "Response type is 'pong'");
  assert(typeof pong.timestamp === "number", "Echoed timestamp is number");
  assert(typeof pong.serverTime === "number", "Server time present");
  assert(pong.serverTime > 0, "Server time is positive");
  console.log();

  // --- Test 2: Keybind execution ---
  console.log("Test 2: Keybind Execute (ctrl+c)");
  ws.send(JSON.stringify({
    type: "execute",
    id: "test-kb-1",
    action: { type: "keybind", keys: ["ctrl", "c"] },
  }));
  const kbResp = await waitForResponse();
  assert(kbResp.type === "execute_result", "Response type is execute_result");
  assert(kbResp.id === "test-kb-1", "Echoed message ID matches");
  assert(kbResp.success === true, "Keybind executed successfully");
  console.log();

  // --- Test 3: System action ---
  console.log("Test 3: System Action (volume_up)");
  ws.send(JSON.stringify({
    type: "execute",
    id: "test-sys-1",
    action: { type: "system_action", action: "volume_up" },
  }));
  const sysResp = await waitForResponse();
  assert(sysResp.type === "execute_result", "Response type is execute_result");
  assert(sysResp.success === true, "System action succeeded");
  console.log();

  // --- Test 4: Invalid action type ---
  console.log("Test 4: Invalid Action Type");
  ws.send(JSON.stringify({
    type: "execute",
    id: "test-invalid-1",
    action: { type: "shutdown_all", target: "everything" },
  }));
  const invResp = await waitForResponse();
  assert(invResp.type === "error" || (invResp.type === "execute_result" && !invResp.success),
    "Invalid action rejected");
  console.log();

  // --- Test 5: Invalid key name ---
  console.log("Test 5: Invalid Key Name Rejected");
  ws.send(JSON.stringify({
    type: "execute",
    id: "test-badkey-1",
    action: { type: "keybind", keys: ["cmd.exe"] },
  }));
  const badKeyResp = await waitForResponse();
  assert(badKeyResp.type === "execute_result" && !badKeyResp.success,
    "Invalid key 'cmd.exe' rejected");
  assert(badKeyResp.error && badKeyResp.error.includes("Invalid key"),
    "Error message mentions invalid key");
  console.log();

  // --- Test 6: Pair request ---
  console.log("Test 6: Pair Request");
  ws.send(JSON.stringify({
    type: "pair_request",
    deviceName: "Test iPhone",
    deviceId: "test-device-001",
  }));
  const pairResp = await waitForResponse();
  assert(pairResp.type === "pair_response", "Response type is pair_response");
  assert(pairResp.accepted === true, "Pair request accepted");
  assert(typeof pairResp.companionName === "string", "Companion name returned");
  console.log();

  // --- Test 7: Unknown message type ---
  console.log("Test 7: Unknown Message Type");
  ws.send(JSON.stringify({ type: "unknown_type", data: "test" }));
  const unkResp = await waitForResponse();
  assert(unkResp.type === "error", "Error response for unknown type");
  assert(unkResp.code === "INVALID_ACTION", "Error code is INVALID_ACTION");
  console.log();

  // --- Test 8: Malformed JSON ---
  console.log("Test 8: Malformed JSON");
  ws.send("this is not json {{{");
  const malResp = await waitForResponse();
  assert(malResp.type === "error", "Error response for malformed JSON");
  console.log();

  // --- Test 9: Multi-action ---
  console.log("Test 9: Multi-Action Sequence");
  ws.send(JSON.stringify({
    type: "execute",
    id: "test-multi-1",
    action: {
      type: "multi_action",
      actions: [
        { type: "system_action", action: "volume_up" },
        { type: "keybind", keys: ["space"] },
      ],
      delays: [100],
    },
  }));
  const multiResp = await waitForResponse();
  assert(multiResp.type === "execute_result", "Multi-action response received");
  assert(multiResp.id === "test-multi-1", "Multi-action ID matches");
  assert(multiResp.success === true, "Multi-action succeeded");
  console.log();

  // --- Done ---
  ws.close();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  console.log(`\n=== Results: ${passed} passed, ${failed} failed (+ fatal error) ===\n`);
  process.exit(1);
});
