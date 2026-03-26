const appJson = require('./app.json');

module.exports = () => {
  const baseConfig = appJson.expo ?? {};
  const requestedWebOutput = process.env.EXPO_WEB_OUTPUT;
  const webOutput = requestedWebOutput === 'static' || requestedWebOutput === 'server'
    ? requestedWebOutput
    : baseConfig.web?.output ?? 'server';
  const reactCompilerEnabled = process.env.EXPO_ENABLE_REACT_COMPILER === 'false'
    ? false
    : (baseConfig.experiments?.reactCompiler ?? false);

  return {
    ...baseConfig,
    web: {
      ...(baseConfig.web ?? {}),
      output: webOutput,
    },
    experiments: {
      ...(baseConfig.experiments ?? {}),
      reactCompiler: reactCompilerEnabled,
    },
  };
};
