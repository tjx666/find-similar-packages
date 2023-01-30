import axios from 'axios';
import { findWorkspacePackagesNoCheck } from '@pnpm/find-workspace-packages';
import pLimit from 'p-limit';
async function getSimilarPackages(packageName) {
    const searchUrl = 'https://npm-trends-proxy.uidotdev.workers.dev/s/related_packages?search_query[]={packageName}&limit=10';
    const requestUrl = searchUrl.replace('{packageName}', encodeURIComponent(packageName));
    const { data: similarPackageNames } = await axios.get(requestUrl);
    return similarPackageNames;
}
async function getProjectDeps(projectRoot) {
    const packages = await findWorkspacePackagesNoCheck(projectRoot);
    const deps = new Set();
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
function isSubSet(subSet, parentSet) {
    for (const value of subSet) {
        if (!parentSet.has(value))
            return false;
    }
    return true;
}
async function main() {
    const projectRoot = process.argv[2] ?? process.cwd();
    const deps = await getProjectDeps(projectRoot);
    const depSet = new Set(deps);
    const depToSetMap = new Map(deps.map((dep) => [dep, undefined]));
    const limit = pLimit(50);
    await Promise.all(deps.map((dep) => limit(async () => {
        const similarPackages = await getSimilarPackages(dep);
        if (similarPackages.length === 0)
            return;
        const localSimilarPackages = similarPackages.filter((pkg) => depSet.has(pkg));
        if (localSimilarPackages.length === 0)
            return;
        depToSetMap.set(dep, new Set([dep, ...localSimilarPackages]));
    })));
    const similarPackageSets = [...depToSetMap.values()].filter(Boolean);
    const resultSets = new Set([...similarPackageSets]);
    for (const similarPackageSet1 of similarPackageSets) {
        for (const similarPackageSet2 of similarPackageSets) {
            if (similarPackageSet2 !== similarPackageSet1 &&
                isSubSet(similarPackageSet2, similarPackageSet1)) {
                if (similarPackageSet2.size === similarPackageSet1.size) {
                    if (resultSets.has(similarPackageSet1) && resultSets.has(similarPackageSet2)) {
                        resultSets.delete(similarPackageSet2);
                    }
                }
                else {
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
