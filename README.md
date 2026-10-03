# Canvas App Visualizer

Open-source, local-first visualizer and static analyzer for Microsoft Power Apps Canvas Apps.

The project is designed to inspect `.msapp` packages and active Canvas source files (`.pa.yaml`) without requiring a Power Apps Studio session. It aims to provide an approximate visual preview, control hierarchy, formula inspection, static diagnostics, delegation-risk hints, and technical optimization suggestions.

> This project is not affiliated with or endorsed by Microsoft. It does not replace Power Apps Studio or the Power Apps runtime.

Development starts from the current Microsoft Canvas source-code format and treats generated `.pa.yaml` as inspection input rather than as a private environment dependency.
