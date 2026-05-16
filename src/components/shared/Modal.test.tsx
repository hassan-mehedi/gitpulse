import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("closes on Escape while open", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen title="Confirm" onClose={onClose}>
        <p>Body</p>
      </Modal>
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
