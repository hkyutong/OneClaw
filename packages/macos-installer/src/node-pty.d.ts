declare module "@lydell/node-pty" {
  export interface IPty {
    readonly pid: number;
    readonly process: string;
    write(data: string | Buffer): void;
    kill(signal?: string): void;
    resize(columns: number, rows: number): void;
    onData(listener: (data: string) => void): { dispose(): void };
    onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void };
  }

  export function spawn(
    file: string,
    args: string[] | string,
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string | undefined>;
    },
  ): IPty;
}
