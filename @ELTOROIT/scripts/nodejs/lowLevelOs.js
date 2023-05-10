import Logs2 from './logs.js';
import { resolve } from 'path';
import fetch from 'node-fetch';
import Colors2 from './colors.js';
import * as fsExtra from 'fs-extra';
import * as fs from 'node:fs/promises';
import ET_Asserts from './etAsserts.js';
import { exec, spawn } from 'node:child_process';

export default class LowLevelOS {
	static async getFullPath({ config, relativePath, skipCheck = false }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: relativePath, message: 'relativePath' });

		let path = resolve(relativePath);
		if (skipCheck) {
			return path;
		} else {
			if (await LowLevelOS.fsExists({ config, path })) {
				return path;
			} else {
				let msg = `${path} could not be found`;
				Logs2.reportErrorMessage({ config, msg });
				throw new Error(msg);
			}
		}
	}

	static async doesFileExist({ config, path }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		const stat = await fs.stat(path);
		return stat.size > 0;
	}

	static async readFile({ config, path, isCreate = false }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		if (config.debug) Colors2.debug({ msg: 'Reading file: ' + path });
		const fileExists = await LowLevelOS.doesFileExist({ config, path });
		if (fileExists) {
			const fileContents = await fs.readFile(path, 'utf8');
			return fileContents;
		} else {
			let err = 'Files does not exist: ' + path;
			Logs2.reportErrorMessage({ config, msg: err });
			if (isCreate) {
				await LowLevelOS.writeFile(path, '{}');
			}
			throw new Error(err);
		}
	}

	static async deleteFolder({ config, path }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		if (config.debug) Colors2.debug({ msg: 'Deleting folder: ' + path });
		await fsExtra.remove(path);
	}

	static async recreateFolder({ config, path }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		if (config.debug) Colors2.debug({ msg: 'Recreating folder: ' + path });
		await fsExtra.remove(path);
		await fsExtra.ensureDir(path);
	}

	static async writeFile({ config, path, data }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });
		ET_Asserts.hasData({ value: data, message: 'data' });

		if (config.verbose) Colors2.debug({ msg: Colors2.getPrettyJson({ obj: { msg: 'Writing file: ' + path, data } }) });
		try {
			await fs.writeFile(path, data);
		} catch (ex) {
			let msg = `Error creating file: ${path}"`;
			Logs2.reportException({ config: this.config, msg, ex });
			throw ex;
		}
	}

	static async readLines({ config, path }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		if (config.debug) Colors2.debug({ msg: `Reading lines from [${path}]` });

		let fileContents = await LowLevelOS.readFile({ config, path });
		let lines = fileContents.split('\r\n');
		lines = lines.map((line) => line.trim());
		return lines;
	}

	static async fsReadDir({ config, path }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		if (config.debug) Colors2.debug({ msg: 'Finding files in: ' + path });
		return await fs.readdir(path);
	}

	static async fsExists({ config, path }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		if (config.debug) Colors2.debug({ msg: 'Validating full path: ' + path });
		try {
			await fs.stat(path);
			return true;
		} catch (ex) {
			return false;
		}
	}

	static async fsAppendFile({ config, path, data }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });
		ET_Asserts.hasData({ value: data, message: 'data' });

		if (config.debug) Colors2.debug({ msg: `Appending [${data}] to [${path}]` });
		return await fs.appendFile(path, data);
	}

	static async execute({ config, command }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: command, message: 'command' });

		// Can't do async/await because it has a callback function
		return new Promise((resolve, reject) => {
			if (config.debug) Colors2.debug({ msg: 'EXECUTING: ' + command });

			let output = {
				cmd: command,
				error: null,
				stdout: null,
				stderr: null,
			};
			exec(command, (error, stdout, stderr) => {
				output.stdout = stdout ? stdout.trim() : '';
				output.stderr = stderr ? stderr.trim() : '';
				output.error = error ? Colors2.getPrettyJson({ obj: error }) : '';
				if (config.debug) Colors2.debug({ msg: 'OUTPUT: ' + Colors2.getPrettyJson({ obj: output }) });
				if (!error || error.code === 0) {
					resolve(output);
				} else {
					reject(output);
				}
			});
		});
	}

	static async executeAsync({ config, callbackAreWeDone, app, args, cwd, expectedCode }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: callbackAreWeDone, message: 'callbackAreWeDone' });
		ET_Asserts.hasData({ value: app, message: 'app' });
		ET_Asserts.hasData({ value: expectedCode, message: 'expectedCode' });

		// Can't do async/await because it has events
		return new Promise((resolve, reject) => {
			let currentTest = { ...config.currentTest };
			if (config.debug) Colors2.debug({ msg: 'EXECUTING (Async): ' + Colors2.getPrettyJson({ obj: { app, args, cwd } }) });

			let response = [];

			const forceResolve = () => {
				process.stdout.unref();
				process.stderr.unref();
				process.unref();
				resolve();
			};

			const reportData = ({ eventName, item }) => {
				ET_Asserts.hasData({ value: eventName, message: 'eventName' });
				ET_Asserts.hasData({ value: item, message: 'item' });

				let msg = `${eventName}: ${item.toString()}`;
				if (eventName === 'CLOSE') {
					msg = `${eventName}: ${Colors2.getPrettyJson({ obj: item })}`;
				}
				response.push(msg);
				let notification = { currentTest, eventName, app, args, cwd, msg, response, forceResolve };
				if (config.debug) Colors2.debug({ msg: `${notification.currentTest.testName} | ${notification.msg.trim()}` });
				// if (await callbackAreWeDone(notification)) resolve();
				callbackAreWeDone(notification);
			};

			const report = ({ eventName, data }) => {
				ET_Asserts.hasData({ value: eventName, message: 'eventName' });
				ET_Asserts.hasData({ value: data, message: 'data' });

				// More elements
				if (data.length > 1) {
					debugger;
					for (let item of data) {
						reportData({ eventName, item });
					}
				} else {
					// First element
					let item = data;
					reportData({ eventName, item });
				}
			};

			const process = spawn(app, args, { detach: true, shell: true, cwd });
			process.on('spawn', (...data) => {
				report({ eventName: 'SPAWN', data });
			});

			process.on('error', (...data) => {
				report({ eventName: 'ERROR', data });
			});

			process.stdout.on('data', (...data) => {
				report({ eventName: 'STDOUT', data });
			});

			process.stderr.on('data', (...data) => {
				report({ eventName: 'STDERR', data });
			});

			process.on('close', (code, signal) => {
				report({ eventName: 'CLOSE', data: { code, signal } });
				try {
					ET_Asserts.equals({ expected: expectedCode, actual: code, message: 'Application dis dot completed succesfully' });
					resolve(response);
				} catch (ex) {
					let msg = 'Error executing app';
					Logs2.reportException({ config, msg, ex });
					reject(response);
				}
			});
		});
	}

	static async fetch({ config, url, method = 'GET', body, isJsonBody }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: url, message: 'url' });
		ET_Asserts.hasData({ value: method, message: 'method' });
		ET_Asserts.includes({ value: method, listValues: ['GET', 'POST'], message: 'HTTP method not allowed' });
		if (method === 'POST') {
			ET_Asserts.hasData({ value: body, message: 'body' });
		}

		let response;
		if (config.debug) Colors2.info({ msg: `Fetch (${method}) ${url}` });
		if (method === 'GET') {
			response = await fetch(url);
		} else {
			if (isJsonBody) {
				response = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
			} else {
				response = await fetch(url, { method: 'POST', body });
			}
		}
		return {
			response,
			body: await response.text(),
		};
	}

	static async checkPath({ config, path }) {
		ET_Asserts.hasData({ value: config, message: 'config' });
		ET_Asserts.hasData({ value: path, message: 'path' });

		if (config.debug) Colors2.info({ msg: 'CHECK PATH: [' + path + ']' });
		let command = `DIR "${path}" /B`;
		let expected = path.split('\\').pop();
		if (expected.endsWith('*')) {
			// Remove last character, if it's a wildcard asterisk.
			expected = expected.replace(/.$/, '');
		}
		let output = await LowLevelOS.execute({ config, command });
		if (output.stderr) {
			let err = output.stderr;
			Logs2.reportErrorMessage({ config, msg: err });
			throw new Error(err);
		} else {
			if (output.stdout.toLowerCase().indexOf(expected.toLowerCase()) >= 0) {
				if (config.debug) Colors2.success({ msg: `VALID: [Found: '${expected}]` });
				return;
			} else {
				let err = output;
				Logs2.reportErrorMessage({ config, msg: err });
				throw new Error(err);
			}
		}
	}
}
