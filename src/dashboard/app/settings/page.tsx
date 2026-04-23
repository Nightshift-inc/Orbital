import { getSettings } from '../../lib/api-client';
import type { Settings } from '../../lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const sessionToken = process.env.ORBITAL_DEMO_TOKEN ?? '';

  let settings: Settings | null = null;
  try {
    settings = await getSettings(sessionToken);
  } catch {
    /* fall through */
  }

  if (!settings) {
    return (
      <div className="rounded-lg border border-slate-800 bg-orbital-surface p-8 text-slate-400">
        Unable to reach api-gateway.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          {settings.company_name} · {settings.billing_email}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">API keys</h2>
        <div className="overflow-hidden rounded-lg border border-slate-800">
          {settings.api_keys.map((key, i) => (
            <div
              key={key.id}
              className={`flex items-center justify-between p-4 ${i > 0 ? 'border-t border-slate-800' : ''}`}
            >
              <div>
                <div className="font-mono text-sm text-slate-200">
                  {key.prefix}{key.masked_suffix}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Scopes: {key.scopes.join(', ')}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Created {key.created_at.slice(0, 10)}</div>
                <div>Last used {new Date(key.last_used_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="text-sm text-orbital-accent hover:underline">+ Create new key</button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Webhooks</h2>
        <div className="overflow-hidden rounded-lg border border-slate-800">
          {settings.webhooks.map((hook, i) => (
            <div key={hook.id} className={`p-4 ${i > 0 ? 'border-t border-slate-800' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm text-slate-200">{hook.url}</div>
                <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs uppercase text-emerald-300">
                  {hook.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {hook.events.map((evt) => (
                  <span key={evt} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {evt}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Team</h2>
        <div className="overflow-hidden rounded-lg border border-slate-800">
          {settings.team_members.map((m, i) => (
            <div
              key={m.email}
              className={`flex items-center justify-between p-4 ${i > 0 ? 'border-t border-slate-800' : ''}`}
            >
              <div>
                <div className="text-sm text-slate-100">{m.name}</div>
                <div className="text-xs text-slate-500">{m.email}</div>
              </div>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-300">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
