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

                let existedSet = depToSetMap.get(dep);
                if (existedSet === undefined) {
                    const similarPackagesOwnSets: Array<Set<string>> = [];
                    const hasOwnSetSimilarPackages: string[] = [];
                    for (const localSimilarPackage of localSimilarPackages) {
                        const similarPackagesOwnSet = depToSetMap.get(localSimilarPackage);
                        if (similarPackagesOwnSet !== undefined) {
                            hasOwnSetSimilarPackages.push(localSimilarPackage);
                            similarPackagesOwnSets.push(similarPackagesOwnSet!);
                        }
                    }
                    if (similarPackagesOwnSets.length > 0) {
                        if (similarPackagesOwnSets.length === 1) {
                            existedSet = similarPackagesOwnSets[0];
                            depToSetMap.set(dep, existedSet);
                            existedSet.add(dep);
                        }

                        if (similarPackagesOwnSets.length === 2) {
                            existedSet = new Set(
                                similarPackagesOwnSets.map((set) => [...set]).flat(),
                            );
                            for (const pkg of [dep, ...hasOwnSetSimilarPackages]) {
                                depToSetMap.set(pkg, existedSet);
                            }
                        }

                        for (const pkg of localSimilarPackages) {
                            existedSet!.add(pkg);
                        }

                        return;
                    }

                    const similarPackageSet = new Set([dep]);
                    depToSetMap.set(dep, similarPackageSet);
                    for (const pkg of localSimilarPackages) {
                        similarPackageSet.add(pkg);
                        depToSetMap.set(pkg, similarPackageSet);
                    }
                } else {
                    localSimilarPackages.forEach((p) => existedSet!.add(p));
                }
            }),
        ),
    );

    for (const similarPackageSet of [...new Set(depToSetMap.values())]) {
        if (similarPackageSet) {
            console.log([...similarPackageSet].join('\t'));
        }
    }
}

main();
