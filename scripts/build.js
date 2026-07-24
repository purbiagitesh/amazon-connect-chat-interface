'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../configuration/env');


const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const webpack = require('webpack');
const {spawnSync} = require('child_process');
const bfj = require('bfj');
const config = require('../configuration/webpack.config.prod');
const paths = require('../configuration/paths');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const printHostingInstructions = require('react-dev-utils/printHostingInstructions');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const printBuildError = require('react-dev-utils/printBuildError');

const measureFileSizesBeforeBuild =
  FileSizeReporter.measureFileSizesBeforeBuild;
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;
const useYarn = fs.existsSync(paths.yarnLockFile);

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

const isInteractive = process.stdout.isTTY;

function prepareBrandForBuild() {
  const stateFile = path.join(__dirname, '..', '.brand-env');
  if (!fs.existsSync(stateFile)) {
    return;
  }

  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!state.brand || !state.env) {
      return;
    }

    console.log(`Preparing brand assets for build: ${state.brand} (${state.env})`);
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, 'prepare-brand.js'), `--brand=${state.brand}`, `--env=${state.env}`],
      {stdio: 'inherit'}
    );

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  } catch (error) {
    console.warn('Unable to prepare brand assets before build:', error.message);
  }
}

// Regenerates brand-namespaced runtime data for EVERY brand/env (see
// scripts/prepare-brand.js's --all mode) so the production build carries
// every brand's data, not just whichever single brand/env prepareBrandForBuild()
// above last prepared for local dev.
function prepareAllBrandsForBuild() {
  console.log('Preparing brand-assets for ALL brands (production build)...');
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'prepare-brand.js'), '--all'],
    {stdio: 'inherit'}
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

// Copies the pieces that aren't produced by webpack, but still need to ship
// alongside amazon-connect-chat-interface.js for a working deployment:
// every brand's runtime data (brand-assets/) and the self-mounting launcher
// script (launcher/launcher.js -> launcher.js) that Tealium actually injects
// on a brand's site. After this, paths.appBuild is a single, complete,
// deployable folder - upload its contents as-is.
function copyDeployableAssets() {
  const brandAssetsSrc = path.join(__dirname, '..', 'local-testing', 'brand-assets');
  const brandAssetsDest = path.join(paths.appBuild, 'brand-assets');
  if (fs.existsSync(brandAssetsSrc)) {
    fs.copySync(brandAssetsSrc, brandAssetsDest);
    console.log('Copied brand-assets/ into ' + path.relative(process.cwd(), brandAssetsDest));
  }

  const launcherSrc = path.join(__dirname, '..', 'launcher', 'launcher.js');
  const launcherDest = path.join(paths.appBuild, 'launcher.js');
  fs.copySync(launcherSrc, launcherDest);
  console.log('Copied launcher.js into ' + path.relative(process.cwd(), launcherDest));
}

prepareBrandForBuild();
prepareAllBrandsForBuild();

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appIndexJs])) {
  process.exit(1);
}

// Process CLI arguments
const argv = process.argv.slice(2);
const writeStatsJson = argv.indexOf('--stats') !== -1;

// We require that you explicitly set browsers and do not fall back to
// browserslist defaults.
const {checkBrowsers} = require('react-dev-utils/browsersHelper');
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // First, read the current file sizes in build directory.
    // This lets us display how much they changed later.
    return measureFileSizesBeforeBuild(paths.appBuild);
  })
  .then(previousFileSizes => {
    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    fs.emptyDirSync(paths.appBuild);
    // Start the webpack build
    return build(previousFileSizes);
  })
  .then(
    ({stats, previousFileSizes, warnings}) => {
      if (warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nSearch for the ' +
            chalk.underline(chalk.yellow('keywords')) +
            ' to learn more about each warning.'
        );
        console.log(
          'To ignore, add ' +
            chalk.cyan('// eslint-disable-next-line') +
            ' to the line before.\n'
        );
      } else {
        console.log(chalk.green('Compiled successfully.\n'));
      }

      copyDeployableAssets();

      console.log('File sizes after gzip:\n');
      printFileSizesAfterBuild(
        stats,
        previousFileSizes,
        paths.appBuild,
        WARN_AFTER_BUNDLE_GZIP_SIZE,
        WARN_AFTER_CHUNK_GZIP_SIZE
      );
      console.log();

      const appPackage = require(paths.appPackageJson);
      const publicUrl = paths.publicUrl;
      const publicPath = config.output.publicPath;
      const buildFolder = path.relative(process.cwd(), paths.appBuild);
      printHostingInstructions(
        appPackage,
        publicUrl,
        publicPath,
        buildFolder,
        useYarn
      );
    },
    err => {
      console.log(chalk.red('Failed to compile.\n'));
      printBuildError(err);
      process.exit(1);
    }
  )
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });

// Create the production build and print the deployment instructions.
function build(previousFileSizes) {
  console.log('Creating an optimized production build...');

  let compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages;
      if (err) {
        if (!err.message) {
          return reject(err);
        }
        messages = formatWebpackMessages({
          errors: [err.message],
          warnings: [],
        });
      } else {
        messages = formatWebpackMessages(
          stats.toJson({all: false, warnings: true, errors: true})
        );
      }
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (
        process.env.CI &&
        (typeof process.env.CI !== 'string' ||
          process.env.CI.toLowerCase() !== 'false') &&
        messages.warnings.length
      ) {
        console.log(
          chalk.yellow(
            '\nTreating warnings as errors because process.env.CI = true.\n' +
              'Most CI servers set it automatically.\n'
          )
        );
        return reject(new Error(messages.warnings.join('\n\n')));
      }

      const resolveArgs = {
        stats,
        previousFileSizes,
        warnings: messages.warnings,
      };
      if (writeStatsJson) {
        return bfj
          .write(paths.appBuild + '/bundle-stats.json', stats.toJson())
          .then(() => resolve(resolveArgs))
          .catch(error => reject(new Error(error)));
      }

      return resolve(resolveArgs);
    });
  });
}
