import { useMemo, useRef, type ReactNode } from 'react';
import { Plane, Vector3 } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Furniture } from '@golfworld/shared';
import { useGame } from '../app/store';

function FurnitureModel({ item }: { item: Furniture }): ReactNode {
  const mode = useGame((state) => state.mode);
  const selected = useGame((state) => state.selectedFurniture === item.id);
  const drag = useRef(false);
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const point = useMemo(() => new Vector3(), []);
  const move = (event: ThreeEvent<PointerEvent>): void => {
    if (!drag.current) return; event.stopPropagation();
    if (event.ray.intersectPlane(plane, point)) useGame.getState().moveFurniture(item.id, [point.x, 0, point.z]);
  };
  return <group position={item.pos} rotation={[0, item.rot, 0]} onPointerDown={(event) => {
    if (mode !== 'home') return; event.stopPropagation(); drag.current = true;
    useGame.getState().selectFurniture(item.id); (event.target as HTMLElement | null)?.setPointerCapture(event.pointerId);
  }} onPointerMove={move} onPointerUp={(event) => { event.stopPropagation(); drag.current = false; (event.target as HTMLElement | null)?.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = false; }}>
    {item.sku === 'furn.chair.midcentury' && <>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.9, 0.15, 0.9]} /><meshStandardMaterial color="#e2ac62" /></mesh>
      <mesh position={[0, 0.9, -0.37]}><boxGeometry args={[0.9, 0.8, 0.13]} /><meshStandardMaterial color="#c9894c" /></mesh>
      {[-0.32, 0.32].flatMap((x) => [-0.32, 0.32].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.24, z]}><boxGeometry args={[0.1, 0.5, 0.1]} /><meshStandardMaterial color="#694e36" /></mesh>))}
    </>}
    {item.sku === 'furn.table.round' && <>
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.9, 0.9, 0.14, 20]} /><meshStandardMaterial color="#f1d6a3" /></mesh>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.14, 0.28, 0.85, 12]} /><meshStandardMaterial color="#9c7950" /></mesh>
    </>}
    {item.sku === 'furn.planter.fern' && <>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.4, 0.28, 0.6, 12]} /><meshStandardMaterial color="#c78363" /></mesh>
      <mesh position={[0, 0.8, 0]} scale={[0.6, 0.8, 0.6]}><icosahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#4b8854" /></mesh>
    </>}
    {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}><ringGeometry args={[1.1, 1.2, 32]} /><meshBasicMaterial color="#f8c365" /></mesh>}
  </group>;
}
export function HomeLot(): ReactNode {
  const furniture = useGame((state) => state.furniture);
  const mode = useGame((state) => state.mode);
  return <>
    <mesh position={[-15, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={(event) => {
      if (mode !== 'home') return; event.stopPropagation();
      if (useGame.getState().placing) useGame.getState().placeFurniture([event.point.x, 0, event.point.z]);
      else useGame.getState().selectFurniture(null);
    }}><planeGeometry args={[18, 18]} /><meshStandardMaterial color="#e4d7b7" /></mesh>
    <mesh position={[-15, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[20, 20]} /><meshStandardMaterial color="#527b4f" /></mesh>
    {furniture.map((item) => <FurnitureModel key={item.id} item={item} />)}
  </>;
}
