import { basename, dirname, isAbsolute, resolve } from 'node:path';

export function resolveConfiguredPath(path: string) {
  if (isAbsolute(path)) return path;
  return resolve(workspaceRoot(), path);
}

function workspaceRoot() {
  const cwd = process.cwd();
  return basename(cwd) === 'server' ? dirname(cwd) : cwd;
}
