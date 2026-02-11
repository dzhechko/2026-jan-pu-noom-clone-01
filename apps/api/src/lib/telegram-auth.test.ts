import { describe, it, expect } from "vitest";
import { sign } from "@tma.js/init-data-node";
import { validateTelegramInitData } from "./telegram-auth";

const BOT_TOKEN = "7890123456:AAFakeTokenForTestingPurposesOnly1234";

function createValidInitData(
  user: { id: number; first_name: string; last_name?: string; username?: string },
): string {
  return sign(
    { user },
    BOT_TOKEN,
    new Date(),
  );
}

describe("validateTelegramInitData", () => {
  it("validates and parses correct initData", () => {
    const initData = createValidInitData({
      id: 123456789,
      first_name: "Иван",
      last_name: "Петров",
      username: "ivan_p",
    });

    const result = validateTelegramInitData(initData, BOT_TOKEN);

    expect(result.id).toBe(123456789);
    expect(result.firstName).toBe("Иван");
    expect(result.lastName).toBe("Петров");
    expect(result.username).toBe("ivan_p");
  });

  it("works without optional fields", () => {
    const initData = createValidInitData({
      id: 999,
      first_name: "Test",
    });

    const result = validateTelegramInitData(initData, BOT_TOKEN);

    expect(result.id).toBe(999);
    expect(result.firstName).toBe("Test");
    expect(result.lastName).toBeUndefined();
    expect(result.username).toBeUndefined();
  });

  it("throws on invalid signature", () => {
    const initData = createValidInitData({
      id: 123,
      first_name: "Hacker",
    });

    expect(() =>
      validateTelegramInitData(initData, "0000000000:AAWRONGTOKEN0000000000000000000000"),
    ).toThrow();
  });

  it("throws on tampered data", () => {
    const initData = createValidInitData({
      id: 123,
      first_name: "Original",
    });

    // Tamper with the data
    const tampered = initData.replace("Original", "Tampered");

    expect(() =>
      validateTelegramInitData(tampered, BOT_TOKEN),
    ).toThrow();
  });

  it("throws on empty string", () => {
    expect(() =>
      validateTelegramInitData("", BOT_TOKEN),
    ).toThrow();
  });
});
