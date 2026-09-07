const appJson = require('./app.json');

const STAGING_SUPABASE_REF = 'zhrucqghrqkjyzmupdyy';

function resolveSupabaseProjectRef(url) {
  if (!url) return null;

  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

module.exports = () => {
  const baseConfig = appJson.expo ?? {};
  const requestedVariant = process.env.APP_VARIANT?.trim().toLowerCase();
  const supabaseProjectRef = resolveSupabaseProjectRef(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const isStaging = requestedVariant === 'staging' || (
    requestedVariant !== 'production' && supabaseProjectRef === STAGING_SUPABASE_REF
  );
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
  const baseIosBundleIdentifier = baseConfig.ios?.bundleIdentifier;
  const baseAndroidPackageName = baseConfig.android?.package;
  const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER?.trim()
    || (isStaging && baseIosBundleIdentifier ? `${baseIosBundleIdentifier}.staging` : baseIosBundleIdentifier);
  const androidPackageName = process.env.ANDROID_PACKAGE_NAME?.trim()
    || (isStaging && baseAndroidPackageName ? `${baseAndroidPackageName}.staging` : baseAndroidPackageName);

  return {
    ...baseConfig,
    name: isStaging ? `${baseConfig.name} Staging` : baseConfig.name,
    scheme: isStaging ? 'adhanconnect-staging' : baseConfig.scheme,
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
    extra: {
      ...(baseConfig.extra ?? {}),
      appVariant: isStaging ? 'staging' : 'production',
    },
  };
};
