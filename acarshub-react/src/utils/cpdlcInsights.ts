// Copyright (C) 2022-2026 Frederick Clausen II
// This file is part of acarshub <https://github.com/sdr-enthusiasts/docker-acarshub>.

import type { AcarsMsg } from "@acarshub/types";

export type CpdlcInsightKind = "frequency" | "altitude" | "route";

export interface CpdlcInsight {
  kind: CpdlcInsightKind;
  title: string;
  summary: string;
  issuedAt: number;
  sourceUid: string;
  uplinkMessageId?: number;
  response?: string;
  responseDelaySeconds?: number;
  responseUid?: string;
}

interface CpdlcElement {
  choice?: string;
  choice_label?: string;
  data?: Record<string, unknown>;
}

interface DownlinkResponse {
  messageRef: number;
  response: string;
  timestamp: number;
  uid: string;
}

const RESPONSE_WINDOW_SECONDS = 300;
const RESPONSE_CHOICES = new Map([
  ["dM0NULL", "WILCO"],
  ["dM1NULL", "UNABLE"],
  ["dM2NULL", "STANDBY"],
  ["dM3NULL", "ROGER"],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseLibacars(message: AcarsMsg): Record<string, unknown> | undefined {
  if (isRecord(message.libacars)) return message.libacars;
  if (typeof message.libacars !== "string") return undefined;

  const start = message.libacars.indexOf("{");
  const end = message.libacars.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;

  try {
    const parsed: unknown = JSON.parse(message.libacars.slice(start, end + 1));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readElement(value: unknown): CpdlcElement | undefined {
  if (!isRecord(value)) return undefined;
  return {
    choice: asString(value.choice),
    choice_label: asString(value.choice_label),
    data: isRecord(value.data) ? value.data : undefined,
  };
}

function readNestedRecord(
  value: Record<string, unknown> | undefined,
  ...keys: string[]
): Record<string, unknown> | undefined {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return isRecord(current) ? current : undefined;
}

function titleCaseFacility(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFacility(data: Record<string, unknown>): string | undefined {
  const unit = readNestedRecord(data, "icao_unit_name_freq", "icao_unit_name");
  const facilityId = readNestedRecord(unit, "icao_facility_id", "data");
  const name = facilityId && asString(facilityId.icao_facility_name);
  const facilityFunction = unit && asString(unit.icao_facility_function);
  if (!name) return undefined;

  return [titleCaseFacility(name), facilityFunction && titleCaseFacility(facilityFunction)]
    .filter(Boolean)
    .join(" ");
}

function insightFromElement(
  element: CpdlcElement,
  message: AcarsMsg,
  messageId: number | undefined,
): CpdlcInsight | undefined {
  const data = element.data;
  if (!element.choice || !data) return undefined;

  if (element.choice === "uM117ICAOunitnameFrequency") {
    const vhf = readNestedRecord(data, "icao_unit_name_freq", "freq", "data", "vhf");
    const frequency = vhf && asNumber(vhf.val);
    if (frequency === undefined) return undefined;
    const unit = (vhf && asString(vhf.unit)) ?? "MHz";
    const facility = formatFacility(data);
    return {
      kind: "frequency",
      title: "Last voice assignment",
      summary: `Assigned ${frequency.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} ${unit}${facility ? ` — ${facility}` : ""}`,
      issuedAt: message.timestamp,
      sourceUid: message.uid,
      uplinkMessageId: messageId,
    };
  }

  if (["uM19Altitude", "uM20Altitude", "uM23Altitude"].includes(element.choice)) {
    const altitude = readNestedRecord(data, "alt", "data");
    const flightLevel = altitude && asNumber(altitude.flight_level);
    const feet = altitude && asNumber(altitude.altitude_ft);
    if (flightLevel === undefined && feet === undefined) return undefined;
    const verb =
      element.choice === "uM20Altitude"
        ? "Climb and maintain"
        : element.choice === "uM23Altitude"
          ? "Descend and maintain"
          : "Maintain";
    const target = flightLevel !== undefined ? `FL${flightLevel}` : `${feet?.toLocaleString()} ft`;
    return {
      kind: "altitude",
      title: "Last altitude clearance",
      summary: `${verb} ${target}`,
      issuedAt: message.timestamp,
      sourceUid: message.uid,
      uplinkMessageId: messageId,
    };
  }

  if (element.choice === "uM74Position") {
    const position = readNestedRecord(data, "pos", "data");
    const fix = position && asString(position.fix);
    if (!fix) return undefined;
    return {
      kind: "route",
      title: "Last route clearance",
      summary: `Proceed direct ${fix}`,
      issuedAt: message.timestamp,
      sourceUid: message.uid,
      uplinkMessageId: messageId,
    };
  }

  return undefined;
}

function collectResponses(messages: AcarsMsg[]): DownlinkResponse[] {
  const responses: DownlinkResponse[] = [];
  for (const message of messages) {
    const decoded = parseLibacars(message);
    if (decoded?.crc_ok !== true) continue;
    const downlink = readNestedRecord(decoded, "cpdlc", "atc_downlink_msg");
    const header = readNestedRecord(downlink, "header");
    const element = readElement(downlink?.atc_downlink_msg_element_id);
    const messageRef = header && asNumber(header.msg_ref);
    const response = element?.choice && RESPONSE_CHOICES.get(element.choice);
    if (messageRef === undefined || !response) continue;
    responses.push({ messageRef, response, timestamp: message.timestamp, uid: message.uid });
  }
  return responses;
}

function attachResponse(
  insight: CpdlcInsight,
  responses: DownlinkResponse[],
): CpdlcInsight {
  if (insight.uplinkMessageId === undefined) return insight;
  const match = responses
    .filter(
      (response) =>
        response.messageRef === insight.uplinkMessageId &&
        response.timestamp >= insight.issuedAt &&
        response.timestamp - insight.issuedAt <= RESPONSE_WINDOW_SECONDS,
    )
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  if (!match) return insight;
  return {
    ...insight,
    response: match.response,
    responseDelaySeconds: Math.round(match.timestamp - insight.issuedAt),
    responseUid: match.uid,
  };
}

export function deriveCpdlcInsights(messages: AcarsMsg[]): CpdlcInsight[] {
  const responses = collectResponses(messages);
  const candidates: CpdlcInsight[] = [];

  for (const message of messages) {
    const decoded = parseLibacars(message);
    if (decoded?.crc_ok !== true) continue;
    const cpdlc = readNestedRecord(decoded, "cpdlc");
    if (cpdlc?.err === true) continue;
    const uplink = readNestedRecord(cpdlc, "atc_uplink_msg");
    const header = readNestedRecord(uplink, "header");
    const messageId = header && asNumber(header.msg_id);
    const element = readElement(uplink?.atc_uplink_msg_element_id);
    if (!element) continue;
    const insight = insightFromElement(element, message, messageId);
    if (insight) candidates.push(attachResponse(insight, responses));
  }

  const latestByKind = new Map<CpdlcInsightKind, CpdlcInsight>();
  for (const candidate of candidates.sort((a, b) => b.issuedAt - a.issuedAt)) {
    if (!latestByKind.has(candidate.kind)) latestByKind.set(candidate.kind, candidate);
  }
  return [...latestByKind.values()].sort((a, b) => b.issuedAt - a.issuedAt);
}
