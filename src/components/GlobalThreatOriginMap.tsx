import React from 'react';
import { ExtractedEntity } from '../types';
import { ThreatGlobe } from './3d/ThreatGlobe';

interface GlobalThreatOriginMapProps {
  entities: ExtractedEntity[];
  onInspectGraph: () => void;
}

export const GlobalThreatOriginMap: React.FC<GlobalThreatOriginMapProps> = ({
  entities,
  onInspectGraph,
}) => {
  return <ThreatGlobe entities={entities} onInspectGraph={onInspectGraph} />;
};

export default GlobalThreatOriginMap;
