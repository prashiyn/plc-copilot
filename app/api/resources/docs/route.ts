import { NextRequest, NextResponse } from 'next/server';
import { listDocArticles, listDocCategories, searchDocArticles } from '@/lib/content/docs';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const category = request.nextUrl.searchParams.get('category') ?? 'all';

  const docs = searchDocArticles(q, category);
  const categories = listDocCategories();

  return NextResponse.json({
    docs,
    categories,
    total: listDocArticles().length,
  });
}
