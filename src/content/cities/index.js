const metaModules = import.meta.glob("./*/meta.json", { eager: true });
const noteModules = import.meta.glob("./*/note.*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

export const cityOrder = [
  "daming-palace",
  "bell-tower",
  "yongning-gate",
  "huanqiu-tiantan",
  "mingde-gate",
];

export const cityContent = cityOrder.reduce((accumulator, slug) => {
  const meta = metaModules[`./${slug}/meta.json`];
  const noteZh = noteModules[`./${slug}/note.zh.md`];
  const noteEn = noteModules[`./${slug}/note.en.md`];

  accumulator[slug] = {
    ...meta,
    slug,
    notes: {
      zh: parseMarkdown(noteZh),
      en: parseMarkdown(noteEn),
    },
  };

  return accumulator;
}, {});

function parseMarkdown(markdown = "") {
  const lines = markdown.trim().split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length) {
      blocks.push({ type: "list", items: [...list] });
      list = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: trimmed.slice(3) });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}
