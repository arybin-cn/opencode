import { createSignal, onCleanup, Show } from "solid-js"
import { type ScrollBoxRenderable } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import type { SessionMessageInfo } from "@opencode/client"
import { useData } from "../../context/data"
import { useLocal } from "../../context/local"
import { useTheme } from "../../context/theme"
import { SplitBorder } from "../../ui/border"
import { Locale } from "../../util/locale"
import { use } from "./render-context"
import { anchorMessageID, type TimelineAnchor } from "./anchors"

type StickyPromptMessage = { id: string; text: string }
type PromptMessage = { id: string; type: string; text?: string }

const STICKY_PROMPT_PADDING_TOP = 1
const STICKY_PROMPT_PADDING_BOTTOM = 1
export const STICKY_PROMPT_HEIGHT = STICKY_PROMPT_PADDING_TOP + 1 + STICKY_PROMPT_PADDING_BOTTOM

export function findStickyPromptMessage(
  anchors: readonly TimelineAnchor[],
  messages: readonly PromptMessage[],
  viewportTop: number,
) {
  const active = anchors.findLast((anchor) => anchor.node.y <= viewportTop) ?? anchors[0]
  if (!active) return

  const activeIndex = messages.findIndex((message) => message.id === anchorMessageID(active.target))
  if (activeIndex === -1) return

  const prompt = messages
    .slice(0, activeIndex + 1)
    .findLast((message): message is PromptMessage & { type: "user"; text: string } => {
      return message.type === "user" && !!message.text?.trim()
    })
  if (!prompt) return
  const promptIndex = messages.indexOf(prompt)
  const stickyBottom = viewportTop + STICKY_PROMPT_HEIGHT

  const original = anchors.find(
    (anchor) => anchor.target.type === "part" && anchor.target.ref.messageID === prompt.id,
  )
  if (original && original.node.y + original.node.height > stickyBottom) return

  let selected = prompt
  const laterPrompts = messages.slice(promptIndex + 1).filter(
    (message): message is PromptMessage & { type: "user"; text: string } => {
      return message.type === "user" && typeof message.text === "string" && !!message.text.trim()
    },
  )
  for (const message of laterPrompts) {
    const anchor = anchors.find(
      (item) => item.target.type === "part" && item.target.ref.messageID === message.id,
    )
    if (!anchor) continue
    if (anchor.node.y > stickyBottom + 1) break
    if (anchor.node.y + anchor.node.height > stickyBottom) return
    selected = message
  }

  return { id: selected.id, text: selected.text }
}

export function StickyPrompt(props: {
  scroll: () => ScrollBoxRenderable | undefined
  anchors: { list: () => TimelineAnchor[] }
  messages: () => SessionMessageInfo[]
  onSelect: (messageID: string) => void
}) {
  const ctx = use()
  const data = useData()
  const local = useLocal()
  const theme = useTheme()
  const renderer = useRenderer()
  const [prompt, setPrompt] = createSignal<StickyPromptMessage | undefined>(undefined, {
    equals: (previous, next) => previous?.id === next?.id && previous?.text === next?.text,
  })
  const [width, setWidth] = createSignal(0)

  const update = () => {
    const scroll = props.scroll()
    if (!scroll || scroll.isDestroyed) {
      setPrompt(undefined)
      setWidth(0)
      return
    }

    setPrompt(findStickyPromptMessage(props.anchors.list(), props.messages(), scroll.viewport.y))
    setWidth(scroll.viewport.width)
  }

  renderer.on("frame", update)
  update()
  onCleanup(() => renderer.off("frame", update))

  return (
    <Show when={prompt()}>
      {(anchor) => {
        const [hover, setHover] = createSignal(false)
        return (
          <box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            zIndex={1}
            border={["left"]}
            borderColor={local.agent.color(data.session.get(ctx.sessionID)?.agent ?? "build")}
            customBorderChars={SplitBorder.customBorderChars}
          >
            <box
              paddingTop={STICKY_PROMPT_PADDING_TOP}
              paddingBottom={STICKY_PROMPT_PADDING_BOTTOM}
              paddingLeft={2}
              paddingRight={1}
              width="100%"
              flexShrink={0}
              backgroundColor={hover() ? theme.decrease(theme.background.raised.base) : theme.background.raised.base}
              onMouseOver={() => setHover(true)}
              onMouseOut={() => setHover(false)}
              onMouseUp={() => props.onSelect(anchor().id)}
            >
              <text width="100%" overflow="hidden" wrapMode="none" fg={theme.text.base}>
                {Locale.truncateWidth(anchor().text.replace(/\s+/g, " ").trim(), Math.max(1, width() - 4))}
              </text>
            </box>
          </box>
        )
      }}
    </Show>
  )
}
