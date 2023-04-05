import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import sanitize from 'sanitize-filename';

import { adjustCanvas, createFolder, parseImage, errorSerialize } from './utils';
import { getValueOrDefault } from './utils-browser';

let CYPRESS_SCREENSHOT_DIR: string;

interface MoveSnapshotArgs {
  fromPath: string;
  specDirectory: string;
  fileName: string;
}

/** Move the generated snapshot .png file to its new path.
 * The target path is constructed from parts at runtime in node to be OS independent.  */
async function moveSnapshot(args: MoveSnapshotArgs) {
  const { fromPath, specDirectory, fileName } = args;
  const destDir = path.join(CYPRESS_SCREENSHOT_DIR, specDirectory);
  const destFile = path.join(destDir, fileName);

  return createFolder(destDir, false)
    .then(() => fsp.rename(fromPath, destFile))
    .then(() => null);
}

interface UpdateSnapshotArgs {
  name: string;
  screenshotsFolder?: string;
  snapshotBaseDirectory?: string;
  specDirectory: string;
}

/** Update the base snapshot .png by copying the generated snapshot to the base snapshot directory.
 * The target path is constructed from parts at runtime in node to be OS independent.  */
async function updateSnapshot(args: UpdateSnapshotArgs) {
  const { name, screenshotsFolder, snapshotBaseDirectory, specDirectory } = args;
  const toDir = getValueOrDefault(snapshotBaseDirectory, path.join(process.cwd(), 'cypress', 'snapshots', 'base'));
  const snapshotActualDirectory = getValueOrDefault(screenshotsFolder, 'cypress/screenshots');

  const destDir = path.join(toDir, specDirectory);
  const fromPath = path.join(snapshotActualDirectory, specDirectory, `${name}.png`);

  const destFile = path.join(destDir, `${name}.png`);

  return createFolder(destDir, false)
    .then(() => fsp.copyFile(fromPath, destFile))
    .then(() => null);
}

interface CompareSnapshotsPluginArgs {
  failSilently?: boolean;
  baseDir?: string;
  diffDir?: string;
  keepDiff?: boolean;
  allowVisualRegressionToFail?: boolean;
  fileName: string;
  errorThreshold: number;
  specDirectory: string;
}

/** Cypress plugin to compare image snapshots & generate a diff image.
 *
 * Uses the pixelmatch library internally.
 */
async function compareSnapshotsPlugin(args: CompareSnapshotsPluginArgs) {
  const snapshotBaseDirectory = getValueOrDefault(
    args.baseDir,
    path.join(process.cwd(), 'cypress', 'snapshots', 'base')
  );
  const snapshotDiffDirectory = getValueOrDefault(
    args.diffDir,
    path.join(process.cwd(), 'cypress', 'snapshots', 'diff')
  );
  const alwaysGenerateDiff = !(args.keepDiff === false);
  const allowVisualRegressionToFail = args.allowVisualRegressionToFail === true;

  const fileName = sanitize(args.fileName);

  const options = {
    actualImage: path.join(CYPRESS_SCREENSHOT_DIR, args.specDirectory, `${fileName}.png`),
    expectedImage: path.join(snapshotBaseDirectory, args.specDirectory, `${fileName}.png`),
    diffImage: path.join(snapshotDiffDirectory, args.specDirectory, `${fileName}.png`),
  };

  let mismatchedPixels = 0;
  let percentage = 0;
  try {
    await createFolder(snapshotDiffDirectory, args.failSilently);
    const imgExpected = await parseImage(options.expectedImage);
    const imgActual = await parseImage(options.actualImage);
    const diff = new PNG({
      width: Math.max(imgActual.width, imgExpected.width),
      height: Math.max(imgActual.height, imgExpected.height),
    });

    const imgActualFullCanvas = adjustCanvas(imgActual, diff.width, diff.height);
    const imgExpectedFullCanvas = adjustCanvas(imgExpected, diff.width, diff.height);

    mismatchedPixels = pixelmatch(
      imgActualFullCanvas.data,
      imgExpectedFullCanvas.data,
      diff.data,
      diff.width,
      diff.height,
      { threshold: 0.1 }
    );
    percentage = (mismatchedPixels / diff.width / diff.height) ** 0.5;

    if (percentage > args.errorThreshold) {
      const specFolder = path.join(snapshotDiffDirectory, args.specDirectory);
      await createFolder(specFolder, args.failSilently);
      diff.pack().pipe(fs.createWriteStream(options.diffImage));
      if (!allowVisualRegressionToFail)
        throw new Error(
          `The "${fileName}" image is different. Threshold limit exceeded! \nExpected: ${args.errorThreshold} \nActual: ${percentage}`
        );
    } else if (alwaysGenerateDiff) {
      const specFolder = path.join(snapshotDiffDirectory, args.specDirectory);
      await createFolder(specFolder, args.failSilently);
      diff.pack().pipe(fs.createWriteStream(options.diffImage));
    }
  } catch (error) {
    return { error: errorSerialize(error as Error) };
  }
  return {
    mismatchedPixels,
    percentage,
  };
}

interface PluginConfig extends Cypress.PluginConfig {
  snapshotActualDirectory: string;
}

/** Install plugin to compare snapshots.
 * (Also installs an internally used plugin to move snapshot files). */
function getCompareSnapshotsPlugin(on: Cypress.PluginEvents, config: PluginConfig): void {
  setupScreenshotPath(config);
  on('task', {
    compareSnapshotsPlugin,
    moveSnapshot,
    updateSnapshot,
  });
}

function setupScreenshotPath(config: PluginConfig) {
  // use cypress default path as fallback
  CYPRESS_SCREENSHOT_DIR = getValueOrDefault(config?.snapshotActualDirectory, 'cypress/screenshots');
}

export default getCompareSnapshotsPlugin;