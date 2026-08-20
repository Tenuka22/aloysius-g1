import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Plus } from "lucide-react";
import { useApplicationStore } from "@/lib/application-store";

export const Route = createFileRoute("/")({ component: HomeComponent });

function getSavedKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem("aloysius-g1-application-keys") ?? "[]") as string[];
    const legacy = localStorage.getItem("aloysius-g1-application-key");
    return [...new Set(legacy ? [legacy, ...saved] : saved)];
  } catch { return []; }
}

function HomeComponent() {
  const keys = getSavedKeys();
  const reset = useApplicationStore((state) => state.reset);
  const createNewApplication = () => {
    localStorage.removeItem("aloysius-g1-application-key");
    reset();
    window.location.assign("/application");
  };
  return <main className="application-landing" data-surface="g1-2026-application">
    <p className="form-kicker">G1 2026 intake</p>
    <h1>Start or continue an application</h1>
    <p>Each child has a separate private application key. Keep each key safe so you can return and update that child’s application.</p>
    <div className="landing-actions"><button className="primary-button" type="button" onClick={createNewApplication}><Plus size={17} /> New application</button><Link className="secondary-button" to="/application/access"><KeyRound size={17} /> Load with a key</Link></div>
    {keys.length > 0 && <section className="saved-applications"><h2>Your saved applications</h2><p>These keys are saved on this device.</p>{keys.map((key) => <Link className="saved-application" key={key} to="/application/access" search={{ key }}><span><KeyRound size={16} /> Application ending in <strong>{key.slice(-6)}</strong></span><ArrowRight size={16} /></Link>)}</section>}
  </main>;
}
