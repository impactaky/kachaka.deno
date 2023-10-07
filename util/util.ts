export async function fetchText(url: URL) {
  return (await fetch(url)).text();
}
