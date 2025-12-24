const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

const blockList = [
  /[\\/]docs[\\/].*/,
  /[\\/]migrations[\\/].*/,
  /[\\/]supabase[\\/].*/,
  /[\\/]scripts[\\/].*/,
  /[\\/]project-structure\.txt$/,
];

config.resolver.blockList = [...(config.resolver.blockList ?? []), ...blockList];

module.exports = config;
