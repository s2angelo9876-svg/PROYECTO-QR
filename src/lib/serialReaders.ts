export interface SerialScanner {
  id: string;
  protocol: "HID" | "SERIAL";
  baud_rate: number;
}
export class ReaderFrameParser {
  private buffer = "";
  private last = 0;
  private dropping = false;
  constructor(
    private emit: (value: string) => void,
    private invalid: (message: string) => void,
    private max = 1024,
  ) {}
  feed(chunk: string, at = Date.now()) {
    if ((this.buffer || this.dropping) && at - this.last > 2000) {
      this.buffer = "";
      this.dropping = false;
      this.invalid("Lectura serial incompleta. Vuelve a pasar el carnet.");
    }
    this.last = at;
    for (const char of chunk) {
      if (char === "\r" || char === "\n") {
        if (this.buffer && !this.dropping) {
          const value = this.buffer;
          this.buffer = "";
          this.emit(value);
        }
        this.buffer = "";
        this.dropping = false;
        continue;
      }
      if (this.dropping) continue;
      if (char < " ") {
        this.buffer = "";
        this.dropping = true;
        this.invalid("El lector envió caracteres de control.");
        continue;
      }
      this.buffer += char;
      if (this.buffer.length > this.max) {
        this.buffer = "";
        this.dropping = true;
        this.invalid("Lectura serial demasiado larga.");
      }
    }
  }
}
interface Port {
  readable: ReadableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
}
interface SerialApi {
  requestPort: () => Promise<Port>;
}
export function serialSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}
export async function connectSerialReader(
  scanner: SerialScanner,
  onFrame: (value: string) => void,
  onError: (message: string) => void,
) {
  const api = (navigator as Navigator & { serial?: SerialApi }).serial;
  if (!api)
    throw new Error(
      "Este navegador no admite Web Serial. Usa Chrome o Edge con HTTPS o localhost, o el lector HID único.",
    );
  const port = await api.requestPort();
  await port.open({ baudRate: scanner.baud_rate });
  if (!port.readable) {
    await port.close();
    throw new Error("El dispositivo no ofrece un canal de lectura serial.");
  }
  const reader = port.readable.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true }),
    parser = new ReaderFrameParser(
      (value) =>
        onFrame(
          value.startsWith(`${scanner.id}|`)
            ? value.slice(scanner.id.length + 1)
            : value,
        ),
      onError,
      scanner.id.length + 1026,
    );
  let stopped = false;
  const done = (async () => {
    try {
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if (!stopped)
        onError(
          e instanceof Error ? e.message : "Se desconectó el lector serial.",
        );
    } finally {
      reader.releaseLock();
      await port.close().catch(() => {});
    }
  })();
  return async () => {
    stopped = true;
    await reader.cancel().catch(() => {});
    await done;
  };
}
