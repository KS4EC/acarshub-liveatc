// Copyright (C) 2022-2026 Frederick Clausen II
// This file is part of acarshub <https://github.com/sdr-enthusiasts/docker-acarshub>.

const STATION_DISPLAY_ALIASES: ReadonlyArray<{
	matches: (stationId: string) => boolean;
	alias: string;
}> = [
	{
		matches: (stationId) => stationId.toLowerCase() === "kpbi2-2h1r-acars-pi5",
		alias: "KPBI",
	},
	{
		matches: (stationId) => /^liveatc-test(?:-|$)/i.test(stationId),
		alias: "8A7",
	},
];

/**
 * Returns a concise public label while retaining the original station ID in
 * message data for filtering, grouping, and diagnostics.
 */
export function getStationDisplayName(stationId: string): string {
	return (
		STATION_DISPLAY_ALIASES.find(({ matches }) => matches(stationId))?.alias ??
		stationId
	);
}
