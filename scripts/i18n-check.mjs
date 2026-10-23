#!/usr/bin/env node
// Translation gate: the three languages carry the same keys, none is empty, and every literal key
// used in the source (`'key' | transloco`, `.t('key')`) exists. Dynamic keys (`'role.' + x`) are
// covered by their key family existing in all languages.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LANGUAGES = ['pt-BR', 'en-US', 'es-ES'];
const root = new URL('..', import.meta.url).pathname;
const errors = [];

const dictionaries = Object.fromEntries(
  LANGUAGES.map((language) => {
    const file = join(root, 'public', 'i18n', `${language}.json`);
    return [language, JSON.parse(readFileSync(file, 'utf8'))];
  }),
);

const reference = new Set(Object.keys(dictionaries['en-US']));
for (const language of LANGUAGES) {
  const keys = new Set(Object.keys(dictionaries[language]));
  for (const key of reference) if (!keys.has(key)) errors.push(`${language}: missing key "${key}"`);
  for (const key of keys) if (!reference.has(key)) errors.push(`${language}: extra key "${key}"`);
  for (const [key, value] of Object.entries(dictionaries[language])) {
    if (typeof value !== 'string' || !value.trim()) errors.push(`${language}: empty value "${key}"`);
  }
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

const usage = [/'([a-z][\w-]*(?:\.[\w-]+)+)'\s*\|\s*transloco/g, /\.t\(\s*'([a-z][\w-]*(?:\.[\w-]+)+)'/g];
const navKeys = /label: '([a-z][\w-]*(?:\.[\w-]+)+)'|title: '([a-z][\w-]*(?:\.[\w-]+)+)'/g;
for (const file of sourceFiles(join(root, 'src', 'app'))) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of [...usage, navKeys]) {
    for (const match of text.matchAll(pattern)) {
      const key = match[1] ?? match[2];
      if (!reference.has(key)) errors.push(`${file.slice(root.length)}: unknown key "${key}"`);
    }
  }
}

if (errors.length) {
  console.error(`i18n check failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`i18n check passed: ${reference.size} keys in ${LANGUAGES.join(', ')}.`);
