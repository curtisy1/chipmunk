import { spawn, ChildProcess } from 'child_process';
import { ReadStream } from 'fs';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

import * as path from 'path';
import * as fs from 'fs';
import * as FS from '../../../tools/fs';

import Logger from '../../../tools/env.logger';
import guid from '../../../tools/tools.guid';
import ServicePaths from '../../../services/service.paths';
import NullWritableStream from '../../../classes/stream.writable.null';
import Transform from './transform.inspecting';

export interface IMapData {
    map: { [key: number]: string[] };
    stats: { [key: string]: number };
}

export interface IScaledMapData {
    map: { [key: number]: { [key: string ]: number } };
    stats: { [key: string]: number };
}

type THandler = () => void;

export class OperationInspecting extends EventEmitter {

    private _logger: Logger;
    private _streamFile: string;
    private _searchFile: string;
    private _streamGuid: string;
    private _cleaners: Map<string, THandler> = new Map();
    private _readTo: number = 0;
    private _readFrom: number = 0;
    private _tasks: Map<string, CancelablePromise<void, void>> = new Map();
    private _inspected: IMapData = {
        stats: {},
        map: {},
    };

    constructor(streamGuid: string, streamFile: string, searchFile: string) {
        super();
        this._streamGuid = streamGuid;
        this._streamFile = streamFile;
        this._searchFile = searchFile;
        this._logger = new Logger(`Search operation: inspecting (${streamGuid})`);
    }

    public destroy() {
        this.removeAllListeners();
    }

    public perform(regExp: RegExp): CancelablePromise<void, void> {
        const taskId: string = guid();
        const task: CancelablePromise<void, void> = new CancelablePromise<void, void>((resolve, reject, cancel, self) => {
            // Listen cancel for case if it will be canceled while fs.stat
            let canceled: boolean = false;
            self.cancel(() => {
                canceled = true;
                this._clear(taskId);
            });
            FS.exist(this._streamFile).then((exists: boolean) => {
                if (canceled) {
                    return;
                }
                if (!exists) {
                    return resolve(undefined);
                }
                if (this._readFrom >= this._readTo || isNaN(this._readFrom) || !isFinite(this._readFrom) || isNaN(this._readTo) || !isFinite(this._readTo)) {
                    return reject(new Error(`(inspecting) Cannot perform search because a range isn't correct: from = ${this._readFrom}; to = ${this._readTo}`));
                }
                // Start measuring
                const measurer = this._logger.measure(`inspecting #${guid()}`);
                // Create reader
                const reader: ReadStream = fs.createReadStream(this._searchFile, { encoding: 'utf8', start: this._readFrom, end: this._readTo });
                // Create writer
                const writer: NullWritableStream = new NullWritableStream();
                // Create transform
                const transform = new Transform({});
                // Create process
                const process = spawn(ServicePaths.getRG(), this._getProcArgs(regExp, '-'), {
                    cwd: path.dirname(this._streamFile),
                    stdio: [ 'pipe', 'pipe', 'pipe' ],
                    detached: true,
                });
                // Pipe process with reader: reader -> ripgrep
                reader.pipe(process.stdin);
                // Pipe process with writer: ripgrep -> writer (NULL writer)
                process.stdout.pipe(transform).pipe(writer);
                // Handeling errors
                [process, process.stdin, process.stdout, writer, reader].forEach((smth: NullWritableStream | ChildProcess | Readable | ReadStream | Writable) => {
                    smth.once('error', (error: Error) => {
                        if (!this._cleaners.has(taskId)) {
                            return;
                        }
                        this._logger.error(`Error during inspecting: ${error.message}`);
                        reject(error);
                    });
                });
                // Handeling finishing
                process.once('close', () => {
                    this._store(regExp.source, transform.getLines());
                    resolve(undefined);
                });
                // Create cleaner
                this._cleaners.set(taskId, () => {
                    // Kill process
                    process.removeAllListeners();
                    process.stdin.removeAllListeners();
                    process.stdin.end();
                    process.stdin.destroy();
                    process.stdout.removeAllListeners();
                    process.stdout.unpipe();
                    process.stdout.destroy();
                    process.kill();
                    // Stop reader
                    reader.removeAllListeners();
                    reader.close();
                    reader.destroy();
                    // Stop transform
                    transform.stop();
                    transform.removeAllListeners();
                    // Stop writer
                    writer.removeAllListeners();
                    // Remove cleaner
                    this._cleaners.delete(taskId);
                    // Measure spent time
                    measurer();
                    this._cleaners.delete(taskId);
                    this._tasks.delete(taskId);
                    this._logger.debug(`RG process is finished/killed (task ID: ${taskId})`);
                });
            }).catch((err: Error) => {
                this._logger.warn(`Fail to check target file "${this._streamFile}" due error: ${err.message}`);
                return resolve(undefined);
            });
        }).finally(this._clear.bind(this, taskId));
        this._tasks.set(taskId, task);
        return task;
    }

