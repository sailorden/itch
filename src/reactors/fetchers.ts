import { Watcher } from "../reactors/watcher";
import rootLogger from "../logger";
const logger = rootLogger.child({ name: "fetchers" });

import * as actions from "../actions";

import { Fetcher, FetchReason } from "../fetchers/fetcher";
import { IStore } from "../types";
import DashboardFetcher from "../fetchers/dashboard-fetcher";
import CollectionsFetcher from "../fetchers/collections-fetcher";
import LibraryFetcher from "../fetchers/library-fetcher";

import GameFetcher from "../fetchers/game-fetcher";
import UserFetcher from "../fetchers/user-fetcher";
import CollectionFetcher from "../fetchers/collection-fetcher";
import LocationFetcher from "../fetchers/location-fetcher";

import Context from "../context";
import { DB } from "../db";

import { some, throttle, union } from "underscore";
import { Space } from "../helpers/space";

let fetching: {
  [key: string]: boolean;
} = {};

let lastFetchers: {
  [key: string]: any;
} = {};

let nextFetchReason: {
  [key: string]: FetchReason;
} = {};

export async function queueFetch(
  store: IStore,
  db: DB,
  tab: string,
  reason: FetchReason
) {
  if (fetching[tab]) {
    nextFetchReason[tab] = reason;
    return;
  }

  const fetcherClass = getFetcherClass(store, tab);
  if (!fetcherClass) {
    return;
  }

  const lastFetcher = lastFetchers[tab];
  if (lastFetcher && lastFetcher.constructor !== fetcherClass) {
    try {
      lastFetcher.clean();
      delete lastFetchers[tab];
    } catch (e) {
      logger.warn(
        `While cleaning ${lastFetcher.constructor
          .name} => ${fetcherClass.name} for ${tab}: ${e.stack}`
      );
    }
  }

  fetching[tab] = true;

  const fetcher = new fetcherClass();
  lastFetchers[tab] = fetcher;
  const ctx = new Context(store, db);
  fetcher.hook(ctx, tab, reason);

  fetcher
    .run()
    .catch(e => {
      // well, logging will have to do
      fetcher.logger.error(`failed: ${e.stack}`);
    })
    .then(() => {
      delete fetching[tab];

      const nextReason = nextFetchReason[tab];
      if (nextReason) {
        delete nextFetchReason[tab];
        queueFetch(store, db, tab, nextReason).catch(err => {
          logger.error(`In queued fetcher: ${err.stack}`);
        });
      }
    });
}

function getFetcherClass(store: IStore, tab: string): typeof Fetcher {
  const sp = Space.fromStore(store, tab);

  switch (sp.prefix) {
    case "dashboard":
      return DashboardFetcher;
    case "collections": {
      if (sp.suffix) {
        return CollectionFetcher;
      } else {
        return CollectionsFetcher;
      }
    }
    case "dashboard":
      return DashboardFetcher;
    case "library":
      return LibraryFetcher;
    case "games":
      return GameFetcher;
    case "users":
      return UserFetcher;
    case "collections":
      return CollectionFetcher;
    case "locations":
      return LocationFetcher;
  }
}

const queueCleanup = throttle((store: IStore) => {
  const validKeys = new Set(Object.keys(store.getState().session.tabData));

  const allKeys = union(
    Object.keys(lastFetchers),
    Object.keys(nextFetchReason),
    Object.keys(fetching)
  );
  for (const k of allKeys) {
    if (!validKeys.has(k)) {
      logger.debug(`Cleaning up ${k}`);
      delete lastFetchers[k];
      delete fetching[k];
      delete nextFetchReason[k];
    }
  }
}, 3000 /* space out cleanups */);

export default function(watcher: Watcher, db: DB) {
  // changing tabs? it's a fetching
  watcher.on(actions.tabChanged, async (store, action) => {
    const { tab } = action.payload;
    // if we just focused a tab, it shouldn't be marked 'restored' anymore
    const tabData = store.getState().session.tabData[tab];
    if (tabData && tabData.restored) {
      store.dispatch(
        actions.tabDataFetched({
          tab,
          data: { restored: false },
          shallow: true,
        })
      );
    }

    queueFetch(store, db, tab, FetchReason.TabChanged);
  });

  watcher.on(actions.tabsChanged, async (store, action) => {
    queueCleanup(store);
  });

  // tab navigated to something else? let's fetch
  watcher.on(actions.tabEvolved, async (store, action) => {
    queueFetch(store, db, action.payload.tab, FetchReason.TabEvolved);
  });

  // tab reloaded by user? let's fetch!
  watcher.on(actions.tabReloaded, async (store, action) => {
    queueFetch(store, db, action.payload.tab, FetchReason.TabReloaded);
  });

  // tab got new params? it's a fetching!
  watcher.on(actions.tabParamsChanged, async (store, action) => {
    queueFetch(store, db, action.payload.tab, FetchReason.TabParamsChanged);
  });

  // window gaining focus? fetch away!
  watcher.on(actions.windowFocusChanged, async (store, action) => {
    if (action.payload.focused) {
      const currentTab = store.getState().session.navigation.tab;
      queueFetch(store, db, currentTab, FetchReason.WindowFocused);
    }
  });

  watcher.on(actions.commonsUpdated, async (store, action) => {
    const currentTab = store.getState().session.navigation.tab;
    queueFetch(store, db, currentTab, FetchReason.CommonsChanged);
  });

  const watchedPreferences = [
    "onlyCompatibleGames",
    "onlyInstalledGames",
    "onlyOwnedGames",
  ];

  watcher.on(actions.updatePreferences, async (store, action) => {
    const prefs = action.payload;
    if (some(watchedPreferences, k => prefs.hasOwnProperty(k))) {
      const currentTabId = store.getState().session.navigation.tab;
      queueFetch(store, db, currentTabId, FetchReason.TabParamsChanged);
    }
  });
}
