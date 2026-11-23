import { runSsh, runSshOrFail, type SshDestination } from "./ssh-run.ts";
import { remoteWord } from "./ssh-quote.ts";

async function sha256Of(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

/** The checksum of the file already on the host, if there is one. */
async function installedChecksum(destination: SshDestination, remotePath: string): Promise<string> {
  const file = remoteWord(remotePath);
  const script = `sha256sum ${file} 2>/dev/null || shasum -a 256 ${file} 2>/dev/null`;
  const result = await runSsh({ destination, script });
  return result.stdout.trim().split(/\s+/)[0] ?? "";
}

/**
 * Stores the file on the host at `remotePath`: written beside it first and renamed into place, so a
 * relay that is running or starting never sees half a file.
 */
async function upload(options: {
  destination: SshDestination;
  localPath: string;
  remotePath: string;
}): Promise<void> {
  const { destination, localPath, remotePath } = options;
  const final = remoteWord(remotePath);
  const part = remoteWord(`${remotePath}.${crypto.randomUUID().slice(0, 8)}.part`);
  const folder = remoteWord(remotePath.slice(0, remotePath.lastIndexOf("/")));
  const script = `mkdir -p ${folder} && cat > ${part} && chmod 755 ${part} && mv -f ${part} ${final}`;
  await runSshOrFail({ destination, script, input: Bun.file(localPath) });
}

/** Copies the relay binary to the host unless an identical one is already there. */
export async function installRelayBinary(options: {
  destination: SshDestination;
  localPath: string;
  remotePath: string;
}): Promise<{ installed: boolean }> {
  const { destination, localPath, remotePath } = options;
  if ((await installedChecksum(destination, remotePath)) === (await sha256Of(localPath))) {
    return { installed: false };
  }
  await upload(options);
  return { installed: true };
}
