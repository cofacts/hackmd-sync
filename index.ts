import { Window } from 'happy-dom';

async function fetchMarkdown(url: string) {
  const window = new Window({url});
  const html = await fetch(url).then(res => res.text());
  window.document.body.innerHTML = html;

  return window.document.querySelector('#doc')?.innerHTML ?? '';
}

const HOSTNAME = 'https://g0v.hackmd.io';

/**
 * Gets the absolute URLs to markdown content
 * @param markdown
 * @returns list of link text, title and URL
 */
async function getMenuLinks(markdown: string) {
  const links = markdown.match(/- \[.*?\]\(.*?\)/g);
  return links?.map(link => {
    const [text, title, url] = link.match(/\[(.*?)\]\((.*?)\)/) || [];
    return { text, title, url: url.startsWith('/') ? `${HOSTNAME}${url}` : url };
  }) ?? [];
}

/**
 * Execute async functions in batches
 */
function batchExecPromises(asyncFns: (() => Promise<unknown>)[], batchSize: number = 5) {
  let fnIdx = 0;
  const firstBatch = asyncFns.slice(0, Math.min(asyncFns.length, batchSize));

  function chain(): Promise<unknown> | undefined {
    const nextAsyncFn = asyncFns[fnIdx++];
    return nextAsyncFn === undefined ? undefined : nextAsyncFn().then(chain);
  };

  return Promise.all(firstBatch.map(chain));
}


/**
 * Grab all markdowns listed in a HackMD book mode
 *
 * @param menuUrl
 * @returns
 */
async function saveAllMarkdowns(menuUrl = 'https://g0v.hackmd.io/@cofacts/meetings/', to='./data') {
  const menuMd = await fetchMarkdown(menuUrl);
  const links = await getMenuLinks(menuMd);

  console.info(`[saveAllMarkdowns] Found ${links.length} links.`);

  // Map each link to a async fn that fetches the markdown and saves it
  //
  const asyncFns = links.map(({ title, url }) => async () => {
    console.info(`[saveAllMarkdowns] Processing ${url}...`);
    const markdown = await fetchMarkdown(url);

    // Remove html tags from title, and replace all other `/` with `-`
    const sanitizedTitle = title.replace(/<.*?>/g, '').replace(/\//g, '-');

    const fileName = `${to}/${sanitizedTitle}.md`;

    console.info(`[saveAllMarkdowns] Saving ${fileName}...`);
    await Bun.write(fileName, markdown);
  });

  batchExecPromises(asyncFns);
}

async function main() {
  await saveAllMarkdowns();
}

main();
