import type { MayorMessage } from "../data/schemas.js";
import { linkify } from "./linkify.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMessage(msg: MayorMessage): string {
  const chatClass =
    msg.sender === "human" ? "chat-end" : "chat-start";
  const bubbleClass =
    msg.sender === "human"
      ? "chat-bubble-primary"
      : msg.sender === "system"
        ? "chat-bubble-warning"
        : "chat-bubble";

  if (msg.isAction) {
    return `<div class="alert alert-info my-2 text-sm">
      <span>⚡</span>
      <div>
        <div class="text-xs opacity-60">${escapeHtml(msg.timestamp)}</div>
        <pre class="whitespace-pre-wrap text-sm">${linkify(escapeHtml(msg.text))}</pre>
      </div>
    </div>`;
  }

  return `<div class="chat ${chatClass}">
    <div class="chat-header">
      ${escapeHtml(msg.sender)}
      <time class="text-xs opacity-50 ml-1">${escapeHtml(msg.timestamp)}</time>
    </div>
    <div class="chat-bubble ${bubbleClass}">
      <pre class="whitespace-pre-wrap text-sm font-sans">${linkify(escapeHtml(msg.text))}</pre>
    </div>
  </div>`;
}

export function renderMessages(messages: MayorMessage[]): string {
  if (messages.length === 0) {
    return `<div class="text-center text-base-content/50 py-8">No messages yet. Send a nudge to start a conversation.</div>`;
  }
  return messages.map(renderMessage).join("\n");
}

export function renderMayorPage(messages: MayorMessage[]): string {
  return `<div class="flex flex-col h-[calc(100vh-4rem)]">
    <div class="flex items-center gap-2 mb-4">
      <h1 class="text-2xl font-bold">🎩 Mayor Conversation</h1>
      <span class="badge badge-sm badge-ghost">htmx polling</span>
    </div>

    <div id="mayor-messages"
         class="flex-1 overflow-y-auto space-y-1 p-4 bg-base-200 rounded-box"
         hx-get="/api/mayor/messages"
         hx-trigger="every 5s, refresh-messages from:body"
         hx-swap="innerHTML scroll:bottom"
         hx-on::after-settle="this.scrollTop = this.scrollHeight">
      ${renderMessages(messages)}
    </div>

    <div id="sent-toast" class="hidden toast toast-end toast-bottom z-50">
      <div class="alert alert-success py-2 px-4">
        <span>✓ Sent</span>
      </div>
    </div>

    <form class="mt-4 flex gap-2"
          hx-post="/api/mayor/nudge"
          hx-swap="none"
          hx-on::after-request="if(event.detail.successful){this.reset();htmx.trigger(document.body,'refresh-messages')}"
          hx-indicator="#send-btn">
      <input type="text" name="message"
             placeholder="Send a message to the Mayor..."
             class="input input-bordered flex-1"
             required
             autocomplete="off" />
      <button id="send-btn" type="submit" class="btn btn-primary">
        <span class="htmx-indicator loading loading-spinner loading-xs"></span>
        Send
      </button>
    </form>

    <script>
      document.body.addEventListener("mayor-sent", function() {
        var t = document.getElementById("sent-toast");
        if (t) {
          t.classList.remove("hidden");
          setTimeout(function() { t.classList.add("hidden"); }, 2000);
        }
      });
      // Auto-scroll on htmx content swap
      document.body.addEventListener("htmx:afterSettle", function(e) {
        var el = document.getElementById("mayor-messages");
        if (el && el.contains(e.detail.elt)) {
          el.scrollTop = el.scrollHeight;
        }
      });
    </script>
  </div>`;
}
