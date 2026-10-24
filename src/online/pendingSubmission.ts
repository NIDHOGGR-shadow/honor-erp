// Holds an unsent action in memory only. Never serialise authentication drafts.
export class PendingSubmission {
  private action: (() => Promise<void>) | null = null;
  private expiresAt = 0;
  private generation = 0;

  hold(action: () => Promise<void>, now = Date.now()) {
    this.action = action;
    this.expiresAt = now + 5 * 60_000;
    ++this.generation;
  }
  cancel() {
    this.action = null;
    this.expiresAt = 0;
    ++this.generation;
  }
  get waiting() { return this.action !== null; }
  async reconnect(probe: () => Promise<boolean>, now = Date.now()): Promise<"waiting" | "sent" | "expired" | "cancelled"> {
    if (!this.action) return "cancelled";
    if (now >= this.expiresAt) { this.cancel(); return "expired"; }
    const generation = this.generation;
    if (!await probe()) return this.action ? "waiting" : "cancelled";
    if (generation !== this.generation || !this.action) return "cancelled";
    const action = this.action;
    // Clear before dispatch: a failed or ambiguous POST is never replayed.
    this.cancel();
    await action();
    return "sent";
  }
}
