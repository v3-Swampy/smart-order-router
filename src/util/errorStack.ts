// 在 await 调用点捕获“现场栈”，用于补全异步边界丢失的调用位置信息
export function withSite(p: Promise<any>, label: string): Promise<any> {
  const site = new Error(label);
  return p.catch((e: Error) => {
    const siteStack = site.stack?.split("\n").slice(1).join("\n");
    if (e && e.stack && siteStack) {
      e.stack = `${e.stack}\n产生于此 await 位置:\n${siteStack}`;
    }
    throw e;
  });
}
