import { Lab } from '../src/components/lab';
import { liveAvailable, studySummaries } from '../src/lib/lab-server';
export const dynamic = 'force-dynamic';
export default function Page() { return <Lab liveAvailable={liveAvailable()} studies={studySummaries} />; }
