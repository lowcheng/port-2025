import fs from "node:fs";
import net from "node:net";

const [, , commandType, argument] = process.argv;

if (!commandType) {
  throw new Error(
    "Usage: node mcp_socket_client.mjs <command> [params-json-or-code-file]",
  );
}

let params = {};
if (argument) {
  if (commandType === "execute_code") {
    params = { code: fs.readFileSync(argument, "utf8") };
  } else {
    params = JSON.parse(
      fs.existsSync(argument) ? fs.readFileSync(argument, "utf8") : argument,
    );
  }
}

const payload = JSON.stringify({ type: commandType, params });
const socket = net.createConnection({ host: "127.0.0.1", port: 9876 });
let response = "";

socket.setTimeout(180_000);

socket.on("connect", () => {
  socket.write(payload);
});

socket.on("data", (chunk) => {
  response += chunk.toString("utf8");

  try {
    const parsed = JSON.parse(response);
    process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
    socket.end();
  } catch {
    // Keep receiving until the complete JSON response has arrived.
  }
});

socket.on("timeout", () => {
  socket.destroy(new Error("Timed out waiting for Blender MCP response"));
});

socket.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
