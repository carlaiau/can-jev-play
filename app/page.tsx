import { Lab } from '../src/components/lab';
import { liveAvailable, studySummaries, historyFindings } from '../src/lib/lab-server';
export const dynamic = 'force-dynamic';
export default async function Page() { return <Lab liveAvailable={liveAvailable()} studies={{...studySummaries,findings:await historyFindings()}} />; }
