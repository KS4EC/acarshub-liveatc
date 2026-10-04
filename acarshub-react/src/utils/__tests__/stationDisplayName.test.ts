// Copyright (C) 2022-2026 Frederick Clausen II
// This file is part of acarshub <https://github.com/sdr-enthusiasts/docker-acarshub>.

import { describe, expect, it } from "vitest";
import { getStationDisplayName } from "../stationDisplayName";

describe("getStationDisplayName", () => {
	it("uses KPBI for the Palm Beach receiver hostname", () => {
		expect(getStationDisplayName("kpbi2-2h1r-acars-pi5")).toBe("KPBI");
	});

	it("uses 8A7 for every LiveATC-Test frequency channel", () => {
		expect(getStationDisplayName("LiveATC-Test-130.025")).toBe("8A7");
		expect(getStationDisplayName("liveatc-test-131.550")).toBe("8A7");
	});

	it("keeps unrecognized station IDs unchanged", () => {
		expect(getStationDisplayName("CS-KABQ-ACARS")).toBe("CS-KABQ-ACARS");
	});
});
