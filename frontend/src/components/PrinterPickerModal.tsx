import { useEffect, useState } from 'react';
import { Printer, CheckCircle2, AlertTriangle, X, Loader2, Save, Zap } from 'lucide-react';
import {
  DesktopPrinter,
  isDesktop,
  listPrinters,
  getSavedPrinter,
  setSavedPrinter,
  autoDetectPrinter,
  testPrint,
} from '../services/printer';

interface Props {
  onClose: () => void;
  onSaved: (name: string) => void;
}

/**
 * Lets the cashier (or admin) pick which Windows printer to use for receipts.
 * Choice is saved per-machine in localStorage. Includes a "Test print" button
 * so they can confirm the POS-80 is wired up correctly before going live.
 */
export default function PrinterPickerModal({ onClose, onSaved }: Props) {
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [selected, setSelected] = useState<string>(getSavedPrinter());
  const [loading, setLoading] = useState(true);
  const [testStatus, setTestStatus] = useState<string>('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await listPrinters();
      setPrinters(list);
      if (!selected) {
        const auto = await autoDetectPrinter();
        if (auto) setSelected(auto);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!selected) return;
    setSavedPrinter(selected);
    onSaved(selected);
  };

  const handleTest = async () => {
    if (!selected) return;
    setTesting(true);
    setTestStatus('Sending test page…');
    try {
      const res = await testPrint(selected);
      setTestStatus(res.ok ? '✓ Test page sent. Check the printer.' : `✗ ${res.error || 'Failed'}`);
    } catch (e: any) {
      setTestStatus(`✗ ${e?.message || 'Failed'}`);
    } finally {
      setTesting(false);
    }
  };

  if (!isDesktop()) {
    // In a browser the OS handles the printer choice in its native print dialog.
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
        <div className="w-full max-w-md bg-panel border border-border rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h2 className="font-display text-lg font-bold">Browser mode</h2>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            You're running in a browser. Printer selection happens in the standard print dialog
            when you click <b>Print</b>. To pre-select a printer here, install the Diamond Chicken
            desktop app on the till machine.
          </p>
          <button onClick={onClose} className="btn btn-primary w-full">Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Printer className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">Receipt printer</h2>
              <p className="text-xs text-text-muted">Choose the Windows printer for receipts</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : printers.length === 0 ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-text-primary mb-1">No printers found</p>
                  <p className="text-text-secondary text-xs leading-relaxed">
                    Install the POS-80 driver in Windows first:<br />
                    1. Plug in the printer via USB and power it on<br />
                    2. Install the driver that came with it (or download "POS-80 driver" from the
                    manufacturer)<br />
                    3. Confirm it shows up in <b>Settings → Bluetooth &amp; devices → Printers</b><br />
                    4. Reopen this app and try again
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted">
                Installed printers
              </p>
              <div className="space-y-2">
                {printers.map((p) => {
                  const active = p.name === selected;
                  const looksLikeThermal =
                    /pos|thermal|80|xprinter/i.test(p.name) || /pos|thermal|80|xprinter/i.test(p.displayName);
                  return (
                    <button
                      key={p.name}
                      onClick={() => setSelected(p.name)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        active
                          ? 'bg-primary/10 border-primary'
                          : 'bg-panel-2 border-border hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            active
                              ? 'bg-primary/20 text-primary'
                              : looksLikeThermal
                              ? 'bg-success/10 text-success'
                              : 'bg-panel text-text-muted'
                          }`}
                        >
                          <Printer className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-sm font-bold truncate ${
                                active ? 'text-primary' : 'text-text-primary'
                              }`}
                            >
                              {p.displayName}
                            </p>
                            {p.isDefault && (
                              <span className="text-[9px] uppercase tracking-wider font-bold text-text-muted bg-panel border border-border px-1.5 py-0.5 rounded">
                                default
                              </span>
                            )}
                            {looksLikeThermal && !active && (
                              <span className="text-[9px] uppercase tracking-wider font-bold text-success bg-success/10 border border-success/30 px-1.5 py-0.5 rounded">
                                thermal
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-[11px] text-text-muted truncate mt-0.5">{p.description}</p>
                          )}
                        </div>
                        {active && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {testStatus && (
            <div
              className={`text-xs rounded-lg px-3 py-2 ${
                testStatus.startsWith('✓')
                  ? 'bg-success/10 border border-success/30 text-success'
                  : testStatus.startsWith('✗')
                  ? 'bg-danger/10 border border-danger/30 text-danger'
                  : 'bg-panel-2 border border-border text-text-secondary'
              }`}
            >
              {testStatus}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
          <button
            onClick={handleTest}
            disabled={!selected || testing}
            className="btn btn-ghost"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Test
          </button>
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!selected}
            className="btn btn-primary flex-1"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
