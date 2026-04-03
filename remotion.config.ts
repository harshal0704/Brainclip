import { Config } from "@remotion/cli/config";

// --- Global Rendering Configuration ---
// These settings apply when running `npx remotion render` in the CLI.
// They are specifically optimized for standard GitHub Actions runner constraints.

// Disable Chromium Sandbox for performance boost since this is a controlled ephemeral VM.
Config.setChromiumDisableWebSecurity(true);
Config.setChromiumIgnoreCertificateErrors(true);

// Set the OpenGL renderer to utilize pure CPU rendering without emulating GPU interfaces
Config.setChromiumOpenGlRenderer("swiftshader");

// Optimize webpack build to generate source maps faster
Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    devtool: "eval-cheap-module-source-map",
  };
});
