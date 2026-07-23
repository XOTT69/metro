import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StationSelect from "../app/components/StationSelect";
import StationSheet from "../app/components/StationSheet";
import TimerDirections from "../app/components/TimerDirections";
import TrackedStation from "../app/components/TrackedStation";
import { STATION_BY_ID } from "../app/metro-data";

const NOW = new Date("2026-07-23T08:15:30+03:00");
const STATION = STATION_BY_ID["maidan-nezalezhnosti"];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("StationSelect", () => {
  it("renders every station and reports a selection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StationSelect
        label="Звідки"
        value="akademmistechko"
        onChange={onChange}
      />,
    );

    const select = screen.getByLabelText("Звідки");
    expect(select.querySelectorAll("option")).toHaveLength(53);
    await user.selectOptions(select, "maidan-nezalezhnosti");
    expect(onChange).toHaveBeenCalledWith("maidan-nezalezhnosti");
  });
});

describe("station timers", () => {
  it("renders predictions for both directions", () => {
    const { container } = render(
      <TimerDirections station={STATION} now={NOW} />,
    );

    expect(container.querySelectorAll(".direction-timer")).toHaveLength(2);
    expect(screen.getByText("Героїв Дніпра")).toBeTruthy();
    expect(screen.getByText("Теремки")).toBeTruthy();
  });

  it("allows changing the tracked station", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TrackedStation
        station={STATION}
        now={NOW}
        onOpen={vi.fn()}
        onChange={onChange}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Відстежувати іншу"),
      "khreshchatyk",
    );
    expect(onChange).toHaveBeenCalledWith("khreshchatyk");
  });
});

describe("StationSheet", () => {
  it("focuses the close button, traps focus and closes on Escape", async () => {
    const returnButton = document.createElement("button");
    returnButton.textContent = "Повернути фокус";
    document.body.appendChild(returnButton);
    returnButton.focus();

    const onClose = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <StationSheet
        station={STATION}
        favorite={false}
        tracked={false}
        now={NOW}
        onFavorite={vi.fn()}
        onTrack={vi.fn()}
        onUseFrom={vi.fn()}
        onUseTo={vi.fn()}
        onClose={onClose}
      />,
    );

    const closeButton = screen.getByRole("button", {
      name: "Закрити інформацію про станцію",
    });
    const useToButton = screen.getByRole("button", { name: "Сюди" });

    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(useToButton);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();

    unmount();
    expect(document.activeElement).toBe(returnButton);
  });
});
