import { NextRequest, NextResponse } from 'next/server';
import { filterTutorials, listTutorials } from '@/lib/content/tutorials';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') ?? 'all';
  const difficulty = request.nextUrl.searchParams.get('difficulty') ?? 'all';

  const tutorials = filterTutorials(category, difficulty);
  return NextResponse.json({ tutorials, total: listTutorials().length });
}
