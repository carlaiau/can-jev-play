import { Findings } from '../../src/components/findings';
import studies from '../../src/data/generated/home.json';
import type { Studies } from '../../src/components/lab';
export const metadata={title:'Findings · Can Jev Play'};
export default function Page(){return <Findings findings={(studies as Studies).findings}/>;}
