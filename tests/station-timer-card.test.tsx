import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StationTimerCard from "../app/components/StationTimerCard";
import { LINE_META, STATION_BY_ID } from "../app/metro-data";

afterEach(() => {
  cleanup();
});

describe("StationTimerCard", () => {
  it("shows both directions and keeps station actions explicit", async () => {
    const onOpen = vi.fn();
    const onFavorite = vi.fn();
    const user = userEvent.setup();
    const station = STATION_BY_ID.lisova;

    render(
      <StationTimerCard
        station={station}
        now={new Date("2026-07-24T08:00:00+03:00")}
        favorite={false}
        onOpen={onOpen}
        onFavorite={onFavorite}
      />,
    );

    expect(screen.getByText(LINE_META.red.terminus[0])).toBeTruthy();
    expect(screen.getAllByText(LINE_META.red.terminus[1])).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Відкрити станцію Лісова" }));
    await user.click(screen.getByRole("button", { name: "Додати Лісова в обране" }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onFavorite).toHaveBeenCalledOnce();
  });
});
