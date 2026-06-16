import { NextResponse } from 'next/server';
import { getDocArticle } from '@/lib/content/docs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  return NextResponse.json({ article });
}
