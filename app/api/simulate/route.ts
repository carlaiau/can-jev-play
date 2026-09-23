import { simulate } from '../../../src/lib/dice.ts';
import type { SimulationConfig } from '../../../src/lib/dice.ts';

export async function POST(request: Request) {
  try {
    const config = await request.json() as SimulationConfig;
    return Response.json(simulate(config));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
}
