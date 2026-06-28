const appJson = require('./app.json');

module.exports = () => {
  const baseConfig = appJson.expo ?? {};
  const requestedWebOutput = process.env.EXPO_WEB_OUTPUT;
  const webOutput = requestedWebOutput === 'static' || requestedWebOutput === 'server'
    ? requestedWebOutput
    : baseConfig.web?.output ?? 'server';
  const requestedReactCompiler = process.env.EXPO_ENABLE_REACT_COMPILER?.trim();
  const isProductionBuild = process.env.EAS_BUILD === 'true' || process.env.NODE_ENV === 'production';
  const reactCompilerEnabled = requestedReactCompiler === 'true'
    ? true
    : requestedReactCompiler === 'false'
      ? false
      : isProductionBuild
        ? (baseConfig.experiments?.reactCompiler ?? false)
        : false;
  const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER?.trim();
  const androidPackageName = process.env.ANDROID_PACKAGE_NAME?.trim();

  return {
    ...baseConfig,
    ios: {
      ...(baseConfig.ios ?? {}),
      ...(iosBundleIdentifier ? { bundleIdentifier: iosBundleIdentifier } : {}),
    },
    android: {
      ...(baseConfig.android ?? {}),
      ...(androidPackageName ? { package: androidPackageName } : {}),
    },
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
