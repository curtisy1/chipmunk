import { Transport } from '../ipc/transport';
import {
    InstanceConstructor as LoggerInstanceConstructor,
    Instance as LoggerInstance,
} from './logger';

export class Scope {
    private _transport: Transport | undefined;
    private _logger: LoggerInstanceConstructor<any> | undefined;

    public setTransport(transport: Transport) {
        if (this._transport !== undefined) {
            throw new Error(`Transport can be setup only once`);
        }
        if (this._logger !== undefined) {
            new this._logger('@platform').debug(`IPC transport is up`);
        }
        this._transport = transport;
    }

    public getTransport(): Transport {
        if (this._transport === undefined) {
            throw new Error(`Transport isn't setup`);
        }
        return this._transport;
    }

    public setLogger(logger: LoggerInstanceConstructor<any>) {
        this._logger = logger;
        new this._logger('@platform').debug(`logger is up`);
    }

    public getLogger(alias: string): LoggerInstance {
        if (this._logger === undefined) {
            throw new Error(`Logger isn't setup`);
        }
        return new this._logger(alias);
    }
}

export const scope = new Scope();
