import { join } from "node:path";

const fakeCodeServer = join(import.meta.dir, "../fake-code-server/main.ts");

/** The command that runs the scripted stand-in for code-server (it prints version 4.99.9). */
export const fakeCodeServerCommand = (): string[] => [process.execPath, fakeCodeServer];
