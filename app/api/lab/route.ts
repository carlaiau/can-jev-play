import { createSession, readSession, actOnSession, sessionCost } from '../../../src/lib/lab-server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host')) return Response.json({ error: 'Use the app on the same origin.' }, { status: 403 });
    const text = await request.text();
    if (text.length > 4096) throw new Error('Request is too large.');
    const body = JSON.parse(text);
    const session = body.action === 'create' ? await createSession(body.config) : body.action === 'load' ? await readSession(body.id) : await actOnSession(body.id, body.action, body.round);
    return Response.json({ session, estimatedCost: sessionCost(session) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The experiment could not finish this step.';
    const safe = /ENOENT/.test(message) ? 'Session not found. Start a new experiment.' : /timeout|aborted|fetch failed/i.test(message) ? 'JEV did not respond in time. Retry; completed judgments are preserved.' : message;
    return Response.json({ error: safe }, { status: 400 });
  }
}
