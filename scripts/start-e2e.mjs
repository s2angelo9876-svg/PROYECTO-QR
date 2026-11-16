import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// Test-only secret exists only in this process tree; never written to source or logs.
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3100', '-H', 'localhost'], {
  stdio: 'inherit', env: { ...process.env, SCA_DEMO_MODE: 'true', JWT_SECRET: randomBytes(48).toString('base64url') },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
