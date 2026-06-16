import fs from 'node:fs';
import path from 'node:path';
import { DOC_ARTICLES, DOC_CATEGORIES, type DocArticleMeta } from './registry';

const DOCS_DIR = path.join(process.cwd(), 'content/docs');

export function listDocArticles(): DocArticleMeta[] {
  return DOC_ARTICLES;
}

export function listDocCategories() {
  return DOC_CATEGORIES.map((category) => ({
    ...category,
    count:
      category.id === 'all'
        ? DOC_ARTICLES.length
        : DOC_ARTICLES.filter((doc) => doc.category === category.id).length,
  }));
}

export function getDocArticle(slug: string) {
  const meta = DOC_ARTICLES.find((doc) => doc.slug === slug);
  if (!meta) return null;

  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  return { ...meta, content };
}

export function searchDocArticles(query: string, category = 'all') {
  const q = query.trim().toLowerCase();
  return DOC_ARTICLES.filter((doc) => {
    const matchesCategory = category === 'all' || doc.category === category;
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.description.toLowerCase().includes(q) ||
      doc.slug.toLowerCase().includes(q)
    );
  });
}
