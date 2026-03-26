const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function projectPathPattern(...segments) {
  const resolved = path.resolve(__dirname, ...segments);
  const normalized = resolved.split(path.sep).map(escapeRegExp).join('[\\\\/]');
  return new RegExp(`^${normalized}(?:[\\\\/].*)?$`);
}

const blockList = [
  projectPathPattern('dist'),
  projectPathPattern('docs'),
  projectPathPattern('migrations'),
  projectPathPattern('supabase'),
  projectPathPattern('scripts'),
  projectPathPattern('project-structure.txt'),
];

config.resolver.blockList = [...(config.resolver.blockList ?? []), ...blockList];

module.exports = config;
