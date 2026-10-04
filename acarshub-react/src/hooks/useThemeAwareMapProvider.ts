// Copyright (C) 2022-2026 Frederick Clausen II
// This file is part of acarshub <https://github.com/sdr-enthusiasts/docker-acarshub>.

// acarshub is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// acarshub is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with acarshub.  If not, see <http://www.gnu.org/licenses/>.

import { useEffect } from "react";
import { useSettingsStore, useTheme } from "../store/useSettingsStore";
import type { MapProvider } from "../types";
import { mapLogger } from "../utils/logger";

const DEFAULT_MAP_PROVIDER: MapProvider = "osm";

/**
 * Hook: useThemeAwareMapProvider
 *
 * Keeps the map on the no-key OpenStreetMap default unless the user has
 * explicitly selected another provider.
 *
 * Default behavior:
 * - Both themes → OpenStreetMap
 *
 * User override:
 * - If user selects a provider in Settings, this hook stops auto-switching
 * - User's explicit choice is always respected
 */
export function useThemeAwareMapProvider(): void {
  const theme = useTheme();
  const mapSettings = useSettingsStore((state) => state.settings.map);
  const setMapProvider = useSettingsStore((state) => state.setMapProvider);

  useEffect(() => {
    // Only auto-switch if user hasn't explicitly selected a provider
    if (mapSettings.userSelectedProvider) {
      mapLogger.debug("User has selected a map provider, skipping theme sync", {
        provider: mapSettings.provider,
        theme,
      });
      return;
    }

    // Only update if different from current
    if (mapSettings.provider !== DEFAULT_MAP_PROVIDER) {
      mapLogger.info("Restoring default map provider", {
        theme,
        oldProvider: mapSettings.provider,
        newProvider: DEFAULT_MAP_PROVIDER,
      });

      setMapProvider(DEFAULT_MAP_PROVIDER, false);
    }
  }, [
    theme,
    mapSettings.provider,
    mapSettings.userSelectedProvider,
    setMapProvider,
  ]);
}
