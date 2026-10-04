// Copyright (C) 2022-2026 Frederick Clausen II
// This file is part of acarshub <https://github.com/sdr-enthusiasts/docker-acarshub>.

import type { AcarsMsg } from "@acarshub/types";
import { deriveCpdlcInsights } from "../../utils/cpdlcInsights";

interface AircraftCpdlcInsightsProps {
  messages: AcarsMsg[];
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function AircraftCpdlcInsights({ messages }: AircraftCpdlcInsightsProps) {
  const insights = deriveCpdlcInsights(messages);
  if (insights.length === 0) return null;

  return (
    <section className="aircraft-cpdlc-insights" aria-labelledby="cpdlc-insights-title">
      <h3 id="cpdlc-insights-title" className="aircraft-cpdlc-insights__heading">
        CPDLC insights
      </h3>
      <div className="aircraft-cpdlc-insights__list">
        {insights.map((insight) => (
          <details
            className="aircraft-cpdlc-insights__item"
            key={`${insight.kind}-${insight.sourceUid}`}
          >
            <summary className="aircraft-cpdlc-insights__summary">
              <span>
                <span className="aircraft-cpdlc-insights__title">{insight.title}</span>
                <span className="aircraft-cpdlc-insights__text">{insight.summary}</span>
              </span>
              <span
                className={`aircraft-cpdlc-insights__response${insight.response ? " aircraft-cpdlc-insights__response--matched" : ""}`}
              >
                {insight.response
                  ? `${insight.response} · ${insight.responseDelaySeconds}s`
                  : "No matching reply received here"}
              </span>
            </summary>
            <div className="aircraft-cpdlc-insights__evidence">
              <span>Received {formatTime(insight.issuedAt)}</span>
              {insight.uplinkMessageId !== undefined && (
                <span>CPDLC message ID {insight.uplinkMessageId}</span>
              )}
              <span>Source message {insight.sourceUid}</span>
              {insight.responseUid && <span>Reply message {insight.responseUid}</span>}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
