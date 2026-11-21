import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_HISTORY_MESSAGES,
  getMaxHistoryMessages,
  trimHistory,
} from "./historyLimit";

describe("getMaxHistoryMessages", () => {
  it("defaults when the env var is unset or blank", () => {
    expect(getMaxHistoryMessages({})).toBe(DEFAULT_MAX_HISTORY_MESSAGES);
    expect(getMaxHistoryMessages({ CHAT_MAX_HISTORY_MESSAGES: " " })).toBe(
      DEFAULT_MAX_HISTORY_MESSAGES,
    );
  });

  it("uses a positive integer override", () => {
    expect(getMaxHistoryMessages({ CHAT_MAX_HISTORY_MESSAGES: "24" })).toBe(24);
  });

  it("treats 0 as uncapped", () => {
    expect(getMaxHistoryMessages({ CHAT_MAX_HISTORY_MESSAGES: "0" })).toBe(
      Infinity,
    );
  });

  it("falls back to the default for invalid values", () => {
    for (const raw of ["-5", "abc", "1.5"]) {
      expect(getMaxHistoryMessages({ CHAT_MAX_HISTORY_MESSAGES: raw })).toBe(
        DEFAULT_MAX_HISTORY_MESSAGES,
      );
    }
  });
});

describe("trimHistory", () => {
  it("keeps only the most recent messages", () => {
    expect(trimHistory([1, 2, 3, 4, 5], 2)).toEqual([4, 5]);
  });

  it("returns everything when under the cap or uncapped", () => {
    expect(trimHistory([1, 2], 10)).toEqual([1, 2]);
    expect(trimHistory([1, 2, 3], Infinity)).toEqual([1, 2, 3]);
  });
});
