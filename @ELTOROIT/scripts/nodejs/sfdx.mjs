import Logs2 from './logs.mjs';
import Colors2 from './colors.mjs';
import OS2 from './lowLevelOs.mjs';

export default class SFDX {
	async processSteps({ config }) {
		for (const step of config.steps) {
			if (this[step]) {
				try {
					await this[step]({ config });
				} catch (ex) {
					Logs2.reportErrorMessage({ config, msg: `${config.currentStep} failed` });
					if (config.SFDX.quitOnErrors) {
						throw new Error('Quiting on errors!');
					}
				}
			} else {
				console.log(`*** *** *** *** NOT IMPLEMENTED: ${step}`);
			}
		}
	}

	async validateETCopyData({ config }) {
		config.currentStep = 'Validating ETCopyData';
		let command = 'sfdx plugins --core';
		let logFile = 'validateETCopyData.txt';
		let result = await this._runSFDX({ isGoingToRun: config.SFDX.importData, config, command, logFile });
		// Process results
		if (config.SFDX.importData) {
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

	async RunJest({ config }) {
		config.currentStep = 'Running JEST tests';
		let command = 'npm run test:unit:CICD';
		let logFile = 'jestTests.txt';
		await this._runAndLog({ isGoingToRun: config.SFDX.runJestTests, config, command, logFile });
	}

	async BackupAlias({ config }) {
		config.currentStep = 'Backup this org alias (Get aliases)';
		let command = 'sfdx force:alias:list --json';
		let logFile = 'aliasListAll.json';
		let result = await this._runSFDX({ isGoingToRun: config.SFDX.backupAlias, config, command, logFile });
		// Process results
		if (config.SFDX.backupAlias) {
			let orgs = JSON.parse(result.STDOUT).result;
			let org = orgs.find((org) => org.alias === config.SFDX.alias);
			config.currentStep = 'Backup this org alias (Create bakup alias)';
			let command = `sfdx alias:set ${config.SFDX.alias}.bak=${org.value}`;
			let logFile = 'aliasListSet.txt';
			await this._runSFDX({ isGoingToRun: config.SFDX.backupAlias, config, command, logFile });
		}
	}

	async CreateScratchOrg({ config }) {
		let logFile, command;

		config.currentStep = 'Create scratch org (Create)';
		command = `sfdx force:org:create -f config/project-scratch-def.json --setdefaultusername --setalias "${config.SFDX.alias}" -d "${config.SFDX.days}"`;
		logFile = 'createScratchOrgCreate.txt';
		await this._runAndLog({ isGoingToRun: config.SFDX.createScratchOrg, config, command, logFile });

		config.currentStep = 'Create scratch org (Set as default)';
		command = `sfdx force:config:set defaultusername="${config.SFDX.alias}"`;
		logFile = 'createScratchOrgDefault.txt';
		await this._runAndLog({ isGoingToRun: config.SFDX.createScratchOrg, config, command, logFile });
	}

	async _runSFDX({ isGoingToRun, config, command, logFile }) {
		if (!command.startsWith(command)) command = `sfdx ${command}`;
		return await this._runAndLog({ isGoingToRun, config, command, logFile });
	}

	async _runAndLog({ isGoingToRun, config, command, logFile }) {
		let result = null;
		let notification = null;

		if (!isGoingToRun) {
			Colors2.sfdxShowStatus({ status: `${config.currentStep} (Skipped)` });
			return;
		}

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

			let path = `${config.rootLogs}/${new Date().getTime()}_${logFile}`;
			await OS2.writeFile({ config, path, data });
		};

		try {
			Colors2.sfdxShowStatus({ status: config.currentStep });
			Colors2.sfdxShowCommand({ command });
			Colors2.sfdxShowMessage({ msg: `${new Date()} | ${config.currentStep} | Started` });

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
			logResults();
			Colors2.success({ msg: `${new Date()} | ${config.currentStep} | Succesfully completed` });
			return result;
		} catch (ex) {
			logResults();
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
}

// function et_sfdxPush(){
// 	showStatus "*** Pushing metadata to scratch Org..."
// 	showCommand "sfdx $*"
// 	etFile=etLogs/push.json
// 	showCommand "Push logs are here: $etFile"
// 	sfdx $* >> $etFile
// 	local resultcode=$?
// 	if [[ "$AUTOMATED_PROCESS" = true ]]; then
// 		cat $etFile
// 	fi
// 	if [[ $resultcode -ne 0 ]]; then
// 		ReportError
// 	else
// 		showComplete
// 	fi
// }
// function et_sfdxExecuteApex(){
// 	showCommand "sfdx force:apex:execute -f "$1" --json >> $2"
// 	sfdx force:apex:execute -f "$1" --json > $2
// 	local resultcode=$?
// 	if [[ "$AUTOMATED_PROCESS" = true ]]; then
// 		cat $2
// 	fi
// 	if [[ $resultcode -ne 0 ]]; then
// 		ReportError
// 	else
// 		# check for apex compilation success
// 		COMPILE_SUCCESS=`cat $2 | jq -r .result.compiled`
// 		if [ $COMPILE_SUCCESS != "true" ]
// 		then
// 			# The result json contains a terse error description without too much noise
// 			cat "$2" | jq -r .result
// 			ReportError
// 		else
// 			# Show execution output
// 			cat "$2" | jq -r .result.logs
// 			# check for apex execution success
// 			EXECUTION_SUCCESS=`cat "$2" | jq -r .result.success`
// 			if [ $EXECUTION_SUCCESS != "true" ]
// 			then
// 				# Returning just the logs value will mean it renders correctly in terminal without escaped characters
// 				cat "$2" | jq -r .result | jq 'del(.logs)'
// 				ReportError
// 			else
// 				showComplete
// 			fi
// 		fi
// 	fi
// }
// function et_sfdxDeploy(){
// 	showStatus "*** Deploying metadata ..."
// 	showCommand "sfdx $*"
// 	etFile=etLogs/deploy.json
// 	showCommand "Deploy logs are here: $etFile"
// 	sfdx $* >> $etFile
// 	local resultcode=$?
// 	if [[ "$AUTOMATED_PROCESS" = true ]]; then
// 		cat $etFile
// 	fi
// 	if [[ $resultcode -ne 0 ]]; then
// 		ReportError
// 	else
// 		showComplete
// 	fi
// }
// function jq_sfdxGeneratePassword() {
// 	et_sfdx force:user:password:generate --json
// 	et_sfdx force:user:display --json

// 	# https://github.com/forcedotcom/cli/issues/417
// 	# Display has a bug where the password is encripted on display and can't be shown.
// 	# Issue has been fixed, so no need for this anymore
// 	# showCommand "Generates Password"
// 	# etFile=etLogs/userInfo.json
// 	# etFileTemp=$etFile.tmp
// 	# sfdx force:user:password:generate --json > $etFileTemp
// 	# sfdx force:user:display --json > $etFile
// 	# pwd=$(jq -r '.result.password' $etFileTemp)
// 	# jq --arg pwd "$pwd" '.result.password = $pwd' $etFile > $etFileTemp && mv $etFileTemp $etFile
// 	# cat $etFile | jq .
// }
// function jq_sfdxRunApexTests() {
// 	showCommand "sfdx $*"
// 	etFile="etLogs/$APEX_TEST_LOG_FILENAME.json"
// 	sfdx $* >> $etFile
// 	local resultcode=$?
// 	if [[ $resultcode -ne 0 ]]; then
// 		if [[ "$AUTOMATED_PROCESS" = true ]]; then
// 			cat $etFile
// 		else
// 			cat $etFile | jq "del(.result.tests, .result.coverage)"
// 		fi
// 		printf "\033[0;31m\n"
// 		printf "Tests run, but they failed!\n"
// 		if [[ "$QUIT_ON_ERRORS" = true ]]; then
// 			if [[ "$USER_ON_SCREEN" = true ]]; then
// 				printf "Press [Enter] key to exit process...  "
// 				promptUser
// 			fi
// 			exit 1
// 		fi
// 		if [[ "$USER_ON_SCREEN" = true ]]; then
// 			printf "Press [Enter] key to continue...  "
// 			promptUser
// 		fi
// 	else
// 		cat $etFile | jq "del(.result.tests, .result.coverage)"
// 	fi
// }

// #####################################################################################################################################################################
// # Script macro-pieces
// #####################################################################################################################################################################

// function mainPauseToCheck() {
// 	# --- Pause to valiate org created
// 	if [[ "$PAUSE2CHECK_ORG" = true ]]; then
// 		showStatus "*** Opening scratch Org... ($0 ${FUNCNAME[0]})"
// 		et_sfdx force:org:open
// 		showPause "Stop to validate the ORG was created succesfully."
// 	fi
// }
// function mainOpenDeployPage() {
// 	# --- Open deploy page to watch deployments
// 	if [[ "$SHOW_DEPLOY_PAGE" = true ]]; then
// 		showStatus "*** Open page to monitor deployment... ($0 ${FUNCNAME[0]})"
// 		et_sfdx force:org:open --path=$DEPLOY_PAGE
// 	fi
// }
// function mainPrepareOrg() {
// 	# --- Prepare the org before deployment
// 	if [ ! -z "$PREPARE_ORG" ]; then
// 		showStatus "*** Preparing the org... ($0 ${FUNCNAME[0]})"
// 		for METADATA_API in ${PREPARE_ORG[@]}; do
// 			sfdx force:mdapi:deploy --deploydir "$METADATA_API" --wait 30
// 		done
// 		showComplete
// 	fi
// }
// function mainManualMetadataBefore() {
// 	# --- Manual metadata (before deployment)
// 	if [[ ! -z "$PATH2SETUP_METADATA_BEFORE" ]]; then
// 		showStatus "*** Open page to configure org (BEFORE pushing)... ($0 ${FUNCNAME[0]})"
// 		et_sfdx force:org:open --path "$PATH2SETUP_METADATA_BEFORE"
// 		showPause "Configure additonal metadata BEFORE pushing..."
// 	fi
// }
// function mainExecuteApexBeforePush() {
// 	# --- Execute Apex Anonymous code (Before Push)
// 	if [ ! -z "$EXEC_ANON_APEX_BEFORE_PUSH" ]; then
// 		for APEX in ${EXEC_ANON_APEX_BEFORE_PUSH[@]}; do
// 			showStatus "*** Execute Anonymous Apex (before push): [$APEX]... ($0 ${FUNCNAME[0]})"
// 			et_sfdxExecuteApex "$APEX" "etLogs/apexBeforePush.json"
// 			# et_sfdx force:apex:execute -f "$APEX" --json
// 		done
// 		showComplete
// 	fi
// }
// function mainInstallPackages() {
// 	# --- Install Packages (Before Push)
// 	if [ ! -z "$PACKAGES" ]; then
// 		showStatus "*** Installing Packages (before push)... ($0 ${FUNCNAME[0]})"
// 		for PACKAGE in ${PACKAGES[@]}; do
// 			# if [[ "$SHOW_DEPLOY_PAGE" = true ]]; then
// 			# 	et_sfdx force:org:open --path=$DEPLOY_PAGE
// 			# fi
// 			et_sfdx force:package:install --apexcompile=all --package "$PACKAGE" --wait=30 --noprompt
// 		done
// 		showComplete
// 	fi
// }
// function mainDeploy() {
// 	if [[ "$PERFORM_DEPLOY" = true ]]; then
// 		showStatus "*** Deploying metadata... ($0 ${FUNCNAME[0]})"
// 		jq '.packageDirectories[].path' sfdx-project.json > etLogs/tmpDeploy.txt
// 		while read -r path <&9; do
// 			folder=$(echo $path | tr -d '"')
// 			et_sfdxDeploy force:source:deploy --sourcepath "./$folder" --json --loglevel fatal
// 		done 9<  etLogs/tmpDeploy.txt
// 		rm etLogs/tmpDeploy.txt
// 	fi
// }
// function mainPushMetadata() {
// 	showStatus "*** Pushing metadata... ($0 ${FUNCNAME[0]})"
// 	et_sfdxPush force:source:push --forceoverwrite --json
// }
// function mainManualMetadataAfter() {
// 	# --- Manual metadata (after deployment)
// 	if [[ ! -z "$PATH2SETUP_METADATA_AFTER" ]]; then
// 		showStatus "*** Open page to configure org (AFTER pushing)... ($0 ${FUNCNAME[0]})"
// 		et_sfdx force:org:open --path "$PATH2SETUP_METADATA_AFTER"
// 		showPause "Configure additonal metadata AFTER pushing..."
// 	fi
// }
// function mainExecuteApexAfterPush() {
// 	# --- Execute Apex Anonymous code (After Push)
// 	if [ ! -z "$EXEC_ANON_APEX_AFTER_PUSH" ]; then
// 		for APEX in ${EXEC_ANON_APEX_AFTER_PUSH[@]}; do
// 			showStatus "*** Execute Anonymous Apex (after push): [$APEX]... ($0 ${FUNCNAME[0]})"
// 			et_sfdxExecuteApex "$APEX" "etLogs/apexAfterPush.json"
// 			# et_sfdx force:apex:execute -f "$APEX"
// 		done
// 		showComplete
// 	fi
// }
// function mainAssignPermissionSet() {
// 	# --- Assign permission set
// 	if [ ! -z "$PERM_SETS" ]
// 	then
// 		showStatus "*** Assigning permission set(s) to your user... ($0 ${FUNCNAME[0]})"
// 		for PERM_SET in ${PERM_SETS[@]}; do
// 			et_sfdx force:user:permset:assign --permsetname "$PERM_SET" --json
// 		done
// 		showComplete
// 	fi
// }
// function mainDeployAdminProfile() {
// 	# --- Deploy profile
// 	if [ -a "$ADMIN_PROFILE" ]; then
// 		showStatus "*** Deploying 'Admin' standard profile... ($0 ${FUNCNAME[0]})"
// 		mv .forceignore etLogs/.forceignore
// 		et_sfdx force:source:deploy -p "$ADMIN_PROFILE"
// 		local resultcode=$?
// 		mv etLogs/.forceignore .forceignore
// 		showComplete
// 	fi
// }
// function mainLoadData() {
// 	# --- Load data using ETCopyData plugin
// 	if [[ "$IMPORT_DATA" = true ]]; then
// 		showStatus "*** Creating data using ETCopyData plugin... ($0 ${FUNCNAME[0]})"
// 		# sfdx ETCopyData:delete --orgdestination=sbTVB4S_CICD -c "./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
// 		# sfdx ETCopyData:export -c "./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
// 		# sfdx ETCopyData:import -c "./@ELTOROIT/data" --loglevel trace --json > ./etLogs/etCopyData.tab
// 		et_sfdx ETCopyData:import -c "$ETCOPYDATA_FOLDER" --loglevel info --json --orgsource="$ALIAS" --orgdestination="$ALIAS"
// 		showComplete
// 	fi
// }
// function mainExecuteApexAfterData() {
// 	# --- Execute Apex Anonymous code after data
// 	if [ ! -z "$EXEC_ANON_APEX_AFTER_DATA" ]; then
// 		for APEX in ${EXEC_ANON_APEX_AFTER_DATA[@]}; do
// 			showStatus "*** Execute Anonymous Apex (after data): [$APEX]... ($0 ${FUNCNAME[0]})"
// 			et_sfdxExecuteApex "$APEX" "etLogs/apexAfterData.json"
// 			# et_sfdx force:apex:execute -f "$APEX"
// 		done
// 		showComplete
// 	fi
// }
// function mainRunApexTests() {
// 	# --- Runing Apex tests
// 	if [[ "$RUN_APEX_TESTS" = true ]]; then
// 		showStatus "Runing Apex tests... ($0 ${FUNCNAME[0]})"
// 		APEX_TEST_LOG_FILENAME="apexTest_ScratchOrg.json"
// 		jq_sfdxRunApexTests force:apex:test:run --codecoverage --verbose --json --resultformat=json --wait=60
// 		showComplete
// 	fi
// }
// function mainPushAgain() {
// 	# --- Push metadata
// 	showStatus "*** Pushing metadata to scratch Org one more time... ($0 ${FUNCNAME[0]})"
// 	# if [[ "$SHOW_DEPLOY_PAGE" = true ]]; then
// 	# 	et_sfdx force:org:open --path=$DEPLOY_PAGE
// 	# fi
// 	et_sfdxPush force:source:push -u "$ALIAS" -f --json
// 	showComplete
// }
// function mainReassignAlias() {
// 	# --- Push metadata
// 	showStatus "*** Re-assign alias... ($0 ${FUNCNAME[0]})"
// 	et_sfdx force:config:set defaultusername=$ALIAS
// 	showComplete
// }
// function mainPublishCommunity() {
// 	# --- Publish community
// 	if [[ ! -z "$PUBLISH_COMMUNITY_NAME" ]]; then
// 		showStatus "*** Publishing community... ($0 ${FUNCNAME[0]})"
// 		showCommand "sfdx force:community:publish --name \"$PUBLISH_COMMUNITY_NAME\""
// 		sfdx force:community:publish --name "$PUBLISH_COMMUNITY_NAME" || ReportError
// 	fi
// }
// function mainGeneratePassword() {
// 	# --- Generate Password
// 	if [[ "$GENERATE_PASSWORD" = true ]]; then
// 		showStatus "*** Generate Password... ($0 ${FUNCNAME[0]})"
// 		jq_sfdxGeneratePassword
// 		showComplete
// 	fi
// }
// function mainDeployToSandbox() {
// 	# --- Deploy to sandbox
// 	if [[ ! -z "$DEPLOY_TO_SANDBOX" ]]; then
// 		showStatus "*** Opening page in sandbox... ($0 ${FUNCNAME[0]})"
// 		et_sfdx force:org:open --targetusername="$DEPLOY_TO_SANDBOX" --path=$DEPLOY_PAGE
// 		showStatus "*** Deploying to sandbox... ($0 ${FUNCNAME[0]})"
// 		et_sfdxDeploy force:source:deploy --sourcepath="$DEPLOY_TO_SANDBOX_FOLDER" --json --loglevel=trace --targetusername="$DEPLOY_TO_SANDBOX"
// 		APEX_TEST_LOG_FILENAME="apexTest_CICD.json"
// 		jq_sfdxRunApexTests force:apex:test:run --codecoverage --verbose --json --resultformat=json --wait=60 --targetusername="$DEPLOY_TO_SANDBOX"
// 	fi
// }
// function QuitSuccess() {
// 	# Green
// 	printf "\033[0;32m\n"
// 	printf "*** *** *** *** *** *** ***\n"
// 	printf "*** *** Org created *** ***\n"
// 	printf "*** *** *** *** *** *** ***\n"
// 	printf "\033[0m\n"
// 	exit 0
// }

// function promptUser() { // pause
// 	printf "\033[0m"
// 	read -e answer
// 	printf "\n"
// }
// function showStatus() {
// 	# Magenta
// 	printf "\033[0;35m$1\033[0m\n"
// }
// function showCommand() {
// 	printf "\033[0;33m$*\033[0m\n"
// }
// function showComplete() {
// 	# Green
// 	# printf "\033[0;32mTask Completed\033[0m\n"
// 	printf "\033[0;32m"
// 	echo "Task Completed"
// 	date
// 	printf "\033[0m\n"
// }
// function showPause(){
// 	# This will fail on an automated process, but not sure how to fix it.
// 	# Should I ask? Should I skip? Should I error?
// 	if [[ "$USER_ON_SCREEN" = true ]]; then
// 		printf "\033[0;35m\n"
// 		printf "%s " $*
// 		printf "\n"
// 		printf "Press [Enter] key to continue...  "
// 		promptUser
// 	else
// 		printf "\033[0;31m"
// 		printf "Automated tests! Should not be prompting for this"
// 		printf "\033[0m\n"
// 		ReportError
// 	fi
// }
