export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const base = specifier.split("/").pop() ?? "";
    if (!base.includes(".")) return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
