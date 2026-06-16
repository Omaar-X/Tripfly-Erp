import { spawn, spawnSync } from 'node:child_process';

const mode = process.argv[2];
const validModes = new Set(['build', 'start']);

if (!validModes.has(mode)) {
  console.error('Usage: node scripts/railway-service.mjs <build|start>');
  process.exit(1);
}

const hasAny = (...keys) => keys.some((key) => Boolean(process.env[key]));
const serviceType = (process.env.SERVICE_TYPE || process.env.RAILWAY_SERVICE_TYPE || '').toLowerCase();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function resolveCommand(command, args) {
  if (command === 'npm' && process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
      shell: false
    };
  }

  return {
    command: command === 'npm' ? npmCommand : command,
    args,
    shell: process.platform === 'win32' && command === 'npm'
  };
}

function inferService() {
  if (['backend', 'api', 'server'].includes(serviceType)) return 'backend';
  if (['frontend', 'web', 'client'].includes(serviceType)) return 'frontend';

  if (hasAny('MYSQLHOST', 'MYSQL_URL', 'DATABASE_URL', 'DB_HOST')) return 'backend';
  if (hasAny('VITE_API_URL')) return 'frontend';

  return undefined;
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const child = spawn(resolved.command, resolved.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: resolved.shell
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`Command terminated by ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
}

function runChecked(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: resolved.shell
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

const service = inferService();

if (mode === 'build') {
  if (service) {
    run('npm', ['run', `build:${service}`]);
  } else {
    console.log('No service type detected; building both backend and frontend.');
    runChecked('npm', ['run', 'build:backend']);
    runChecked('npm', ['run', 'build:frontend']);
  }
} else {
  if (!service) {
    console.error('Could not infer Railway service type. Set SERVICE_TYPE=backend or SERVICE_TYPE=frontend, or configure Railway root directory to /backend or /frontend.');
    process.exit(1);
  }

  run('npm', ['run', `start:${service}`]);
}
