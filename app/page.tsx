import { Lab, type Studies } from '../src/components/lab';
import studies from '../src/data/generated/home.json';
export const dynamic = 'force-dynamic';
export default function Page() { return <Lab liveAvailable={!!process.env.TYPESAFE_API_KEY?.trim()} studies={studies as Studies} />; }
