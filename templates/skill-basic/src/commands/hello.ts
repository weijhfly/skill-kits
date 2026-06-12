import { notify, writeResult } from "skill-kits/runtime";

export function runHello(message: string) {
  notify(`Received message: ${message}`);
  writeResult({ ok: true, echo: message });
}
