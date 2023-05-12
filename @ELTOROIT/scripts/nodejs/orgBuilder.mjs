// # Execute using: npm install && npm run createOrg
import OS2 from './lowLevelOs.mjs';
import SFDX from './sfdx.mjs';
import Colors2 from './colors.mjs';
import { parse } from 'jsonc-parser';

const config = {
	errors: [],
	CICD: false,
	debug: false,
	deployPage: '/lightning/setup/DeployStatus/home',
	steps: [
		'RunJest',
		'BackupAlias',
		'CreateScratchOrg',
		'PauseToCheck',
		'OpenDeployPage',
		'PrepareOrg',
		'ManualMetadataBefore',
		'ExecuteApexBeforePush',
		'InstallPackages',
		// Deploy (Do not do a deploy, rather do a push)
		'PushMetadata',
		'ManualMetadataAfter',
		'ExecuteApexAfterPush',
		'AssignPermissionSet',
		'DeployAdminProfile',
		'LoadData',
		'ExecuteApexAfterData',
		'RunApexTests',
		// PushAgain
		// ReassignAlias
		'PublishCommunity',
		'GeneratePassword',
		'DeployToSandbox',
		'QuitSuccess',
	],
};

export default class OrgBuilder {
	root = null;
	sfdx;

	async start() {
		Colors2.clearScreen();
		config.CICD = !!process.env.ET_CICD;
		this.sfdx = new SFDX(config);
		config.root = await OS2.getFullPath({ config, relativePath: '.' });
		await this._readConfigFile();
		await this._restartLogFolder();
		await this.sfdx.validateETCopyData({ config });
		await this.sfdx.processSteps({ config });
	}

	async _readConfigFile() {
		Colors2.writeInstruction({ msg: 'Reading configuration file' });
		let configFileName = await OS2.getFullPath({ config, relativePath: './@ELTOROIT/scripts/nodejs/orgBuilder.jsonc' });
		let configJSONC = await OS2.readFile({ config, path: configFileName });
		config.SFDX = parse(configJSONC);
	}

	async _restartLogFolder() {
		config.rootLogs = './etLogs';
		await OS2.recreateFolder({ config, path: config.rootLogs });
	}
}

let ob = new OrgBuilder();
ob.start();
