import Logs2 from './logs.mjs';
import Colors2 from './colors.mjs';
import OS2 from './lowLevelOs.mjs';
import ET_Asserts from './etAsserts.mjs';

export default class SFDX {
	async processSteps({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });

		const reportError = () => {
			Logs2.reportErrorMessage({ config, msg: `${config.currentStep} failed` });
			if (config.settings.QuitOnErrors) {
				Logs2.reportErrorMessage({ config, msg: '' });
				Logs2.reportErrorMessage({ config, msg: '' });
				Logs2.reportErrorMessage({ config, msg: '' });
				Logs2.reportErrorMessage({ config, msg: 'QuitOnErrors is set to true, aborting process!' });
				Logs2.reportErrorMessage({ config, msg: '' });
				Logs2.reportErrorMessage({ config, msg: '' });
				Logs2.reportErrorMessage({ config, msg: '' });
				process.exit(-1);
			}
		};

		for (const step of config.steps) {
			config.stepNumber++;
			if (typeof step === 'string') {
				if (this[step]) {
					try {
						await this[step]({ config });
					} catch (ex) {
						reportError();
					}
				} else {
					Logs2.reportErrorMessage({ config, msg: `${config.stepNumber}: ${step}` });
					Logs2.reportErrorMessage({ config, msg: `*** *** *** *** NOT IMPLEMENTED: ${step}` });
					debugger;
				}
			} else {
				const keys = Object.keys(step);

				// Validate entry
				let message = `Step #${config.stepNumber} ${JSON.stringify(keys)} should have one and only one key`;
				try {
					ET_Asserts.equals({ expected: 1, actual: keys.length, message });
				} catch (ex) {
					Logs2.reportErrorMessage({ config, msg: message });
					process.exit(-1);
				}

				const key = keys[0];
				const data = step[key];
				if (this[key]) {
					try {
						await this[key]({ config, data });
					} catch (ex) {
						reportError();
					}
				} else {
					Logs2.reportErrorMessage({ config, msg: `${config.stepNumber}: ${keys[0]}` });
					Logs2.reportErrorMessage({ config, msg: `*** *** *** *** NOT IMPLEMENTED: ${step}` });
					debugger;
				}
			}
		}
	}

	//#region STEPS
	async ValidateETCopyData({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const { stepNumber, stepMethod } = this.getStepId({ config });
		config.currentStep = `${stepNumber}. ${stepMethod}`;
		command = 'sfdx plugins';
		logFile = `${stepNumber}_${stepMethod}.json`;
		let result = await this._runSFDX({ config, command, logFile });

		// Process results
		let plugins = result.STDOUT.split('\n');
		let etcd = plugins.filter((plugin) => plugin.startsWith('etcopydata'));
		if (etcd.length !== 1) {
			let msg = 'Could not find plugin for ETCopyData installed';
			Logs2.reportErrorMessage({ config, msg });
			throw new Error(msg);
			// process.exit(-1);
		} else {
			Colors2.sfdxShowNote({ msg: etcd[0] });
		}
	}

	async RunJestTests({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const { stepNumber, stepMethod } = this.getStepId({ config });
		config.currentStep = `${stepNumber}. ${stepMethod}`;
		command = 'node node_modules/@salesforce/sfdx-lwc-jest/bin/sfdx-lwc-jest';
		logFile = `${stepNumber}_${stepMethod}.json`;
		await this._runAndLog({ config, command, logFile });
	}

	async BackupAlias({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const { stepNumber, stepMethod } = this.getStepId({ config });
		config.currentStep = `${stepNumber}a. ${stepMethod} (Find orgs)`;
		command = 'sf alias list --json';
		logFile = `${stepNumber}a_${stepMethod}.json`;
		let result = await this._runSFDX({ config, command, logFile });

		// Process results
		let orgs = JSON.parse(result.STDOUT).result;
		let org = orgs.find((org) => org.alias === config.settings.alias);
		if (org) {
			config.currentStep = `${stepNumber}a. ${stepMethod} (Create backup alias)`;
			command = `sf alias set ${config.settings.alias}.${new Date().toJSON().replaceAll('-', '').replaceAll(':', '').split('.')[0].slice(0, 13)}="${org.value}" --json`;
			logFile = `${stepNumber}b_${stepMethod}.json`;
			await this._runSFDX({ config, command, logFile });
		}
	}

	async CreateScratchOrg({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const { stepNumber, stepMethod } = this.getStepId({ config });
		config.currentStep = `${stepNumber}a. ${stepMethod} (Create new org)`;
		command = `sf org create scratch --definition-file="config/project-scratch-def.json" --set-default --alias="${config.settings.alias}" --duration-days="${config.settings.days}" --json`;
		logFile = `${stepNumber}a_${stepMethod}.json`;
		await this._runSFDX({ config, command, logFile });

		config.currentStep = `${stepNumber}b. ${stepMethod} (Set as default)`;
		command = `sf config set target-org="${config.settings.alias}" --json`;
		logFile = `${stepNumber}b_${stepMethod}.json`;
		await this._runSFDX({ config, command, logFile });
	}

	async CreateFinestDebugLevel({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		let values = '';
		values += 'DeveloperName=FINEST ';
		values += 'MasterLabel=FINEST ';
		values += 'Database=FINEST ';
		values += 'Callout=FINEST ';
		values += 'ApexCode=FINEST ';
		values += 'Validation=FINEST ';
		values += 'Workflow=FINEST ';
		values += 'ApexProfiling=FINEST ';
		values += 'Visualforce=FINEST ';
		values += 'System=FINEST ';
		values += 'Wave=FINEST ';
		values += 'Nba=FINEST ';

		const { stepNumber, stepMethod } = this.getStepId({ config });
		config.currentStep = `${stepNumber}. ${stepMethod}`;
		command = `sf data create record --use-tooling-api --sobject=DebugLevel --values="${values}" --json`;
		logFile = `${stepNumber}_${stepMethod}.json`;
		await this._runSFDX({ config, command, logFile });
	}

	async PauseToCheckOrg({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const { stepNumber, stepMethod } = this.getStepId({ config });
		config.currentStep = `${stepNumber}. ${stepMethod}`;
		command = 'sf org open --json';
		if (config.settings.UserOnScreen) {
			logFile = `${stepNumber}_${stepMethod}.json`;
			await this._runSFDX({ config, command, logFile });
			let result = await Logs2.promptYesNo({ config, question: 'Was the org created succesfully?' });
			if (!result) {
				throw new Error(`${config.currentStep} failed`);
			}
		} else {
			Colors2.sfdxShowStatus({ status: '' });
			Colors2.sfdxShowStatus({ status: config.currentStep });
			Colors2.sfdxShowCommand({ command });
			this._skipBecauseCICD({ config });
		}
	}

	async ShowDeployPage({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const { stepNumber, stepMethod } = this.getStepId({ config });
		config.currentStep = `${stepNumber}. ${stepMethod}`;
		command = `sf org open --path="${config.deployPage}" --json`;
		logFile = `${stepNumber}_${stepMethod}.json`;
		await this._runSFDX({ config, command, logFile });
	}

	async PrepareOrg({ config, data }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: data, message: 'data' });

		const { stepNumber, stepMethod } = this.getStepId({ config });
		await this._runSFDXArray({
			config,
			data,
			stepNumber,
			stepMethod,
			commandMaker: ({ stepData }) => `sfdx project deploy start --source-dir="${stepData}" --wait=30 --verbose --json`,
		});
	}

	async ManualMetadata({ config, data }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: data, message: 'data' });

		const { stepNumber, stepMethod } = this.getStepId({ config });
		await this._runSFDXArray({
			config,
			data,
			stepNumber,
			stepMethod,
			commandMaker: ({ stepData }) => `sf org open --path="${stepData}" --json`,
		});
		if (config.settings.UserOnScreen) {
			let result = await Logs2.promptYesNo({ config, question: 'Did you complete the manual steps on every page?' });
			if (!result) {
				throw new Error(`${config.currentStep} failed`);
			}
		} else {
			this._skipBecauseCICD({ config });
		}
	}

	async ExecuteApex({ config, data }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: data, message: 'data' });

		const { stepNumber, stepMethod } = this.getStepId({ config });
		await this._runSFDXArray({
			config,
			data,
			stepNumber,
			stepMethod,
			commandMaker: ({ stepData }) => `sf apex run -f "${stepData}" --json`,
		});
	}

	async InstallPackages({ config, data }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: data, message: 'data' });

		const { stepNumber, stepMethod } = this.getStepId({ config });
		await this._runSFDXArray({
			config,
			data,
			stepNumber,
			stepMethod,
			commandMaker: ({ stepData }) => {
				debugger;
				const key = stepData.key ? ` --installation-key="${stepData.key}" ` : '';
				return `sf package install --apex-compile=all --package "${stepData.id}" ${key} --wait=30 --no-prompt --json`;
			},
		});
	}

	//
	/*



	


	async PushMetadata({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const stepNumber = '11';
		config.currentStep = `${stepNumber}. Push metadata`;
		command = 'sfdx project deploy start --ignore-conflicts --wait=30 --json';
		logFile = `${stepNumber}_PushMetadata.json`;
		await this._runSFDX({ isGoingToRun: config.SFDX.PushMetadata, config, command, logFile });
	}

	async AfterPush_PrepareOrg({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		const stepNumber = '12';
		config.currentStep = `${stepNumber}. Prepare the org after push`;
		commandParts = {
			pre: 'sfdx project deploy start --source-dir="',
			post: '" --wait=30 --verbose --json',
		};
		logFileParts = {
			step: stepNumber,
			pre: 'AfterPush_PrepareOrg',
			post: '.json',
		};
		listValues = config.SFDX.AfterPush_PrepareOrg;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	async AfterPush_ManualMetadata({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		const stepNumber = '13';
		config.currentStep = `${stepNumber}. Open pages to manually configure org after push`;
		commandParts = {
			pre: 'sf org open --path="',
			post: '" --json',
		};
		logFileParts = {
			step: stepNumber,
			pre: 'AfterPush_ManualMetadata',
			post: '.json',
		};
		listValues = config.SFDX.AfterPush_ManualMetadata;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
		if (isGoingToRun) {
			if (config.SFDX.UserOnScreen) {
				let result = await Logs2.promptYesNo({ config, question: 'Did you complete the manual steps on every page?' });
				if (!result) {
					throw new Error(`${config.currentStep} failed`);
				}
			} else {
				this._skipBecauseCICD({ config });
			}
		}
	}

	async AfterPush_ExecuteApex({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		const stepNumber = '14';
		config.currentStep = `${stepNumber}. Execute Apex Anonymous code after push`;
		commandParts = {
			pre: 'sf apex run --file="',
			post: '" --json',
		};
		logFileParts = {
			step: stepNumber,
			pre: 'AfterPush_ExecuteApex',
			post: '.json',
		};
		listValues = config.SFDX.AfterPush_ExecuteApex;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	async AfterPush_AssignPermissionSets({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		const stepNumber = '15';
		config.currentStep = `${stepNumber}. Assign permission sets to your user`;
		commandParts = {
			pre: 'sf force user permset assign --perm-set-name="',
			post: '" --json',
		};
		logFileParts = {
			step: stepNumber,
			pre: 'AfterPush_AssignPermissionSets',
			post: '.json',
		};
		listValues = config.SFDX.AfterPush_AssignPermissionSets;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	async AfterPush_DeployAdminProfile({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const stepNumber = '16';
		config.currentStep = `${stepNumber}. Deploy "Admin" standard profile`;
		command = `sfdx project deploy start --source-dir="${config.SFDX.AfterPush_DeployAdminProfile}" --ignore-conflicts --wait=30 --verbose --json`;
		logFile = `${stepNumber}_AfterPush_DeployAdminProfile.json`;

		// Move .forceignore (hide it)
		let errors = [];
		const pathOriginal = '.forceignore';
		const pathHidden = 'etLogs/.forceignore';
		try {
			await OS2.moveFile({ config, oldPath: pathOriginal, newPath: pathHidden });
		} catch (ex) {
			errors.push(ex);
		}

		// Deploy admin profile
		try {
			await this._runSFDX({ isGoingToRun: config.SFDX.AfterPush_DeployAdminProfile, config, command, logFile });
		} catch (ex) {
			errors.push(ex);
		}

		// Move .forceignore (restore it)
		try {
			await OS2.moveFile({ config, oldPath: pathHidden, newPath: pathOriginal });
		} catch (ex) {
			errors.push(ex);
		}

		if (errors.length > 0) {
			throw errors;
		}
	}

	async ETCopyData({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const stepNumber = '17';
		config.currentStep = `${stepNumber}. Load data using ETCopyData plugin`;
		// sfdx ETCopyData delete --configfolder="./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
		// sfdx ETCopyData export --configfolder="./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
		// sfdx ETCopyData import --configfolder="./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
		command = `sfdx ETCopyData import --configfolder "${config.SFDX.ETCopyData}" --loglevel="info" --json --orgsource="${config.SFDX.alias}" --orgdestination="${config.SFDX.alias}"`;
		logFile = `${stepNumber}_ETCopyData.json`;
		await this._runSFDX({ isGoingToRun: config.SFDX.ETCopyData, config, command, logFile });
	}

	async AfterData_ExecuteApex({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		const stepNumber = '18';
		config.currentStep = `${stepNumber}. Execute Apex Anonymous code after data load`;
		commandParts = {
			pre: 'sf apex run --file="',
			post: '" --json',
		};
		logFileParts = {
			step: stepNumber,
			pre: 'AfterData_ExecuteApex',
			post: '.json',
		};
		listValues = config.SFDX.AfterData_ExecuteApex;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	async AfterData_RunApexTests({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const stepNumber = '19';
		config.currentStep = `${stepNumber}. Run Apex tests`;
		command = 'sf apex run test --code-coverage --json --result-format=json --wait=60';
		logFile = `${stepNumber}_AfterData_RunApexTests.json`;
		await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_RunApexTests, config, command, logFile });
	}

	async AfterData_PublishCommunityName({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		const stepNumber = '20';
		config.currentStep = `${stepNumber}. Publish community`;
		command = `sf community publish --name "${config.SFDX.AfterData_PublishCommunityName}" --json`;
		logFile = `${stepNumber}_AfterData_PublishCommunityName.json`;
		await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_PublishCommunityName, config, command, logFile });
	}

	async AfterData_GeneratePassword({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile,
			command,
			tmpCommand = {};

		const stepNumber = '21';
		config.currentStep = `${stepNumber}a. Generate Password (Create)`;
		command = 'sf force user password generate --json';
		logFile = `${stepNumber}a_AfterData_GeneratePassword.json`;
		await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_GeneratePassword, config, command, logFile });
		tmpCommand = command;

		if (config.SFDX.AfterData_GeneratePassword) {
			config.currentStep = `${stepNumber}b. Generate Password (Display)`;
			command = 'sf org display user --json';
			logFile = `${stepNumber}b_AfterData_GeneratePassword.json`;
			let result = await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_GeneratePassword, config, command, logFile });
			if (config.SFDX.AfterData_GeneratePassword && result.CLOSE.code === 0) {
				let stdOut = JSON.parse(result.STDOUT);
				let user = stdOut.result;
				let warnings = stdOut.warnings.filter((warning) => warning.includes('sensitive information'))[0];
				let url = `${user.instanceUrl}/secur/frontdoor.jsp?sid=${user.accessToken}`;
				let obj = { command: tmpCommand, url, user, warnings };
				let data = Colors2.getPrettyJson({ obj });
				let path = `${config.rootLogs}/_user.json`;
				await OS2.writeFile({ config, path, data });
				Colors2.sfdxShowNote({ msg: `User credentials are saved in this file: ${path}` });
			}
		}
	}

	async DeployToSandbox({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		let stepNumber = '23';
		config.currentStep = `${stepNumber}. Deploy to sandbox`;
		if (config.SFDX.DeployToSandbox) {
			config.currentStep = `${stepNumber}a. Deploy to sandbox (Open Deploy page)`;
			command = `sf org open --target-org="${config.SFDX.DeployToSandbox.alias}" --path=${config.deployPage} --json`;
			logFile = `${stepNumber}a_DeployToSandbox.json`;
			await this._runSFDX({ isGoingToRun: config.SFDX.DeployToSandbox, config, command, logFile });

			config.currentStep = `${stepNumber}b. Deploy to sandbox (Perform Deployment)`;
			command = `sfdx project deploy start --source-dir="${config.SFDX.DeployToSandbox.folder}" --target-org="${config.SFDX.DeployToSandbox.alias}" --verbose --wait=30 --json`;
			logFile = `${stepNumber}b_DeployToSandbox.json`;
			await this._runSFDX({ isGoingToRun: config.SFDX.DeployToSandbox, config, command, logFile });

			config.currentStep = `${stepNumber}c. Deploy to sandbox (Run tests)`;
			command = `sf apex run test --code-coverage --json --result-format=json --wait=60 --target-org="${config.SFDX.DeployToSandbox.alias}" --json`;
			logFile = `${stepNumber}c_DeployToSandbox.json`;
			await this._runSFDX({ isGoingToRun: config.SFDX.DeployToSandbox.runTests, config, command, logFile });
		} else {
			this._showStepSkipped({ config });
		}
	}

	async ShowFinalSuccess({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });

		const processCommands = async () => {
			let data = '';
			config.commands.forEach((command) => {
				data += `${command}\n`;
			});
			await OS2.writeFile({ config, path: `${config.rootLogs}/_commands.txt`, data });
		};

		const processErrors = async () => {
			let data = '';
			config.errors.forEach((error) => {
				data += `${error}\n`;
			});
			await OS2.writeFile({ config, path: `${config.rootLogs}/_errors.txt`, data });
		};

		let stepNumber = '99';
		config.currentStep = `${stepNumber}. ShowFinalSuccess`;
		await processCommands();
		await processErrors();
		if (config.SFDX.ShowFinalSuccess) {
			if (config.errors.length > 0) {
				Colors2.sfdxShowError({ msg: '' });
				Colors2.sfdxShowError({ msg: '*** *** *** *** *** *** *** *** *** ***' });
				Colors2.sfdxShowError({ msg: '*** ***  Completed with errors  *** ***' });
				Colors2.sfdxShowError({ msg: '*** *** *** *** *** *** *** *** *** ***' });
				Colors2.sfdxShowError({ msg: '' });
				config.errors.forEach((error) => {
					Colors2.sfdxShowError({ msg: error });
				});
			} else {
				Colors2.sfdxShowSuccess({ msg: '' });
				Colors2.sfdxShowSuccess({ msg: '*** *** *** *** *** *** *** *** *** ***' });
				Colors2.sfdxShowSuccess({ msg: '*** ***  Completed succesfully  *** ***' });
				Colors2.sfdxShowSuccess({ msg: '*** *** *** *** *** *** *** *** *** ***' });
			}
		}
	}
	*/
	// #endregion STEPS

	getStepId({ config }) {
		const error = new Error();
		const stack = error.stack.split('\n');
		const from = stack.slice(2, 3)[0].trim();
		const fromMethod = from.split(' ')[1];

		const message = 'Application Error: Caller method must be in SFDX class';
		try {
			ET_Asserts.equals({ expected: true, actual: fromMethod.startsWith('SFDX.'), message });
		} catch (ex) {
			Logs2.reportErrorMessage({ config, msg: message });
			process.exit(-1);
		}

		return {
			stepMethod: fromMethod.replace('SFDX.', ''),
			stepNumber: `LIST_${config.stepNumber.toString().padStart(2, '0')}`,
		};
	}

	async _runSFDXArray({ config, data, stepNumber, stepMethod, commandMaker }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: data, message: 'data' });
		ET_Asserts.hasData({ value: stepNumber, message: 'stepNumber' });
		ET_Asserts.hasData({ value: stepMethod, message: 'stepMethod' });
		ET_Asserts.hasData({ value: commandMaker, message: 'commandMaker' });

		config.currentStep = `${stepNumber}. ${stepMethod}`;
		if (data.length > 0) {
			let errors = [];
			for (let idx = 0; idx < data.length; idx++) {
				const letter = String.fromCharCode('a'.charCodeAt(0) + idx);
				const logFile = `${stepNumber}${letter}. ${stepMethod}.json`;
				config.currentStep = `${stepNumber}${letter}. ${stepMethod} (multi-item)`;
				try {
					await this._runSFDX({ config, command: commandMaker({ stepData: data[idx] }), logFile });
				} catch (ex) {
					if (config.settings.QuitOnErrors) {
						throw ex;
					} else {
						errors.push(ex);
					}
				}
			}
			if (errors.length > 0) {
				throw errors;
			}
		} else {
			this._showStepSkipped({ config });
		}
	}

	async _runSFDX({ config, command, logFile }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: command, message: 'command' });
		ET_Asserts.hasData({ value: logFile, message: 'logFile' });

		if (command.startsWith('sf org open') && !config.settings.OpenBrowser) {
			Colors2.sfdxShowNote({ msg: 'Brwoser not was not open because flag [OpenBrowser] is not true' });
			return {};
		}

		return await this._runAndLog({ config, command, logFile });
	}

	async _runAndLog({ config, command, logFile }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: command, message: 'command' });
		ET_Asserts.hasData({ value: logFile, message: 'logFile' });
		let result = null;
		let notification = null;
		let start = null;
		let stop = null;

		const logResults = async (hadErrors) => {
			let data = {
				result: {
					step: notification.currentStep,
					command: `${notification.app} ${notification.args.join(' ')}`,
					cwd: notification.cwd,
					start,
					stop_: stop,
					hadErrors,
					...notification.response.CLOSE,
				},
			};
			if (notification.response.STDOUT) {
				try {
					data.STDOUT = JSON.parse(notification.response.STDOUT);
				} catch (ex) {
					data.STDOUT = `\n${notification.response.STDOUT.trim()}`;
				}
			}
			if (notification.response.STDERR) {
				try {
					data.STDERR = JSON.parse(notification.response.STDERR);
				} catch (ex) {
					data.STDERR = `\n${notification.response.STDERR.trim()}`;
				}
			}
			data = Colors2.getPrettyJson({ obj: data });

			// Make sure all new lines are actually posted on the file as new lines and not as "\n"
			data = data.replaceAll('\\n', '\n');
			data = data.replaceAll('\\t', '\t');

			let path = `${config.rootLogs}/${logFile}`;
			await OS2.writeFile({ config, path, data });
		};

		try {
			start = new Date();
			Colors2.sfdxShowStatus({ status: '' });
			Colors2.sfdxShowStatus({ status: config.currentStep });
			Colors2.sfdxShowCommand({ command });
			Colors2.sfdxShowMessage({ msg: `${start} | ${config.currentStep} | Started` });

			config.commands.push(command);
			command = command.split(' ');
			let app = command.shift();
			let args = command;
			result = await OS2.executeAsync({
				config,
				app,
				args,
				cwd: config.root,
				expectedCode: 0,
				callbackAreWeDone: (data) => {
					if (config.debug) Colors2.debug({ msg: data.item });
					notification = data;
				},
			});
			if (result.CLOSE.code !== 0) {
				throw result;
			}
			stop = new Date();
			await logResults(false);
			Colors2.sfdxShowSuccess({ msg: `${stop} | ${config.currentStep} | Succesfully completed` });
			return result;
		} catch (ex) {
			stop = new Date();
			await logResults(true);
			config.errors.push(config.currentStep);
			let msg = `${config.currentStep} failed`;
			Logs2.reportErrorMessage({ config, msg: `${stop} | ${config.currentStep} | Failed to execute` });
			if (config.debug) {
				if (ex.STDOUT && ex.STDERR) {
					if (ex.STDOUT) {
						ex.STDOUT.split('\n').forEach((line) => {
							Logs2.reportErrorMessage({ config, msg: line.trim() });
						});
					}
					if (ex.STDERR) {
						ex.STDERR.split('\n').forEach((line) => {
							Logs2.reportErrorMessage({ config, msg: line.trim() });
						});
					}
				} else {
					Logs2.reportException({ config, msg, ex });
				}
			}
			throw new Error(msg);
		}
	}

	_showStepSkipped({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });

		let step = config.currentStep;
		// if (config.currentStep[2] !== '.') {
		// 	step = step.slice(0, 2) + step.slice(3);
		// }
		// step = step.replace(/\(.*?\)/g, '');
		// step = step.trim();
		Colors2.sfdxShowStatus({ status: '' });
		Colors2.sfdxShowStatus({ status: `${step} --- Skipped` });
	}

	_skipBecauseCICD({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });

		// this._showStepSkipped({ config });
		Colors2.sfdxShowNote({ msg: 'Stop ignored because there is no user in the screen, running in CICD mode' });
	}
}
