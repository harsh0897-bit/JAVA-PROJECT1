import React, { useMemo } from 'react';
import {
  Folder,
  FileText,
  Network,
  Search,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import { DropletTabs, DropletTabItem } from '../ui/DropletTabs';

export type InvestigationStageId =
  | 'OVERVIEW'
  | 'EVIDENCE'
  | 'GRAPH'
  | 'TIMELINE'
  | 'INTEGRITY'
  | 'REPORT';

export interface InvestigationStepperProps {
  activeStage: InvestigationStageId;
  onSelectStage: (stage: InvestigationStageId) => void;
  evidenceCount?: number;
  entityCount?: number;
  timelineCount?: number;
}

export const InvestigationStepper: React.FC<InvestigationStepperProps> = ({
  activeStage,
  onSelectStage,
  evidenceCount,
  entityCount,
  timelineCount,
}) => {
  const items = useMemo<DropletTabItem[]>(
    () => [
      {
        id: 'OVERVIEW',
        sublabel: '01',
        label: 'Ingest',
        icon: Folder,
      },
      {
        id: 'EVIDENCE',
        sublabel: '02',
        label: 'Analyze',
        icon: FileText,
        badge: evidenceCount,
      },
      {
        id: 'GRAPH',
        sublabel: '03',
        label: 'Reconstruct',
        icon: Network,
        badge: entityCount,
      },
      {
        id: 'TIMELINE',
        sublabel: '04',
        label: 'Correlate',
        icon: Search,
        badge: timelineCount,
      },
      {
        id: 'INTEGRITY',
        sublabel: '05',
        label: 'Validate',
        icon: ShieldCheck,
      },
      {
        id: 'REPORT',
        sublabel: '06',
        label: 'Report',
        icon: FileCheck2,
      },
    ],
    [evidenceCount, entityCount, timelineCount]
  );

  return (
    <nav
      data-shell-row="2"
      aria-label="Investigation Workflow Stages"
      className="relative h-[var(--row2,60px)] flex items-center select-none min-w-0"
    >
      <DropletTabs
        items={items}
        value={activeStage}
        onChange={(id) => onSelectStage(id as InvestigationStageId)}
        variant="stepper"
        connectors
        ariaLabel="Investigation Workflow Stages"
      />
    </nav>
  );
};

export default InvestigationStepper;