    public drop() {
        // Cancel all tasks before
        this._tasks.forEach((task: CancelablePromise<void, void>, id: string) => {
            this._logger.warn(`Dropping search controller, while search operation is still in progress. Current task "${id}" will be dropped`);
            task.break();
        });
        // Drop data
        this._tasks.clear();
        this._cleaners.clear();
        this._readTo = 0;
        this._readFrom = 0;
        this._inspected = { map: {}, stats: {} };
    }

    public setReadTo(read: number) {
        this._readFrom = this._readTo;
        this._readTo = read;
    }

    public getReadFrom(): number {
        return this._readFrom;
    }

    public getMap(streamLength: number, factor: number, details: boolean, range?: { begin: number, end: number }): IScaledMapData {
        const measurePostProcessing = this._logger.measure(`scaling`);
        const scaled: IScaledMapData = {
            map: {},
            stats: this._inspected.stats,
        };
        if (range === undefined) {
            const rate: number = Math.floor(streamLength / factor);
            if (rate <= 1) {
                return scaled;
            }
            for (let i = 1; i <= factor; i += 1) {
                scaled.map[i] = {};
                const ref = scaled.map[i];
                for (let j = (i - 1) * rate; j <= i * rate; j += 1) {
                    if (this._inspected.map[j] !== undefined) {
                        this._inspected.map[j].forEach((match: string) => {
                            if (ref[match] === undefined) {
                                ref[match] = 1;
                            } else {
                                ref[match] += 1;
                            }
                        });
                        if (!details) {
                            break;
                        }
                    }
                }
            }
        } else {
            const rangeLength: number = range.end - range.begin;
            if (rangeLength < 0 || isNaN(rangeLength) || !isFinite(rangeLength)) {
                this._logger.warn(`Invalid range to scale map correctly`);
                return scaled;
            }
            const rate: number = Math.floor(rangeLength / factor);
            if (rate <= 1) {
                return scaled;
            }
            for (let i = 1; i <= factor; i += 1) {
                scaled.map[i] = {};
                const ref = scaled.map[i];

                for (let j = range.begin + (i - 1) * rate; j <= range.begin + i * rate; j += 1) {
                    if (j > range.end) {
                        break;
                    }
                    if (this._inspected.map[j] !== undefined) {
                        this._inspected.map[j].forEach((match: string) => {
                            if (ref[match] === undefined) {
                                ref[match] = 1;
                            } else {
                                ref[match] += 1;
                            }
                        });
                        if (!details) {
                            break;
                        }
                    }
                }
            }
        }
        measurePostProcessing();
        return scaled;

    }

    private _store(request: string, matches: number[]) {
        const measurePostProcessing = this._logger.measure(`mapping "${request}"`);
        this._inspected.stats[request] = this._inspected.stats[request] === undefined ? 0 : this._inspected.stats[request];
        this._inspected.stats[request] += matches.length;
        matches.forEach((line: number) => {
            if (this._inspected.map[line] === undefined) {
                this._inspected.map[line] = [request];
            } else if (this._inspected.map[line].indexOf(request) === -1) {
                this._inspected.map[line].push(request);
            }
        });
        measurePostProcessing();
    }

    private _clear(id: string) {
        const cleaner: THandler | undefined = this._cleaners.get(id);
        if (cleaner !== undefined) {
            cleaner();
        }
    }

    private _isCaseInsensitive(reg: RegExp): boolean {
        return reg.flags.includes('i') ? true : false;
    }

    private _getProcArgs(reg: RegExp, target: string): string[] {
        // TODO: here also should be excluded possible matches with line index and tag in line of source file
        const args = [
            '-N',
            '--text', // https://github.com/BurntSushi/ripgrep/issues/306 this issue is about a case, when not printable symble is in a file
            '--pcre2',
            this._isCaseInsensitive(reg) ? '-i' : '',
            '-e',
            reg.source,
            target,
        ].filter(x => x !== '');
        this._logger.env(`Next regular expresition will be used with ripgrep: ${reg}. Full command: rg ${args.join(' ')}`);
        return args;
    }
}
