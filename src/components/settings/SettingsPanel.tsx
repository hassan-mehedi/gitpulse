import { useSettingsStore } from "../../stores/settings";
import { useRuntimeStore } from "../../stores/runtime";

export function SettingsPanel() {
  const theme = useSettingsStore((state) => state.theme);
  const autoFetch = useSettingsStore((state) => state.autoFetch);
  const autoFetchIntervalSeconds = useSettingsStore((state) => state.autoFetchIntervalSeconds);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAutoFetch = useSettingsStore((state) => state.setAutoFetch);
  const setAutoFetchIntervalSeconds = useSettingsStore(
    (state) => state.setAutoFetchIntervalSeconds
  );
  const gitVersion = useRuntimeStore((state) => state.gitVersion);

  return (
    <>
      <div className="view-title">
        <h2 className="view-title__label">Settings</h2>
      </div>

      <div className="scm-body settings-panel">
        <section className="settings-section">
          <div className="settings-section__title">Application</div>
          <SettingRow label="Theme" hint="Dark or Light Modern color palette.">
            <select
              className="settings-control"
              onChange={(event) => setTheme(event.target.value as "dark" | "light")}
              value={theme}
            >
              <option value="dark">Dark Modern</option>
              <option value="light">Light Modern</option>
            </select>
          </SettingRow>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">Auto Fetch</div>
          <SettingRow
            label="Enable background fetch"
            hint="Periodically run `git fetch --all` for every open repository."
          >
            <input
              checked={autoFetch}
              onChange={(event) => setAutoFetch(event.target.checked)}
              type="checkbox"
            />
          </SettingRow>
          <SettingRow
            label="Fetch interval"
            hint="Seconds between background fetches (minimum 30)."
          >
            <input
              className="settings-control settings-control--narrow"
              disabled={!autoFetch}
              min={30}
              onChange={(event) =>
                setAutoFetchIntervalSeconds(Math.max(30, Number(event.target.value) || 30))
              }
              type="number"
              value={autoFetchIntervalSeconds}
            />
          </SettingRow>
        </section>

        <section className="settings-section">
          <div className="settings-section__title">About</div>
          <SettingRow label="Git binary">
            <span className="settings-readonly">{gitVersion ?? "Detecting…"}</span>
          </SettingRow>
          <SettingRow label="GitPulse">
            <span className="settings-readonly">0.1.0 — dev</span>
          </SettingRow>
        </section>
      </div>
    </>
  );
}

function SettingRow({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__name">{label}</div>
        {hint ? <div className="settings-row__hint">{hint}</div> : null}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}
