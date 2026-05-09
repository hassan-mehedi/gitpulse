import { useSettingsStore } from "../../stores/settings";

export function SettingsPanel() {
  const theme = useSettingsStore((state) => state.theme);
  const autoFetch = useSettingsStore((state) => state.autoFetch);
  const autoFetchIntervalSeconds = useSettingsStore((state) => state.autoFetchIntervalSeconds);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAutoFetch = useSettingsStore((state) => state.setAutoFetch);
  const setAutoFetchIntervalSeconds = useSettingsStore(
    (state) => state.setAutoFetchIntervalSeconds
  );

  return (
    <>
      <div className="panel-header">
        <div>
          <div className="panel-header__eyebrow">Settings</div>
          <div className="panel-header__title">Preferences</div>
        </div>
      </div>

      <div className="repo-section-list">
        <section className="repo-card">
          <div className="repo-card__body">
            <div className="repo-card__section">
              <div className="repo-card__section-header">
                <span>Theme</span>
              </div>
              <select
                className="select-input"
                onChange={(event) => setTheme(event.target.value as "dark" | "light")}
                value={theme}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            <div className="repo-card__section">
              <div className="repo-card__section-header">
                <span>Auto Fetch</span>
              </div>
              <label className="settings-row">
                <span>Enable background fetch</span>
                <input
                  checked={autoFetch}
                  onChange={(event) => setAutoFetch(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label className="settings-row">
                <span>Interval (seconds)</span>
                <input
                  className="text-input"
                  disabled={!autoFetch}
                  min={30}
                  onChange={(event) =>
                    setAutoFetchIntervalSeconds(Math.max(30, Number(event.target.value) || 30))
                  }
                  type="number"
                  value={autoFetchIntervalSeconds}
                />
              </label>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
