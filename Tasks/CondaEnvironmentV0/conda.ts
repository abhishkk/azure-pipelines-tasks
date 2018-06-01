import * as fs from 'fs';
import * as path from 'path';

import * as task from 'vsts-task-lib/task';

import * as internal from './conda_internal';
import { Platform } from './taskutil';

interface TaskParameters {
    environmentName?: string,
    packageSpecs?: string,
    updateConda?: boolean,
    otherOptions?: string,
    cleanEnvironment?: boolean
}

export async function condaEnvironment(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    // Find Conda on the system
    const condaRoot = await (async () => {
        const preinstalledConda = internal.findConda(platform);
        if (preinstalledConda) {
            return preinstalledConda;
        } else {
            throw new Error(task.loc('CondaNotFound'));
        }
    })();

    if (parameters.updateConda) {
        await internal.updateConda(condaRoot, platform);
    }

    internal.prependCondaToPath(condaRoot, platform);

    if (parameters.environmentName) { // activate the environment, creating it if it does not exist
        const environmentsDir = path.join(condaRoot, 'envs');
        const environmentPath = path.join(environmentsDir, parameters.environmentName);

        if (fs.existsSync(environmentPath) && !parameters.cleanEnvironment) {
            console.log(task.loc('ReactivateExistingEnvironment', environmentPath));
        } else { // create the environment
            if (fs.existsSync(environmentPath)) {
                console.log(task.loc('CleanEnvironment', environmentPath));
                task.rmRF(environmentPath);
            }
            await internal.createEnvironment(environmentPath, parameters.packageSpecs, parameters.otherOptions);
        }

        internal.activateEnvironment(environmentsDir, parameters.environmentName, platform);
    } else if (parameters.packageSpecs) {
        internal.installPackagesGlobally(parameters.packageSpecs, parameters.otherOptions);
    }
}