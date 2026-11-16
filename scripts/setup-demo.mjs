import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

try {
  await writeFile('.env.local', `# Local demo only; never commit this file.\nSCA_DEMO_MODE=true\nJWT_SECRET=${randomBytes(48).toString('base64url')}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Demo local configurado en .env.local. El secreto no se muestra.');
} catch (error) {
  if (error.code === 'EEXIST') console.error('Ya existe .env.local. No se modificó; revisa sus variables de forma segura.');
  else console.error('No se pudo crear la configuración local.');
  process.exitCode = 1;
}
