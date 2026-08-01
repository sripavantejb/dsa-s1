import { NextResponse } from 'next/server';
import { withAuth, readJson, ok } from '@/features/leetcode-automation/lib/http';
import {
  createSolution,
  deleteSolution,
  listSolutions,
  updateSolution,
} from '@/features/leetcode-automation/services/solutionService';

/** GET /api/solutions?search=&language=&difficulty=&favorite=&page=&pageSize= */
export const GET = withAuth(
  async ({ req, user }) => {
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    return ok(await listSolutions(user.username, query));
  },
  { route: 'solutions:get', limit: 120 }
);

/** POST /api/solutions → create a stored solution. */
export const POST = withAuth(
  async ({ req, user }) => {
    const body = await readJson(req);
    const solution = await createSolution(user.username, body);
    return NextResponse.json({ solution }, { status: 201 });
  },
  { route: 'solutions:post', limit: 60 }
);

/** PATCH /api/solutions → update by { id, ...fields }. */
export const PATCH = withAuth(
  async ({ req, user }) => {
    const body = await readJson(req);
    if (!body.id) return NextResponse.json({ message: 'id is required' }, { status: 400 });
    const solution = await updateSolution(user.username, body.id, body);
    if (!solution) return NextResponse.json({ message: 'Solution not found' }, { status: 404 });
    return ok({ solution });
  },
  { route: 'solutions:patch', limit: 60 }
);

/** DELETE /api/solutions?id= */
export const DELETE = withAuth(
  async ({ req, user }) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'id is required' }, { status: 400 });
    const removed = await deleteSolution(user.username, id);
    if (!removed) return NextResponse.json({ message: 'Solution not found' }, { status: 404 });
    return ok({ ok: true });
  },
  { route: 'solutions:delete', limit: 60 }
);
