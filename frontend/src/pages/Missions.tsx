/* ============================================================
   AquaYantra — Missions Management Page
   Mission lifecycle, deployment scheduling, coverage area stats,
   and operational command controls
   ============================================================ */

import { useState } from 'react';
import {
  Compass,
  Plus,
  Play,
  Anchor,
} from 'lucide-react';
import { useMissionStore } from '../stores';
import { StatusBadge } from '../components/StatusBadge';
import type { Mission, Deployment } from '../types';

const SAMPLE_MISSIONS: Mission[] = [
  {
    id: 'demo-mission-001',
    name: 'Harbor Seabed Anomaly Reconnaissance',
    description: 'High-density magnetometer grid survey across shipping channel anchorage.',
    operator: 'Commander V. Sharma',
    status: 'active',
    start_time: '2026-09-04T08:00:00Z',
    end_time: null,
    created_at: '2026-09-04T07:30:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'demo-mission-002',
    name: 'Sector 7 Ferrous Infrastructure Survey',
    description: 'Pipeline corridor magnetic baseline confirmation and bathymetry logging.',
    operator: 'Dr. A. Sen',
    status: 'completed',
    start_time: '2026-09-02T10:00:00Z',
    end_time: '2026-09-02T16:30:00Z',
    created_at: '2026-09-02T09:00:00Z',
    updated_at: '2026-09-02T16:30:00Z',
  },
  {
    id: 'demo-mission-003',
    name: 'Deepwater Trench Anomaly Verification',
    description: 'Sub-seabed mineral anomaly mapping with 3-axis vector sensor payload.',
    operator: 'Operations Team Alpha',
    status: 'planned',
    start_time: null,
    end_time: null,
    created_at: '2026-09-03T14:00:00Z',
    updated_at: '2026-09-03T14:00:00Z',
  },
];

const SAMPLE_DEPLOYMENTS: Deployment[] = [
  {
    id: 'demo-deploy-001',
    mission_id: 'demo-mission-001',
    device_id: 'demo-device-001',
    deployment_number: 1,
    status: 'active',
    start_time: '2026-09-04T08:15:00Z',
    end_time: null,
    maximum_depth: 18.4,
    created_at: '2026-09-04T08:10:00Z',
    updated_at: '2026-09-04T08:15:00Z',
  },
  {
    id: 'demo-deploy-002',
    mission_id: 'demo-mission-001',
    device_id: 'demo-device-001',
    deployment_number: 2,
    status: 'completed',
    start_time: '2026-09-03T09:00:00Z',
    end_time: '2026-09-03T14:20:00Z',
    maximum_depth: 21.2,
    created_at: '2026-09-03T08:50:00Z',
    updated_at: '2026-09-03T14:20:00Z',
  },
];

export function MissionsPage() {
  const selectedMission = useMissionStore((s) => s.selectedMission);
  const setMission = useMissionStore((s) => s.setMission);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newMissionName, setNewMissionName] = useState('');
  const [newOperator, setNewOperator] = useState('');

  const handleSelectMission = (m: Mission) => {
    setMission(m);
  };

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Compass size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              SURVEY MISSIONS & DEPLOYMENT MANAGEMENT
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Plan, initialize, and monitor seabed reconnaissance operations
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors"
        >
          <Plus size={14} />
          <span>NEW MISSION</span>
        </button>
      </div>

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 font-mono">
          <span className="telemetry-label">Total Missions</span>
          <div className="text-base font-bold text-[var(--text-primary)] mt-1">3 Recorded</div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">1 active in progress</span>
        </div>

        <div className="card p-3 font-mono">
          <span className="telemetry-label">Deployments</span>
          <div className="text-base font-bold text-cyan-300 mt-1">2 Sorties</div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Node ID: AQUAYANTRA-SIM-001</span>
        </div>

        <div className="card p-3 font-mono">
          <span className="telemetry-label">Surveyed Area</span>
          <div className="text-base font-bold text-emerald-400 mt-1">0.42 km²</div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Track coverage: 94.2%</span>
        </div>

        <div className="card p-3 font-mono">
          <span className="telemetry-label">Max Recorded Depth</span>
          <div className="text-base font-bold text-cyan-400 mt-1">21.2 m</div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">Hydrostatic pressure rating safe</span>
        </div>
      </div>

      {/* Missions List */}
      <div className="card p-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <span className="section-header !border-b-0 !mb-0 !pb-0">
            Registered Survey Missions
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Click to activate mission context
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {SAMPLE_MISSIONS.map((m) => {
            const isSelected = selectedMission?.id === m.id;
            return (
              <div
                key={m.id}
                onClick={() => handleSelectMission(m)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm'
                    : 'bg-[var(--bg-deep)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-wide">
                        {m.name}
                      </h3>
                      <StatusBadge status={m.status} size="sm" pulse={m.status === 'active'} />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      {m.description}
                    </p>
                  </div>

                  <div className="text-right text-[10px] font-mono text-[var(--text-muted)] space-y-0.5">
                    <div>OPERATOR: <span className="text-[var(--text-secondary)]">{m.operator}</span></div>
                    <div>START: <span className="text-[var(--text-secondary)]">{m.start_time ? new Date(m.start_time).toLocaleDateString() : 'Pending'}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Deployments for Selected Mission */}
      <div className="card p-3 h-[200px] shrink-0 flex flex-col">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Anchor size={14} className="text-cyan-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Deployments for {selectedMission?.name || 'Selected Mission'}
            </span>
          </div>
          <button
            onClick={() => alert('Starting new deployment sortie...')}
            className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono hover:bg-emerald-500/25 transition-colors flex items-center gap-1"
          >
            <Play size={10} />
            <span>START SORTIE</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-subtle)]">
              <tr>
                <th className="pb-1.5">Deployment #</th>
                <th className="pb-1.5">Device Serial</th>
                <th className="pb-1.5">Status</th>
                <th className="pb-1.5">Max Depth</th>
                <th className="pb-1.5">Start Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {SAMPLE_DEPLOYMENTS.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--bg-hover)]">
                  <td className="py-2 text-cyan-300 font-bold">Deploy #{d.deployment_number}</td>
                  <td className="py-2 text-[var(--text-secondary)]">{d.device_id}</td>
                  <td className="py-2">
                    <StatusBadge status={d.status} size="sm" pulse={d.status === 'active'} />
                  </td>
                  <td className="py-2 text-[var(--text-muted)]">
                    {d.start_time ? new Date(d.start_time).toLocaleTimeString() : 'Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">CREATE NEW SURVEY MISSION</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">Mission Title</label>
                <input
                  type="text"
                  placeholder="e.g. Western Anchorage Anomaly Recon"
                  value={newMissionName}
                  onChange={(e) => setNewMissionName(e.target.value)}
                  className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded p-2 text-[var(--text-primary)] outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">Lead Operator / Researcher</label>
                <input
                  type="text"
                  placeholder="e.g. Marine Survey Lead"
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value)}
                  className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded p-2 text-[var(--text-primary)] outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] text-xs hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert(`Mission "${newMissionName || 'New Mission'}" created!`);
                  setShowCreateModal(false);
                }}
                className="px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30"
              >
                Create Mission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
