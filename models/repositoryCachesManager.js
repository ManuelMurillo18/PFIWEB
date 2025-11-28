import * as utilities from "../utilities.js";
import * as serverVariables from "../serverVariables.js";

let repositoryCachesExpirationTime = serverVariables.get("main.repository.CacheExpirationTime");

// Repository file data models cache
global.repositoryCaches = [];
global.cachedRepositoriesCleanerStarted = false;

export default class RepositoryCachesManager {
    static add(model, data) {
        if (!cachedRepositoriesCleanerStarted) {
            cachedRepositoriesCleanerStarted = true;
            RepositoryCachesManager.startCachedRepositoriesCleaner();
        }
        if (model != "") {
            RepositoryCachesManager.clear(model);
            repositoryCaches.push({
                model,
                data,
                Expire_Time: utilities.nowInSeconds() + repositoryCachesExpirationTime
            });
            console.log(BgWhite + FgBlue, `[${model} data has been cached]`);
        }
    }
    static startCachedRepositoriesCleaner() {
        // periodic cleaning of expired cached repository data
        setInterval(RepositoryCachesManager.flushExpired, repositoryCachesExpirationTime / 2 * 1000);
        console.log(BgWhite + FgBlue, "[Periodic cached repositories data cleaning process started...]");

    }
    static clear(model) {
        repositoryCaches = repositoryCaches.filter(cache => cache.model != model);
    }
    static find(model) {
        try {
            if (model != "") {
                for (let cache of repositoryCaches) {
                    if (cache.model == model) {
                        // renew cache
                        cache.Expire_Time = utilities.nowInSeconds() + repositoryCachesExpirationTime;
                        console.log(BgWhite + FgBlue, `[${cache.model} data retrieved from cache]`);
                        return cache.data;
                    }
                }
            }
        } catch (error) {
            console.log(BgWhite + FgRed, "[repository cache error!]", error);
        }
        return null;
    }
    static flushExpired() {
        let now = utilities.nowInSeconds();
        for (let cache of repositoryCaches) {
            if (cache.Expire_Time <= now) {
                console.log(BgWhite + FgBlue, `[${cache.model} data expired]`);
            }
        }
        repositoryCaches = repositoryCaches.filter(cache => cache.Expire_Time > now);
    }
}
