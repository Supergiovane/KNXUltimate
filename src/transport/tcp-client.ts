import net from "node:net";

export interface TcpTunnelingOptions {
  host: string;
  port?: number;
  onFrame: (frame: Buffer) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

export class TcpTunnelingClient {
  private socket: net.Socket | null = null;
  private buf = Buffer.alloc(0);
  private readonly opt: TcpTunnelingOptions;

  constructor(opt: TcpTunnelingOptions) {
    this.opt = opt;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = net.createConnection(this.opt.port ?? 3671, this.opt.host);
      this.socket = s;
      s.once("connect", () => resolve());
      s.on("data", (chunk) => this.onData(chunk));
      s.on("error", (e) => this.opt.onError?.(e as Error));
      s.on("close", () => this.opt.onClose?.());
    });
  }

  public send(frame: Buffer): void {
    if (!this.socket) throw new Error("TCP not connected");
    this.socket.write(frame);
  }

  public close(): void {
    try { this.socket?.end(); } catch {}
    this.socket = null;
    this.buf = Buffer.alloc(0);
  }

  private onData(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    // KNXnet/IP frames carry total_length at offset 4 (common profile).
    while (true) {
      if (this.buf.length < 6) return;
      const totalLength = this.buf.readUInt16BE(4);
      if (this.buf.length < totalLength) return;
      const frame = this.buf.subarray(0, totalLength);
      this.buf = this.buf.subarray(totalLength);
      this.opt.onFrame(frame);
    }
  }
}
