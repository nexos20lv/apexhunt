import React from 'react';
import { X, Activity, Radio, Zap, AlertTriangle, ShieldAlert } from 'lucide-react';
import { TacticalEventPublic } from '../hooks/useGameSocket';

interface TacticalJournalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  events?: TacticalEventPublic[];
}

export const TacticalJournalSheet: React.FC<TacticalJournalSheetProps> = ({
  isOpen,
  onClose,
  events = [],
}) => {
  if (!isOpen) return null;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'infected':
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      case 'perk':
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case 'ping':
        return <Radio className="w-4 h-4 text-blue-400" />;
      case 'zone':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
      />

      {/* Sheet Content */}
      <div className="relative bg-black/95 border-t border-slate-800 rounded-t-3xl max-h-[75vh] flex flex-col backdrop-blur-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-10 animate-in slide-in-from-bottom duration-300">
        {/* Grab Handle */}
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-700/80 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider font-orbitron text-slate-100">
              Journal de Traque ({events.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 active-press hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Events List */}
        <div className="p-4 overflow-y-auto flex flex-col gap-2.5 max-h-[50vh]">
          {events.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 italic">
              Aucun événement tactique enregistré pour le moment.
            </div>
          ) : (
            events
              .slice()
              .reverse()
              .map((event) => (
                <div
                  key={event.id}
                  className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-black/60 border border-white/10 mt-0.5">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        {event.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {event.time}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-200 mt-0.5 leading-snug">
                      {event.message}
                    </p>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Footer Close */}
        <div className="p-4 border-t border-slate-800/60 bg-black/40">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold py-3 rounded-xl text-xs uppercase tracking-wider active-press"
          >
            Fermer le Journal
          </button>
        </div>
      </div>
    </div>
  );
};
