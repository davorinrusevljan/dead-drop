import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDir = path.join(process.cwd(), 'content/blog');

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  description: string;
  author: string;
  contentHtml: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
  author: string;
}

/**
 * Minimal markdown → HTML converter.
 * Handles headings, paragraphs, lists, code blocks, links,
 * bold, italic, blockquotes, and horizontal rules.
 * No external dependencies needed.
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let inList = false;
  let inOList = false;
  let codeContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        output.push(`<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`);
        codeContent = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      closeList();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1]!.length;
      const text = inlineFormat(headingMatch[2]!);
      output.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      closeList();
      output.push('<hr />');
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeList();
      output.push(`<blockquote><p>${inlineFormat(line.slice(2))}</p></blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        closeList();
        output.push('<ul>');
        inList = true;
      }
      output.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      if (!inOList) {
        closeList();
        output.push('<ol>');
        inOList = true;
      }
      output.push(`<li>${inlineFormat(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    // Regular paragraph
    closeList();
    output.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeList();

  function closeList() {
    if (inList) {
      output.push('</ul>');
      inList = false;
    }
    if (inOList) {
      output.push('</ol>');
      inOList = false;
    }
  }

  return output.join('\n');
}

function inlineFormat(text: string): string {
  // Inline code (must come before other formatting)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getPostSlugs(): string[] {
  const files = fs.readdirSync(contentDir);
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

export function getPostBySlug(slug: string): BlogPost {
  const filePath = path.join(contentDir, `${slug}.md`);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);

  const contentHtml = markdownToHtml(content);

  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? '',
    description: data.description ?? '',
    author: data.author ?? 'ghostgrammer',
    contentHtml,
  };
}

export function getAllPosts(): BlogPostMeta[] {
  const slugs = getPostSlugs();
  const posts = slugs.map((slug) => {
    const filePath = path.join(contentDir, `${slug}.md`);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(fileContents);
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? '',
      description: data.description ?? '',
      author: data.author ?? 'ghostgrammer',
    };
  });

  return posts.sort((a, b) => (a.date > b.date ? -1 : 1));
}
