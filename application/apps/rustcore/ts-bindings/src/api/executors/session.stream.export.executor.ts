import { TExecutor, Logger, CancelablePromise, VoidExecutor } from './executor';
import { RustSession } from '../../native/native.session';
import { EventProvider } from '../../api/session.provider';

export interface IExportOptions {
    from: number;
    to: number;
    destFilename: string;
    keepFormat: boolean;
}

export const executor: TExecutor<void, IExportOptions> = (
    session: RustSession,
    provider: EventProvider,
    logger: Logger,
    options: IExportOptions,
): CancelablePromise<void> => {
    return VoidExecutor<IExportOptions>(
        session,
        provider,
        logger,
        options,
        function (session: RustSession, options: IExportOptions): string | Error {
            return session.export(options);
        },
        'export',
    );
};
