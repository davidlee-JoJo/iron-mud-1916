// 將 Rapier collider 對應回遊戲實體，射線命中後才能結算傷害。
export class Registry {
  constructor() {
    this.entries = new Map();
  }

  add(collider, entity, part = 'body') {
    if (!collider) return;
    this.entries.set(collider.handle, { entity, part });
  }

  remove(collider) {
    if (collider) this.entries.delete(collider.handle);
  }

  get(handle) {
    return this.entries.get(handle) || null;
  }

  clear() {
    this.entries.clear();
  }
}
