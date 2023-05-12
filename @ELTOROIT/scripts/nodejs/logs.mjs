// import OS2 from "./lowLevelOs.js";
import Colors2 from './colors.mjs';
import ET_Asserts from './etAsserts.mjs';

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

		let error = { test: config.currentStep, msg, ...ex };
		if (ex.message) error.message = ex.message;
		if (ex.stack) error.stack = ex.stack;
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
}
