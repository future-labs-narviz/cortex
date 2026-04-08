export interface Command {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private recentIds: string[] = [];

  register(cmd: Command): void {
    this.commands.set(cmd.id, cmd);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getRecent(): Command[] {
    return this.recentIds
      .map((id) => this.commands.get(id))
      .filter((cmd): cmd is Command => cmd !== undefined);
  }

  search(query: string): Command[] {
    if (!query.trim()) {
      // Show recently used first, then everything else
      const recent = this.getRecent();
      const recentSet = new Set(this.recentIds);
      const rest = this.getAll().filter((cmd) => !recentSet.has(cmd.id));
      return [...recent, ...rest];
    }

    const lowerQuery = query.toLowerCase();
    const results: { cmd: Command; score: number }[] = [];

    for (const cmd of this.commands.values()) {
      const lowerLabel = cmd.label.toLowerCase();
      const lowerCategory = cmd.category.toLowerCase();

      // Fuzzy match against label
      let queryIdx = 0;
      let score = 0;
      let lastMatchIdx = -2;

      for (
        let i = 0;
        i < lowerLabel.length && queryIdx < lowerQuery.length;
        i++
      ) {
        if (lowerLabel[i] === lowerQuery[queryIdx]) {
          if (i === lastMatchIdx + 1) score += 10;
          if (i === 0 || /[\s\-_/.]/.test(cmd.label[i - 1])) score += 8;
          if (cmd.label[i] === query[queryIdx]) score += 2;
          score += 1;
          lastMatchIdx = i;
          queryIdx++;
        }
      }

      const matched = queryIdx === lowerQuery.length;
      if (!matched) {
        // Also check category
        if (lowerCategory.includes(lowerQuery)) {
          results.push({ cmd, score: 1 });
        }
        continue;
      }

      score -= cmd.label.length * 0.5;
      results.push({ cmd, score });
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.cmd);
  }

  execute(id: string): void {
    const cmd = this.commands.get(id);
    if (!cmd) return;

    // Track recent usage
    this.recentIds = [id, ...this.recentIds.filter((rid) => rid !== id)].slice(
      0,
      10,
    );

    cmd.action();
  }
}

export const commandRegistry = new CommandRegistry();
