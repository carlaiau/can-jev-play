import { Lab } from '../src/components/lab';
export const dynamic = 'force-dynamic';
export default function Page() { return <Lab liveAvailable={!!process.env.TYPESAFE_API_KEY?.trim()} />; }
