// Lines from a selected slot to the slots of its product's top-3 affinity partners (Section 6.3)
import { Line } from '@react-three/drei';
import { RACK_HEIGHT, rackCenter } from './coords';

export function AffinityLines({ from, toSlots }: { from: number; toSlots: number[] }) {
  const top = (s: number): [number, number, number] => { const [x, , z] = rackCenter(s); return [x, RACK_HEIGHT + 0.25, z]; };
  return (
    <group>
      {toSlots.map(s => (
        <Line key={s} points={[top(from), top(s)]} color="#9b5de5" lineWidth={3} dashed dashSize={0.4} gapSize={0.2} />
      ))}
    </group>
  );
}
