/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
import ET_Asserts from './etAsserts.mjs';

export default class Colors {
	static clearScreen() {
		console.log(clearScreenCode);
	}

	static writeInstruction({ msg }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });
		console.log(colorBgBlack + colorBright + colorFgMagenta + msg + colorReset);
	}

	static writeMessage({ msg }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });
		console.log(colorBgBlack + colorBright + colorFgCyan + msg + colorReset);
	}

	static debug({ msg }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });

		console.log(colorBgBlack + colorBright + colorFgGray + Colors.getTrace({}) + msg + colorReset);
	}

	static error({ msg, offset }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });
		if (!offset) offset = 0;

		console.log(colorBgBlack + colorBright + colorFgRed + Colors.getTrace({}) + msg + colorReset);
	}

	static getPrettyJson({ obj }) {
		ET_Asserts.hasData({ value: obj, message: 'obj' });

		return JSON.stringify(obj, null, 4);
	}

	static getPromptMsg({ msg }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });

		return colorBgBlack + colorBright + colorFgYellow + msg + colorReset;
	}

	static getTime() {
		let date = new Date();
		let hour = `${date.getHours()}`.padStart(2, '0');
		let minutes = `${date.getMinutes()}`.padStart(2, '0');
		let seconds = `${date.getSeconds()}`.padStart(2, '0');
		let milliseconds = `${date.getMilliseconds()}`.padStart(3, '0');

		return `[${hour}:${minutes}:${seconds}.${milliseconds}]`;
	}

	static getTrace({ offset }) {
		if (!offset) offset = 0;

		let prefix = '';
		if (showTimestamp) {
			prefix += Colors.getTime();
		}
		if (showLineNumbers) {
			try {
				throw new Error();
			} catch (e) {
				if (typeof e.stack === 'string') {
					let linePart = 1;

					let lines = e.stack.split('\n');
					let line = lines[3 + offset];

					// console.log(colorBgBlack + colorBright + colorFgMagenta  + line + colorReset);
					if (line.toLowerCase().indexOf('c:\\th\\') > 0) linePart++;
					prefix += '[' + line.split(':')[linePart] + ']';
				}
			}
		}
		return prefix + (prefix.length > 1 ? ': ' : '');
	}

	static info({ msg }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });

		console.log(colorBgBlack + colorBright + colorFgWhite + Colors.getTrace({}) + msg + colorReset);
	}

	static promptMsg({ msg }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });

		console.log(Colors.getPromptMsg({ msg }));
	}

	static setDebug({ isDebug }) {
		debugger;
		ET_Asserts.hasData({ value: isDebug, message: 'isDebug' });

		showTimestamp = isDebug;
		showLineNumbers = isDebug;
	}

	static success({ msg }) {
		ET_Asserts.hasData({ value: msg, message: 'msg' });

		console.log(colorBgBlack + colorBright + colorFgGreen + Colors.getTrace({}) + msg + colorReset);
	}

	static sfdxShowCommand({ command }) {
		ET_Asserts.hasData({ value: command, message: 'command' });

		console.log(colorBgBlack + colorBright + colorFgYellow + command + colorReset);
	}

	static sfdxShowStatus({ status }) {
		ET_Asserts.hasData({ value: status, message: 'status' });

		console.log(colorBgBlack + colorBright + colorFgMagenta + status + colorReset);
	}

	static sfdxShowComplete() {
		console.log(colorBgBlack + colorBright + colorFgGreen + 'Task Completed' + colorReset);
		console.log(colorBgBlack + colorBright + colorFgGreen + new Date() + colorReset);
	}
}

// Define variables
let showTimestamp = false;
let showLineNumbers = false;
let clearScreenCode = '\x1B[2J';

// Color Modes
let colorReset = '\x1b[0m';
let colorBright = '\x1b[1m';
let colorDim = '\x1b[2m';
let colorUnderscore = '\x1b[4m';
let colorBlink = '\x1b[5m';
let colorReverse = '\x1b[7m';
let colorHidden = '\x1b[8m';

// Color Foreground
let colorFgBlack = '\x1b[30m';
let colorFgRed = '\x1b[31m';
let colorFgGreen = '\x1b[32m';
let colorFgYellow = '\x1b[33m';
let colorFgBlue = '\x1b[34m';
let colorFgMagenta = '\x1b[35m';
let colorFgCyan = '\x1b[36m';
let colorFgWhite = '\x1b[37m';
let colorFgGray = '\x1b[90m';

// Color Background
let colorBgBlack = '\x1b[40m';
let colorBgRed = '\x1b[41m';
let colorBgGreen = '\x1b[42m';
let colorBgYellow = '\x1b[43m';
let colorBgBlue = '\x1b[44m';
let colorBgMagenta = '\x1b[45m';
let colorBgCyan = '\x1b[46m';
let colorBgWhite = '\x1b[47m';
