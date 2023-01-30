import axios from 'axios';
import { findWorkspacePackagesNoCheck } from '@pnpm/find-workspace-packages';
import pLimit from 'p-limit';

async function getSimilarPackages(packageName: string) {
    const searchUrl =
        'https://npm-trends-proxy.uidotdev.workers.dev/s/related_packages?search_query[]={packageName}&limit=10';
    const requestUrl = searchUrl.replace('{packageName}', encodeURIComponent(packageName));
    const { data: similarPackageNames } = await axios.get<string[]>(requestUrl);
    return similarPackageNames;
}

async function getProjectDeps(projectRoot: string) {
    const packages = await findWorkspacePackagesNoCheck(projectRoot);
    const deps = new Set<string>();
    for (const pkg of packages) {
        const { name, dependencies } = pkg.manifest;
        if (name && !/^@scripts\//.test(name) && dependencies) {
            for (const dep of Object.keys(dependencies)) {
                deps.add(dep);
            }
        }
    }
    return [...deps];
}

function isChildSet(childSet: Set<string>, parentSet: Set<string>) {
    for (const value of childSet) {
        if (!parentSet.has(value)) return false;
    }
    return true;
}

async function main() {
    const projectRoot = process.argv[2] ?? process.cwd();
    const deps = await getProjectDeps(projectRoot);
    const depSet = new Set(deps);
    const depToSetMap = new Map<string, Set<string> | undefined>(
        deps.map((dep) => [dep, undefined]),
    );
    const limit = pLimit(50);
    await Promise.all(
        deps.map((dep) =>
            limit(async () => {
                const similarPackages = await getSimilarPackages(dep);
                if (similarPackages.length === 0) return;

                const localSimilarPackages = similarPackages.filter((pkg) => depSet.has(pkg));
                if (localSimilarPackages.length === 0) return;

                depToSetMap.set(dep, new Set([dep, ...localSimilarPackages]));
            }),
        ),
    );

    const similarPackageSets: Array<Set<string>> = [];
    for (const similarPackageSet of [...new Set(depToSetMap.values())]) {
        if (similarPackageSet) {
            similarPackageSets.push(similarPackageSet);
        }
    }

    const resultSets = new Set([...similarPackageSets]);
    for (const similarPackageSet1 of similarPackageSets) {
        for (const similarPackageSet2 of similarPackageSets) {
            if (
                similarPackageSet2 !== similarPackageSet1 &&
                isChildSet(similarPackageSet2, similarPackageSet1)
            ) {
                if (similarPackageSet2.size === similarPackageSet1.size) {
                    if (resultSets.has(similarPackageSet1) && resultSets.has(similarPackageSet2)) {
                        resultSets.delete(similarPackageSet2);
                    }
                } else {
                    resultSets.delete(similarPackageSet2);
                }
            }
        }
    }

    for (const similarPackageSet of resultSets) {
        console.log([...similarPackageSet].sort().join('\t'));
    }
}

main();
