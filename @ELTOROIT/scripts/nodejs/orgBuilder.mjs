// # Execute using: npm install && npm run createOrg
import OS2 from './lowLevelOs.mjs';
import SFDX from './sfdx.mjs';
import Colors2 from './colors.mjs';
import { parse } from 'jsonc-parser';

const config = {
	errors: [],
	debug: false,
	commands: [],
	deployPage: '/lightning/setup/DeployStatus/home',
	steps: [
		'BeforeOrg_ValidateETCopyData',
		'BeforeOrg_RunJestTests',
		'BeforeOrg_BackupAlias',
		'CreateScratchOrg',
		'BeforePush_PauseToCheckOrg',
		'BeforePush_ShowDeployPage',
		'BeforePush_PrepareOrg',
		'BeforePush_ManualMetadata',
		'BeforePush_ExecuteApex',
		'BeforePush_InstallPackages',
		'PushMetadata',
		'AfterPush_ManualMetadata',
		'AfterPush_ExecuteApex',
		'AfterPush_AssignPermissionSets',
		'AfterPush_DeployAdminProfile',
		'ETCopyData',
		'AfterData_ExecuteApex',
		'AfterData_RunApexTests',
		'AfterData_PublishCommunityName',
		'AfterData_GeneratePassword',
		'DeployToSandbox',
		'ShowFinalSuccess',
	],
};

export default class OrgBuilder {
	root = null;
	sfdx;

	async start() {
		Colors2.clearScreen();
		this.sfdx = new SFDX(config);
		config.root = await OS2.getFullPath({ config, relativePath: '.' });
		await this._readConfigFile();
		await this._restartLogFolder();
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
