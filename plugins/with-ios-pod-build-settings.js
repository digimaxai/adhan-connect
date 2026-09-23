const { withPodfile } = require('expo/config-plugins');

const DEFAULT_DEPLOYMENT_TARGET = '15.1';
const MARKER = '# Adhan Connect: align every CocoaPods target with the app deployment target.';

module.exports = function withIosPodBuildSettings(config, options = {}) {
  const deploymentTarget = options.deploymentTarget ?? DEFAULT_DEPLOYMENT_TARGET;

  if (!/^\d+\.\d+$/.test(deploymentTarget)) {
    throw new Error(`Invalid iOS deployment target: ${deploymentTarget}`);
  }

  return withPodfile(config, (podfileConfig) => {
    const podfile = podfileConfig.modResults.contents;

    if (podfile.includes(MARKER)) {
      return podfileConfig;
    }

    const postInstallCall = /(  post_install do \|installer\|\n\s+react_native_post_install\([\s\S]*?\n\s{4}\)\n)/;
    const match = podfile.match(postInstallCall);

    if (!match) {
      throw new Error('Unable to locate react_native_post_install in the generated iOS Podfile');
    }

    const deploymentTargetOverride = `${match[1]}
    ${MARKER}
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |build_configuration|
        current_target = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current_target.nil? || Gem::Version.new(current_target) < Gem::Version.new('${deploymentTarget}')
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
        end

        # fmt 11's C++20 consteval path does not compile with Apple Clang in Xcode 27.
        if pod_target.name == 'fmt'
          build_configuration.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;

    podfileConfig.modResults.contents = podfile.replace(match[1], deploymentTargetOverride);
    return podfileConfig;
  });
};
