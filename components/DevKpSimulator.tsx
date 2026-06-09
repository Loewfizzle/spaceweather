"use client";

interface DevKpSimulatorProps {
  simKp: number | null;
  onSimKp: (kp: number | null) => void;
}

const KP_LEVELS = [4, 5, 6, 7] as const;

export function DevKpSimulator({ simKp, onSimKp }: DevKpSimulatorProps) {
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      background: '#0d1425', border: '1px solid #334155', borderRadius: 8,
      padding: '8px 10px', fontFamily: 'monospace', fontSize: 11,
    }}>
      <div style={{ color: '#475569', marginBottom: 6 }}>DEV · Kp glow</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {KP_LEVELS.map((kp) => (
          <button
            key={kp}
            type="button"
            onClick={() => onSimKp(simKp === kp ? null : kp)}
            style={{
              padding: '3px 8px', cursor: 'pointer', borderRadius: 4, fontSize: 11,
              border: '1px solid #334155',
              background: simKp === kp ? '#1e3a5f' : 'transparent',
              color: simKp === kp ? '#93c5fd' : '#64748b',
            }}
          >
            {kp}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSimKp(null)}
          disabled={simKp === null}
          style={{
            padding: '3px 8px', cursor: simKp === null ? 'default' : 'pointer',
            borderRadius: 4, fontSize: 11, border: '1px solid #334155',
            background: 'transparent', color: simKp === null ? '#1e2937' : '#64748b',
          }}
        >
          ↺
        </button>
      </div>
    </div>
  );
}
