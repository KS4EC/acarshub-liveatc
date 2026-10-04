// Copyright (C) 2022-2026 Frederick Clausen II
// This file is part of acarshub <https://github.com/sdr-enthusiasts/docker-acarshub>.

import type { AcarsMsg } from "@acarshub/types";
import { describe, expect, it } from "vitest";
import { deriveCpdlcInsights } from "../cpdlcInsights";

function message(
  uid: string,
  timestamp: number,
  libacars: Record<string, unknown> | string,
): AcarsMsg {
  return {
    uid,
    timestamp,
    station_id: "test",
    message_type: "VDLM2",
    libacars,
  };
}

function uplink(
  id: number,
  choice: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return {
    msg_type: "fans1a_cpdlc_msg",
    crc_ok: true,
    cpdlc: {
      err: false,
      atc_uplink_msg: {
        header: { msg_id: id },
        atc_uplink_msg_element_id: { choice, data },
      },
    },
  };
}

function downlink(
  messageRef: number,
  choice: string,
): Record<string, unknown> {
  return {
    msg_type: "fans1a_cpdlc_msg",
    crc_ok: true,
    cpdlc: {
      err: false,
      atc_downlink_msg: {
        header: { msg_id: 9, msg_ref: messageRef },
        atc_downlink_msg_element_id: { choice, data: {} },
      },
    },
  };
}

describe("deriveCpdlcInsights", () => {
  it("extracts a voice-frequency assignment and facility", () => {
    const result = deriveCpdlcInsights([
      message(
        "contact",
        1_700_000_000,
        uplink(3, "uM117ICAOunitnameFrequency", {
          icao_unit_name_freq: {
            icao_unit_name: {
              icao_facility_id: {
                data: { icao_facility_name: "MIAMI" },
              },
              icao_facility_function: "center",
            },
            freq: { data: { vhf: { val: 125.075, unit: "MHz" } } },
          },
        }),
      ),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "frequency",
      title: "Last voice assignment",
      summary: "Assigned 125.075 MHz — Miami Center",
      uplinkMessageId: 3,
    });
  });

  it("extracts altitude and direct-to clearances", () => {
    const result = deriveCpdlcInsights([
      message(
        "climb",
        1_700_000_010,
        uplink(4, "uM20Altitude", {
          alt: { data: { flight_level: 230 } },
        }),
      ),
      message(
        "direct",
        1_700_000_020,
        uplink(5, "uM74Position", {
          pos: { data: { fix: "FALTI" } },
        }),
      ),
    ]);

    expect(result.map((item) => item.summary)).toEqual([
      "Proceed direct FALTI",
      "Climb and maintain FL230",
    ]);
  });

  it("matches a WILCO response and calculates its delay", () => {
    const result = deriveCpdlcInsights([
      message(
        "clearance",
        1_700_000_000,
        uplink(16, "uM23Altitude", {
          alt: { data: { flight_level: 240 } },
        }),
      ),
      message("reply", 1_700_000_008, downlink(16, "dM0NULL")),
    ]);

    expect(result[0]).toMatchObject({
      response: "WILCO",
      responseDelaySeconds: 8,
      responseUid: "reply",
    });
  });

  it("does not match an old response after the safe correlation window", () => {
    const result = deriveCpdlcInsights([
      message(
        "clearance",
        1_700_000_000,
        uplink(16, "uM23Altitude", {
          alt: { data: { flight_level: 240 } },
        }),
      ),
      message("reply", 1_700_000_301, downlink(16, "dM0NULL")),
    ]);

    expect(result[0].response).toBeUndefined();
  });

  it("keeps only the newest insight of each kind", () => {
    const result = deriveCpdlcInsights([
      message(
        "old",
        1_700_000_000,
        uplink(1, "uM20Altitude", {
          alt: { data: { flight_level: 230 } },
        }),
      ),
      message(
        "new",
        1_700_000_100,
        uplink(2, "uM23Altitude", {
          alt: { data: { flight_level: 190 } },
        }),
      ),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("Descend and maintain FL190");
  });

  it("accepts libacars JSON embedded in decoder text", () => {
    const decoded = uplink(2, "uM74Position", {
      pos: { data: { fix: "LENDS" } },
    });
    const result = deriveCpdlcInsights([
      message("json", 1_700_000_000, `decoder output\n${JSON.stringify(decoded)}\n`),
    ]);

    expect(result[0].summary).toBe("Proceed direct LENDS");
  });

  it("ignores failed CRC and unsupported messages", () => {
    const badCrc = uplink(1, "uM20Altitude", {
      alt: { data: { flight_level: 230 } },
    });
    badCrc.crc_ok = false;

    expect(
      deriveCpdlcInsights([
        message("bad", 1_700_000_000, badCrc),
        message("unsupported", 1_700_000_001, uplink(2, "uM169FreeText", {})),
      ]),
    ).toEqual([]);
  });
});
