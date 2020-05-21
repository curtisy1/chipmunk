import PluginIPCService from './ipc/plugin.ipc.service';
import ServiceConfig from './services/service.config';
import ServiceState from './services/service.state';
import ServiceSettings from './services/service.settings';

import GUID from './tools/tools.guid';
import Subscription from './tools/tools.subscription';
import { copy, isObject } from './tools/tools.object';

export { ServiceConfig as IServiceConfig } from './services/service.config';

export * from './services/service.settings';

export {
    PluginIPCService as IPluginIPCService,
    IPCMessages,
    IStreamInfo,
    IPipedStreamInfo,
    CStdoutSocketAliases,
} from './ipc/plugin.ipc.service';

export {
    IPCMessagePackage,
    IMessagePackage,
    getSequence,
} from './ipc/plugin.ipc.service.message';

export {
    GUID,
    Subscription,
    copy,
    isObject,
    ServiceConfig,
    ServiceSettings,
    ServiceState,
    PluginIPCService,
};

export default PluginIPCService;
