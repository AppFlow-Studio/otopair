/**
 * #466 (Oyelade, iPhone, Sep 30): Oto answered with a Markdown table and the
 * bubble printed it raw — "| Item | Status |" plus the "|---|---|" delimiter
 * row as text. splitMarkdownTables lets the bubble draw the table instead.
 */
import { describe, expect, it } from "vitest";
import { splitMarkdownTables, splitTableRow } from "../lib/markdownTables";

describe("splitTableRow", () => {
  it("drops the outer pipes and trims cells", () => {
    expect(splitTableRow("| Oil change |  Due soon |")).toEqual(["Oil change", "Due soon"]);
  });

  it("reads rows written without outer pipes", () => {
    expect(splitTableRow("Brakes | OK")).toEqual(["Brakes", "OK"]);
  });

  it("keeps an escaped pipe inside a cell", () => {
    expect(splitTableRow("| A \\| B | C |")).toEqual(["A | B", "C"]);
  });
});

describe("splitMarkdownTables", () => {
  it("returns plain text as a single text block", () => {
    const text = "Your oil change is due in about 500 miles.\n\nWant me to book it?";
    expect(splitMarkdownTables(text)).toEqual([{ type: "text", text }]);
  });

  it("pulls a table out from between text paragraphs", () => {
    const text = [
      "Here's where your Jeep stands:",
      "",
      "| Item | Status |",
      "|------|--------|",
      "| Oil change | Due |",
      "| Brakes | OK |",
      "",
      "Want me to book the oil change?",
    ].join("\n");
    expect(splitMarkdownTables(text)).toEqual([
      { type: "text", text: "Here's where your Jeep stands:" },
      {
        type: "table",
        header: ["Item", "Status"],
        rows: [
          ["Oil change", "Due"],
          ["Brakes", "OK"],
        ],
      },
      { type: "text", text: "Want me to book the oil change?" },
    ]);
  });

  it("accepts alignment colons in the delimiter row", () => {
    const blocks = splitMarkdownTables("| Part | Cost |\n| :--- | ---: |\n| Pads | $120 |");
    expect(blocks).toEqual([
      { type: "table", header: ["Part", "Cost"], rows: [["Pads", "$120"]] },
    ]);
  });

  it("pads short rows and drops extra cells to the header's width", () => {
    const blocks = splitMarkdownTables("| A | B |\n|---|---|\n| 1 |\n| 2 | 3 | 4 |");
    expect(blocks).toEqual([
      { type: "table", header: ["A", "B"], rows: [["1", ""], ["2", "3"]] },
    ]);
  });

  it("leaves a pipe line alone when no delimiter row follows it", () => {
    const text = "Pick one: synthetic | conventional\nEither works for your car.";
    expect(splitMarkdownTables(text)).toEqual([{ type: "text", text }]);
  });

  it("does not read a --- rule under a pipe line as a table", () => {
    const text = "Front | rear brakes\n---\nBoth look fine.";
    expect(splitMarkdownTables(text)).toEqual([{ type: "text", text }]);
  });

  it("skips the empty row a streaming reveal has only just started", () => {
    const partial = "| Item | Status |\n|------|--------|\n|";
    expect(splitMarkdownTables(partial)).toEqual([
      { type: "table", header: ["Item", "Status"], rows: [] },
    ]);
  });
});
