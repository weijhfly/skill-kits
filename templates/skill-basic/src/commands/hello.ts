import { notify, writeResult } from "skill-kits/runtime";

export function runHello(message: string) {
  notify(`收到消息：${message}`);
  writeResult({ ok: true, echo: message });
}
