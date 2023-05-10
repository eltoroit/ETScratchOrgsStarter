// import OS2 from "./lowLevelOs.js";
import Colors2 from './colors.mjs';
import ET_Asserts from './etAsserts.mjs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import Colors from './colors.mjs';

export default class Logs {
	static reportError({ config, obj }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: obj, message: 'obj' });

		if (config.debug) Colors2.debug({ msg: 'ERROR FOR: ' + Colors2.getPrettyJson({ obj }) });
		config.errors.push({ test: config.currentStep, error: obj });
		Colors2.error({ msg: '*** *** ERROR', offset: 1 });
		Colors2.error({ msg: Colors2.getPrettyJson({ obj }), offset: 1 });
	}

	static reportException({ config, msg, ex }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: msg, message: 'msg' });
		ET_Asserts.hasData({ value: ex, message: 'ex' });

		let error = { message: ex.message, stack: ex.stack, ...ex };
		error = { test: config.currentStep, msg, error };
		if (config.debug) Colors2.debug({ msg: 'ERROR FOR: ' + Colors2.getPrettyJson({ obj: error }) });
		config.errors.push(error);
		Colors2.error({ msg: Colors2.getPrettyJson({ obj: error }), offset: 1 });
	}

	static reportErrorMessage({ config, msg }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: msg, message: 'msg' });

		config.errors.push({ test: config.currentStep, error: msg });
		Colors2.error({ msg, offset: 1 });
	}

	static async promptYesNo({ config, question }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: question, message: 'question' });

		Colors2.promptMsg({ msg: question });
		const rl = readline.createInterface({ input, output });

		// Can't use async/await because I need a loop
		return new Promise((resolve) => {
			async function loop() {
				const answer = await rl.question(Colors2.getPromptMsg({ msg: '[Y/N] > ' }));
				if (answer[0].toUpperCase() === 'Y') {
					rl.close();
					Colors.success({ msg: 'User approved step' });
					resolve('YES');
				} else if (answer[0].toUpperCase() === 'N') {
					rl.close();
					Logs.reportErrorMessage({ config, msg: 'User did not approve step' });
					resolve('NO');
				} else {
					loop();
				}
			}

			if (config.executeManualChecks) {
				loop();
			} else {
				Colors2.error({ msg: 'Manual checks are being skipped for testing! (No prompt)' });
				resolve(null);
			}
		});
	}
}
