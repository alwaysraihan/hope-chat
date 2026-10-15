/**
 * Which conversation is on screen right now. A message that lands in the open
 * chat is read the moment it arrives, so the inbox must not count it as unread
 * (it used to, and the row came back "unread" as soon as the user left).
 */
let openChatId: string | null = null;

export const CHAT_READ_LOCALLY_EVENT = 'hopechat:chat_read_locally';

export function setOpenChatId(id: string | null): void {
  openChatId = id ? String(id) : null;
}

export function getOpenChatId(): string | null {
  return openChatId;
}

export function isChatOpen(id: string | number | null | undefined): boolean {
  return openChatId != null && id != null && String(id) === openChatId;
}
