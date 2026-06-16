import fs from 'node:fs';
import path from 'node:path';
import { TUTORIAL_ARTICLES, type TutorialMeta } from './registry';

const TUTORIALS_DIR = path.join(process.cwd(), 'content/tutorials');

export function listTutorials(): TutorialMeta[] {
  return TUTORIAL_ARTICLES;
}

export function getTutorial(slug: string) {
  const meta = TUTORIAL_ARTICLES.find((item) => item.slug === slug);
  if (!meta) return null;

  const filePath = path.join(TUTORIALS_DIR, `${slug}.md`);
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : meta.description;
  return { ...meta, content };
}

export function filterTutorials(category: string, difficulty: string) {
  return TUTORIAL_ARTICLES.filter((item) => {
    const categoryOk = category === 'all' || item.category === category;
    const difficultyOk = difficulty === 'all' || item.difficulty === difficulty;
    return categoryOk && difficultyOk;
  });
}
