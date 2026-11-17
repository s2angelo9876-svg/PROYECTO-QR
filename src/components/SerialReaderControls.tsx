"use client";
import { useEffect, useRef, useState } from "react";
import { Cable, Unplug } from "lucide-react";
import { connectSerialReader, type SerialScanner } from "@/lib/serialReaders";
export default function SerialReaderControls({
  scanners,
  onFrame,
  onError,
  enabled,
}: {
  scanners: SerialScanner[];
  onFrame: (id: string, frame: string) => void;
  onError: (message: string) => void;
  enabled: boolean;
}) {
  const connections = useRef(new Map<string, () => Promise<void>>()),
    handlers = useRef({ onFrame, onError }),
    [connected, setConnected] = useState<string[]>([]),
    [busy, setBusy] = useState("");
  useEffect(() => {
    handlers.current = { onFrame, onError };
  }, [onFrame, onError]);
  useEffect(() => {
    const current = connections.current;
    return () => {
      for (const close of current.values()) void close();
      current.clear();
    };
  }, []);
  async function connect(scanner: SerialScanner) {
    setBusy(scanner.id);
    try {
      const stop = await connectSerialReader(
        scanner,
        (frame) => handlers.current.onFrame(scanner.id, frame),
        (message) => {
          handlers.current.onError(message);
          setConnected((s) => s.filter((id) => id !== scanner.id));
          connections.current.delete(scanner.id);
        },
      );
      connections.current.set(scanner.id, stop);
      setConnected((s) => [...s, scanner.id]);
    } catch (e) {
      if ((e as Error).name !== "NotFoundError") onError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function disconnect(id: string) {
    await connections.current.get(id)?.();
    connections.current.delete(id);
    setConnected((s) => s.filter((i) => i !== id));
  }
  const serial = scanners.filter((s) => s.protocol === "SERIAL");
  if (!serial.length) return null;
  return (
    <div className="small-stack spacer">
      <h3>Lectores con canal independiente</h3>
      <p className="muted" style={{ fontSize: 11 }}>
        Cada lector serial utiliza su propio puerto. La compatibilidad del
        modelo debe comprobarse físicamente; los lectores de teclado simultáneos
        comparten un solo flujo.
      </p>
      {serial.map((s) => (
        <div key={s.id} className="row between wrap">
          <span style={{ fontSize: 12 }}>
            Lector {s.id} ·{" "}
            {connected.includes(s.id) ? "Puerto conectado" : "Sin conectar"}
          </span>
          {connected.includes(s.id) ? (
            <button
              className="button secondary"
              onClick={() => void disconnect(s.id)}
            >
              <Unplug size={14} />
              Desconectar
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={!enabled || Boolean(busy)}
              onClick={() => void connect(s)}
            >
              <Cable size={14} />
              Conectar puerto {s.id}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
