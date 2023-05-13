import Logs2 from './logs.mjs';
import Colors2 from './colors.mjs';
import OS2 from './lowLevelOs.mjs';
import ET_Asserts from './etAsserts.mjs';

export default class SFDX {
	async processSteps({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });

		for (const step of config.steps) {
			// console.log(`*** *** Step: ${step}`);
			if (this[step]) {
				try {
					await this[step]({ config });
				} catch (ex) {
					Logs2.reportErrorMessage({ config, msg: `${config.currentStep} failed` });
					if (config.SFDX.QuitOnErrors) {
						Logs2.reportErrorMessage({ config, msg: '' });
						Logs2.reportErrorMessage({ config, msg: '' });
						Logs2.reportErrorMessage({ config, msg: '' });
						Logs2.reportErrorMessage({ config, msg: 'QuitOnErrors is set to true, aborting process!' });
						Logs2.reportErrorMessage({ config, msg: '' });
						Logs2.reportErrorMessage({ config, msg: '' });
						Logs2.reportErrorMessage({ config, msg: '' });
						process.exit(-1);
					}
				}
			} else {
				console.log(`*** *** *** *** NOT IMPLEMENTED: ${step}`);
			}
		}
	}

	// 01. Validate ETCopyData
	async BeforeOrg_ValidateETCopyData({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '01. Validate ETCopyData';
		command = 'sfdx plugins --core';
		logFile = '01_BeforeOrg_ValidateETCopyData.txt';
		let result = await this._runSFDX({ isGoingToRun: config.SFDX.BeforeOrg_ValidateETCopyData, config, command, logFile });
		// Process results
		if (config.SFDX.BeforeOrg_ValidateETCopyData) {
			let plugins = result.STDOUT.split('\n');
			let etcd = plugins.filter((plugin) => plugin.startsWith('etcopydata'));
			if (etcd.length !== 1) {
				let msg = 'Could not find plugin for ETCopyData installed';
				Logs2.reportErrorMessage({ config, msg });
				throw new Error(msg);
			} else {
				Colors2.success({ msg: etcd[0] });
			}
		}
	}

	// 02. Run JEST tests
	async BeforeOrg_RunJestTests({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '02. Run JEST tests';
		command = 'npm run test:unit:CICD';
		logFile = '02_BeforeOrg_RunJestTests.txt';
		await this._runAndLog({ isGoingToRun: config.SFDX.BeforeOrg_RunJestTests, config, command, logFile });
	}

	// 03. Backup current org alias
	async BeforeOrg_BackupAlias({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '03a. Backup current org alias (Find orgs)';
		command = 'sfdx alias:list --json';
		logFile = '03a_BeforeOrg_BackupAlias.json';
		let result = await this._runSFDX({ isGoingToRun: config.SFDX.BeforeOrg_BackupAlias, config, command, logFile });
		// Process results
		if (config.SFDX.BeforeOrg_BackupAlias) {
			let orgs = JSON.parse(result.STDOUT).result;
			let org = orgs.find((org) => org.alias === config.SFDX.alias);
			config.currentStep = '03b. Backup current org alias (Create backup alias)';
			command = `sfdx alias:set ${config.SFDX.alias}.bak=${org.value}`;
			logFile = '03b_BeforeOrg_BackupAlias.txt';
			await this._runSFDX({ isGoingToRun: config.SFDX.BeforeOrg_BackupAlias, config, command, logFile });
		}
	}

	// 04. Create scratch org
	async CreateScratchOrg({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '04a. Create scratch org (Create new org)';
		command = `sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --setalias "${config.SFDX.alias}" -d "${config.SFDX.days}"`;
		logFile = '04a_CreateScratchOrg.txt';
		await this._runSFDX({ isGoingToRun: config.SFDX.CreateScratchOrg, config, command, logFile });

		if (config.SFDX.CreateScratchOrg) {
			config.currentStep = '04b. Create scratch org (Set as default)';
			command = `sfdx config:set target-org="${config.SFDX.alias}"`;
			logFile = '04b_CreateScratchOrg.txt';
			await this._runSFDX({ isGoingToRun: config.SFDX.CreateScratchOrg, config, command, logFile });
		}
	}

	// 05. Pause to check org
	async BeforePush_PauseToCheckOrg({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '05. Pause to check org';
		command = 'sfdx org:open';
		logFile = '05_BeforePush_PauseToCheckOrg.txt';
		await this._runSFDX({ isGoingToRun: config.SFDX.BeforePush_PauseToCheckOrg, config, command, logFile });
		if (config.SFDX.UserOnScreen) {
			if (config.SFDX.BeforePush_PauseToCheckOrg) {
				let result = await Logs2.promptYesNo({ config, question: 'Was the org created succesfully?' });
				if (!result) {
					throw new Error(`${config.currentStep} failed`);
				}
			}
		} else {
			this._skipBecauseCICD({ config });
		}
	}

	// 06. Open deploy page to watch deployments
	async BeforePush_ShowDeployPage({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '06. Open deploy page to watch deployments';
		command = `sfdx force:org:open --path="${config.deployPage}"`;
		logFile = '06_BeforePush_ShowDeployPage.txt';
		await this._runSFDX({ isGoingToRun: config.SFDX.BeforePush_ShowDeployPage, config, command, logFile });
	}

	// 07. Prepare the org before push
	async BeforePush_PrepareOrg({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '07. Prepare the org before push';
		commandParts = {
			pre: 'sfdx force:mdapi:deploy --deploydir "',
			post: '" --json --wait 30',
		};
		logFileParts = {
			step: '07',
			pre: 'BeforePush_PrepareOrg',
			post: '.json',
		};
		listValues = config.SFDX.BeforePush_PrepareOrg;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	// 08. Open pages to manually configure org before push
	async BeforePush_ManualMetadata({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '08. Open pages to manually configure org before push';
		commandParts = {
			pre: 'sfdx force:org:open --path "',
			post: '" --json',
		};
		logFileParts = {
			step: '08',
			pre: 'BeforePush_ManualMetadata',
			post: '.json',
		};
		listValues = config.SFDX.BeforePush_ManualMetadata;
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

	// 09. Execute Apex Anonymous code before push
	async BeforePush_ExecAnonApex({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '09. Execute Apex Anonymous code before push';
		commandParts = {
			pre: 'sfdx apex:run -f "',
			post: '" --json',
		};
		logFileParts = {
			step: '09',
			pre: 'BeforePush_ExecAnonApex',
			post: '.json',
		};
		listValues = config.SFDX.BeforePush_ExecAnonApex;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	// 10. Install Package(s) before push
	async BeforePush_InstallPackages({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '10. Install Package(s) before push';
		commandParts = {
			pre: 'sfdx package:install --apex-compile=all --package "',
			post: '" --wait=30 --no-prompt',
		};
		logFileParts = {
			step: '10',
			pre: 'BeforePush_InstallPackages',
			post: '.json',
		};
		listValues = config.SFDX.BeforePush_InstallPackages;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	// 11. Push metadata
	async PushMetadata({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '11. Push metadata';
		command = 'sfdx force:source:push --forceoverwrite --json';
		logFile = '11_PushMetadata.txt';
		await this._runSFDX({ isGoingToRun: config.SFDX.PushMetadata, config, command, logFile });
	}

	// 12. Open pages to manually configure org after push
	async AfterPush_ManualMetadata({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '12. Open pages to manually configure org after push';
		commandParts = {
			pre: 'sfdx force:org:open --path "',
			post: '" --json',
		};
		logFileParts = {
			step: '12',
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

	// 13. Execute Apex Anonymous code after push
	async AfterPush_ExecuteApex({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '13. Execute Apex Anonymous code after push';
		commandParts = {
			pre: 'sfdx apex:run -f "',
			post: '" --json',
		};
		logFileParts = {
			step: '13',
			pre: 'AfterPush_ExecuteApex',
			post: '.json',
		};
		listValues = config.SFDX.AfterPush_ExecuteApex;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	// 14. Assign permission sets to your user
	async AfterPush_AssignPermissionSets({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '14. Assign permission sets to your user';
		commandParts = {
			pre: 'sfdx force:user:permset:assign --permsetname "',
			post: '" --json',
		};
		logFileParts = {
			step: '14',
			pre: 'AfterPush_AssignPermissionSets',
			post: '.json',
		};
		listValues = config.SFDX.AfterPush_AssignPermissionSets;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	// 15. Deploy "Admin" standard profile
	async AfterPush_DeployAdminProfile({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '15. Deploy "Admin" standard profile';
		command = `sfdx force:source:deploy -p "${config.SFDX.AfterPush_DeployAdminProfile}"`;
		logFile = '15_AfterPush_DeployAdminProfile.txt';

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

	// 16. Load data using ETCopyData plugin
	async ETCopyData({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '16. Load data using ETCopyData plugin';
		// sfdx ETCopyData:delete --orgdestination=sbTVB4S_CICD --configfolder "./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
		// sfdx ETCopyData:export --configfolder "./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
		// sfdx ETCopyData:import --configfolder "./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
		command = `sfdx ETCopyData:import --configfolder "${config.SFDX.ETCopyData}" --loglevel info --json --orgsource="${config.SFDX.alias}" --orgdestination="${config.SFDX.alias}"`;
		logFile = '16_ETCopyData.txt';
		await this._runSFDX({ isGoingToRun: config.SFDX.ETCopyData, config, command, logFile });
	}

	// 17. Execute Apex Anonymous code after data load
	async AfterData_ExecuteApex({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFileParts, commandParts, listValues, isGoingToRun;

		config.currentStep = '17. Execute Apex Anonymous code after data load';
		commandParts = {
			pre: 'sfdx apex:run -f "',
			post: '" --json',
		};
		logFileParts = {
			step: '17',
			pre: 'AfterData_ExecuteApex',
			post: '.json',
		};
		listValues = config.SFDX.AfterData_ExecuteApex;
		isGoingToRun = Array.isArray(listValues) && listValues?.length > 0;
		await this._runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts });
	}

	// 18. Run Apex tests
	async AfterData_RunApexTests({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '18. Run Apex tests';
		command = 'sfdx apex:run:test --code-coverage --json --result-format=json --wait=60';
		logFile = '18_AfterData_RunApexTests.json';
		await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_RunApexTests, config, command, logFile });
	}

	// 19. Publish community
	async AfterData_PublishCommunityName({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '19. Publish community';
		command = `sfdx community:publish --name "${config.SFDX.AfterData_PublishCommunityName}"`;
		logFile = '19_AfterData_PublishCommunityName.json';
		await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_PublishCommunityName, config, command, logFile });
	}

	// 20. Generate Password
	async AfterData_GeneratePassword({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '20a. Generate Password (Create)';
		command = 'sfdx force:user:password:generate --json';
		logFile = '20a_AfterData_GeneratePassword.json';
		await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_GeneratePassword, config, command, logFile });

		if (config.SFDX.AfterData_GeneratePassword) {
			config.currentStep = '20b. Generate Password (Display)';
			command = 'sfdx org:display:user --json';
			logFile = '20b_AfterData_GeneratePassword.json';
			const result = await this._runSFDX({ isGoingToRun: config.SFDX.AfterData_GeneratePassword, config, command, logFile });
			if (config.SFDX.AfterData_GeneratePassword && result.CLOSE.code === 0) {
				Colors2.sfdxShowMessage({ msg: Colors2.getPrettyJson({ obj: JSON.parse(result.STDOUT).result }) });
			}
		}
	}

	// 21. Deploy to sandbox
	async DeployToSandbox({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		let logFile, command;

		config.currentStep = '21a. Deploy to sandbox (Open Deploy page)';
		if (config.SFDX.DeployToSandbox) {
			command = `sfdx org open --target-org="${config.SFDX.DeployToSandbox.alias}" --path=${config.deployPage}`;
			logFile = '21a_DeployToSandbox.json';
			await this._runSFDX({ isGoingToRun: config.SFDX.DeployToSandbox, config, command, logFile });

			config.currentStep = '21b. Deploy to sandbox (Perform Deployment)';
			command = `sfdx force:source:deploy --sourcepath="${config.SFDX.DeployToSandbox.folder}" --json --loglevel=trace --targetusername="${config.SFDX.DeployToSandbox.alias}"`;
			logFile = '21b_DeployToSandbox.json';
			await this._runSFDX({ isGoingToRun: config.SFDX.DeployToSandbox, config, command, logFile });

			config.currentStep = '21c. Deploy to sandbox (Run tests)';
			command = `sfdx apex:run:test --code-coverage --json --result-format=json --wait=60 --targetusername="${config.SFDX.DeployToSandbox.alias}"`;
			logFile = '21c_DeployToSandbox.json';
			await this._runSFDX({ isGoingToRun: config.SFDX.DeployToSandbox, config, command, logFile });
		} else {
			this._showStepSkipped({ config });
		}
	}

	// The end.
	async ShowFinalSuccess({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });

		await OS2.writeFile({ config, path: `${config.rootLogs}/_commands`, data: Colors2.getPrettyJson({ obj: config.commands }) });
		await OS2.writeFile({ config, path: `${config.rootLogs}/_errors`, data: Colors2.getPrettyJson({ obj: config.errors }) });
		if (config.SFDX.ShowFinalSuccess) {
			Colors2.success({ msg: '' });
			Colors2.success({ msg: '*** *** *** *** *** *** *** *** ***' });
			Colors2.success({ msg: '*** ***  Process completed  *** ***' });
			Colors2.success({ msg: '*** *** *** *** *** *** *** *** ***' });
		}
	}

	async _runSFDXArray({ isGoingToRun, listValues, config, commandParts, logFileParts }) {
		ET_Asserts.hasData({ value: isGoingToRun, message: 'isGoingToRun' });
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: commandParts, message: 'commandParts' });
		ET_Asserts.hasData({ value: commandParts.pre, message: 'commandParts.pre' });
		ET_Asserts.hasData({ value: commandParts.post, message: 'commandParts.post' });
		ET_Asserts.hasData({ value: logFileParts, message: 'logFileParts' });
		ET_Asserts.hasData({ value: logFileParts.step, message: 'logFileParts.step' });
		ET_Asserts.hasData({ value: logFileParts.pre, message: 'logFileParts.pre' });
		ET_Asserts.hasData({ value: logFileParts.post, message: 'logFileParts.post' });
		let logFile, command;

		if (isGoingToRun) {
			if (listValues.length > 0) {
				let errors = [];
				let tmpCurrentStep = config.currentStep.split(' ');
				tmpCurrentStep.shift();
				tmpCurrentStep = tmpCurrentStep.join(' ');
				for (let idx = 0; idx < listValues.length; idx++) {
					try {
						let step = `${logFileParts.step}${String.fromCharCode('a'.charCodeAt(0) + idx)}`;
						config.currentStep = `${step}. ${tmpCurrentStep} (multi-item)`;
						command = `${commandParts.pre}${listValues[idx]}${commandParts.post}`;
						logFile = `${step}_${logFileParts.pre}${logFileParts.post}`;
						await this._runSFDX({ isGoingToRun, config, command, logFile });
					} catch (ex) {
						if (config.SFDX.QuitOnErrors) {
							config.currentStep = tmpCurrentStep;
							throw ex;
						} else {
							errors.push(ex);
						}
					}
				}
				config.currentStep = tmpCurrentStep;
				if (errors.length > 0) {
					throw errors;
				}
			} else {
				this._showStepSkipped({ config });
			}
		} else {
			this._showStepSkipped({ config });
		}
	}

	async _runSFDX({ isGoingToRun, config, command, logFile }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: command, message: 'command' });
		ET_Asserts.hasData({ value: logFile, message: 'logFile' });

		if (!command.startsWith(command)) command = `sfdx ${command}`;
		return await this._runAndLog({ isGoingToRun, config, command, logFile });
	}

	async _runAndLog({ isGoingToRun, config, command, logFile }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: command, message: 'command' });
		ET_Asserts.hasData({ value: logFile, message: 'logFile' });
		let result = null;
		let notification = null;

		const logResults = async () => {
			let data = '';
			data += `Step: ${notification.currentStep}\n`;
			data += `Command: ${notification.app} ${notification.args.join(' ')}\n`;
			data += '\n=== === === RESULT === === ===\n';
			data += `${Colors2.getPrettyJson({ obj: notification.response.CLOSE })}\n`;
			// data += `${notification.cwd}\n`;
			if (notification.response.STDOUT) {
				data += '\n=== === === STDOUT === === ===\n';
				data += `${notification.response.STDOUT}\n`;
			}
			if (notification.response.STDERR) {
				data += '\n=== === === STDERR === === ===\n';
				data += `${notification.response.STDERR}\n`;
			}
			// Make sure all new lines are actually posted on the file.
			data = data.replaceAll('\\n', '\n');

			let path = `${config.rootLogs}/${logFile}`;
			await OS2.writeFile({ config, path, data });
		};

		if (!isGoingToRun) {
			this._showStepSkipped({ config });
			return;
		}

		try {
			Colors2.sfdxShowStatus({ status: '' });
			Colors2.sfdxShowStatus({ status: config.currentStep });
			Colors2.sfdxShowCommand({ command });
			Colors2.sfdxShowMessage({ msg: `${new Date()} | ${config.currentStep} | Started` });

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
			await logResults();
			Colors2.success({ msg: `${new Date()} | ${config.currentStep} | Succesfully completed` });
			return result;
		} catch (ex) {
			await logResults();
			let msg = `${config.currentStep} failed`;
			Logs2.reportErrorMessage({ config, msg: `${new Date()} | ${config.currentStep} | Failed to execute` });
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
		if (config.currentStep[2] !== '.') {
			step = step.slice(0, 2) + step.slice(3);
		}
		step = step.replace(/\(.*?\)/g, '');
		step = step.trim();
		Colors2.sfdxShowStatus({ status: '' });
		Colors2.sfdxShowStatus({ status: `${step} --- Skipped` });
	}

	_skipBecauseCICD({ config }) {
		ET_Asserts.hasData({ value: config, message: 'config' });

		// this._showStepSkipped({ config });
		Colors2.error({ msg: 'Stop ignored because there is no user in the screen, running in CICD mode' });
	}
}
