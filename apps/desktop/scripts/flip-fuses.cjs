const { join } = require('node:path');
const { FuseV1Options, FuseVersion, flipFuses } = require('@electron/fuses');

exports.default = async ({ appOutDir, electronPlatformName, packager }) => {
  const name = packager.appInfo.productFilename;
  const binary = {
    darwin: `${name}.app`,
    win32: `${name}.exe`,
    linux: packager.executableName,
  }[electronPlatformName];
  await flipFuses(join(appOutDir, binary), {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: process.env.MIMIK_INSPECTABLE === '1',
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
};
