import * as updateNotifier from 'update-notifier';
import * as yargs from 'yargs';
import * as semver from 'semver';

import { initGlobalState } from '../utils/global-state';
import { TransferedRegisterCommand } from '../utils/define';

// Check git repo
// let isGitRepo = false;
// try {
//   if (
//     execSync(`git rev-parse --is-inside-work-tree`)
//       .toString()
//       .trim() === 'true'
//   ) {
//     isGitRepo = true;
//   }
// } catch (error) {
//   isGitRepo = false;
// }
// if (!isGitRepo) {
//   logFatal(`Not a git repo, please run \`git init\` first.`);
// }

export async function createCli(opts?: { pluginIncludeRoots: string[] }) {
  await checkEnvironment();

  const preSelectPackage = (yargs.argv.p as string) || (yargs.argv.package as string);

  await initGlobalState(preSelectPackage);

  const { globalState } = await import('../utils/global-state');
  const { transferCommandsArrayToMap } = await import('../utils/commands');
  const { loadPlugins, plugin } = await import('../utils/plugins');

  await loadPlugins(opts && opts.pluginIncludeRoots);

  const commandRegisterMap = transferCommandsArrayToMap(plugin.commands);

  registerYargs(yargs, commandRegisterMap);

  // eslint-disable-next-line no-unused-expressions
  yargs.alias('help', 'h').alias('version', 'v').argv;

  /**
   * Update notify.
   */
  updateNotifier({ pkg: globalState.priPackageJson as updateNotifier.Package }).notify();
}

function registerYargs(leafYargs: typeof yargs, transferedRegisterCommands: TransferedRegisterCommand[]) {
  transferedRegisterCommands.forEach(commandRegister => {
    leafYargs.command({
      command: commandRegister.name[0],
      describe: commandRegister.description || '',
      aliases: commandRegister.alias,
      builder: childYargs => {
        // Add package options
        childYargs.option('package', {
          description: 'Select package',
          demandOption: false
        });

        if (commandRegister.options) {
          Object.keys(commandRegister.options).forEach(optionName => {
            const optionInfo = commandRegister.options[optionName];
            childYargs.option(optionName, {
              alias: optionInfo.alias,
              description: optionInfo.description,
              demandOption: optionInfo.required
            });
          });
        }

        registerYargs(childYargs, commandRegister.childs);

        return childYargs;
      },
      handler: async argv => {
        if (commandRegister.beforeAction) {
          await commandRegister.beforeAction(argv);
        }

        if (commandRegister.action) {
          await commandRegister.action(argv);
        }

        if (commandRegister.afterAction) {
          await commandRegister.afterAction(argv);
        }
      }
    });
  });
}

async function checkEnvironment() {
  const { logFatal } = await import('../utils/log');

  // Check node version
  if (semver.lte(process.version, '8.0.0')) {
    logFatal(`Nodejs version should be greater than 8, current is ${process.version}`);
  }
}
