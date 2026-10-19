import { expect, test } from "bun:test"
import type { SessionMessageAssistant, SessionMessageInfo } from "@opencode/client"
import { findStickyPromptMessage, STICKY_PROMPT_HEIGHT } from "../../../src/routes/session/sticky-prompt"
import type { TimelineAnchor } from "../../../src/routes/session/anchors"

const messages: SessionMessageInfo[] = [
  { type: "user", id: "user-1", text: "First request", time: { created: 0 } },
  assistant("assistant-1", "First response"),
  { type: "user", id: "user-2", text: "Second request", time: { created: 2 } },
  assistant("assistant-2", "Second response"),
]

test("hides the sticky prompt while the original prompt is not fully covered", () => {
  expect(
    findStickyPromptMessage(
      [messageAnchor("user-1", 2, 4), messageAnchor("assistant-1", 5)],
      messages,
      2,
    ),
  ).toBeUndefined()
})

test("shows the preceding user prompt once the sticky bar covers it", () => {
  expect(
    findStickyPromptMessage(
      [messageAnchor("user-1", 2, 4), messageAnchor("assistant-1", 5)],
      messages,
      3,
    ),
  ).toEqual({ id: "user-1", text: "First request" })
})

test("uses the three-row V1 sticky prompt height", () => {
  expect(STICKY_PROMPT_HEIGHT).toBe(3)
})

test("switches to the prompt for the current response", () => {
  expect(
    findStickyPromptMessage(
      [
        messageAnchor("user-1", -20, 2),
        messageAnchor("assistant-1", -10),
        messageAnchor("user-2", -5, 2),
        messageAnchor("assistant-2", -1),
      ],
      messages,
      0,
    ),
  ).toEqual({ id: "user-2", text: "Second request" })
})

test("hides the old sticky prompt while the next user message crosses its cover area", () => {
  expect(
    findStickyPromptMessage(
      [messageAnchor("user-1", -20, 2), messageAnchor("assistant-1", -5), messageAnchor("user-2", 2, 4)],
      messages,
      0,
    ),
  ).toBeUndefined()
})

test("resolves a collapsed group anchor to its first message", () => {
  expect(
    findStickyPromptMessage(
      [messageAnchor("user-1", -10), groupAnchor("assistant-1", -5)],
      messages,
      0,
    ),
  ).toEqual({ id: "user-1", text: "First request" })
})

test("shows prompts whose rows are virtualized out of the mounted transcript", () => {
  expect(findStickyPromptMessage([messageAnchor("assistant-1", 5)], messages, 0)).toEqual({
    id: "user-1",
    text: "First request",
  })
})

test("ignores user messages without visible text", () => {
  expect(
    findStickyPromptMessage(
      [messageAnchor("empty-user", -5), messageAnchor("assistant-1", 5)],
      [
        { type: "user", id: "empty-user", text: "  " },
        assistant("assistant-1", "Response"),
      ],
      0,
    ),
  ).toBeUndefined()
})

function messageAnchor(messageID: string, y: number, height = 1): TimelineAnchor {
  return {
    target: { type: "part", ref: { messageID, partID: "message" } },
    node: { y, height, isDestroyed: false },
  }
}

function groupAnchor(messageID: string, y: number): TimelineAnchor {
  return {
    target: { type: "group", groupID: JSON.stringify([messageID, "text:0", "reasoning", 0]) },
    node: { y, height: 1, isDestroyed: false },
  }
}

function assistant(id: string, text: string): SessionMessageAssistant {
  return {
    type: "assistant",
    id,
    agent: "build",
    model: { providerID: "test", id: "test" },
    content: [{ type: "text", text }],
    time: { created: 0, completed: 1 },
  }
}
