// # Execute using: npm install && npm run createOrg
import Logs2 from './logs.js';
import OS2 from './lowLevelOs.js';
import Colors2 from './colors.js';
import { parse } from 'jsonc-parser';

const config = {
	errors: [],
	debug: true,
	verbose: true,
	resultsTofile: true,
	checkUrlExists: true,
	executeManualChecks: false,
	steps: [
		// No parameters sent, then do everything
		'mainRunJest',
		'mainBackupAlias',
		'mainCreateScratchOrg',
		'mainPauseToCheck',
		'mainOpenDeployPage',
		'mainPrepareOrg',
		'mainManualMetadataBefore',
		'mainExecuteApexBeforePush',
		'mainInstallPackages',
		// mainDeploy (Do not do a deploy, rather do a push)
		'mainPushMetadata',
		'mainManualMetadataAfter',
		'mainExecuteApexAfterPush',
		'mainAssignPermissionSet',
		'mainDeployAdminProfile',
		'mainLoadData',
		'mainExecuteApexAfterData',
		'mainRunApexTests',
		// mainPushAgain
		// mainReassignAlias
		'mainPublishCommunity',
		'mainGeneratePassword',
		'mainDeployToSandbox',
		'QuitSuccess',
	],
};

export default class OrgBuilder {
	root = null;

	async start() {
		Colors2.clearScreen();
		this.root = await OS2.getFullPath({ config, relativePath: '.' });
		await this._validateETCopyData();
		await this._readConfigFile();
	}

	async _validateETCopyData() {
		Colors2.writeInstruction({ msg: 'Validating ETCopyData' });
		let output = await OS2.execute({ config, command: 'sfdx plugins --core' });
		let plugins = output.stdout.split('\n');
		let etcd = plugins.filter((plugin) => plugin.startsWith('etcopydata'));
		if (etcd.length !== 1) {
			let msg = 'Could not find plugin for ETCopyData installed';
			Logs2.reportErrorMessage({ config, msg });
			throw new Error(msg);
		} else {
			Colors2.success({ msg: etcd[0] });
		}
	}

	async _readConfigFile() {
		Colors2.writeInstruction({ msg: 'Reading configuration file' });
		let configFileName = await OS2.getFullPath({ config, relativePath: './@ELTOROIT/scripts/nodejs/orgBuilder.jsonc' });
		let configJSONC = await OS2.readFile({ config, path: configFileName });
		config.SFDX = parse(configJSONC);
	}
}

let ob = new OrgBuilder();
ob.start();
