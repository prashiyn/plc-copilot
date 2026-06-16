# Quick Start Guide

PLCAutoPilot helps you describe automation logic in plain language and export vendor-ready artifacts.

## 1. Sign in

Create an account or sign in from the login page so generated programs and usage meters are saved.

## 2. Open the Generator

Go to **Generator**, pick your PLC model, and describe the logic (for example: "motor start stop with emergency stop").

## 3. Generate and download

Click **Generate**. The BFF calls the FastAPI automation service, builds intermediate representation (IR), and returns a preview plus a downloadable file.

## 4. Import into your IDE

- **Schneider / Rockwell:** native project formats where supported.
- **Siemens / Mitsubishi:** import SCL/ST or bundled zip artifacts per the on-screen tier-2 disclaimer.

## Next steps

- Browse **Project Templates** for ready-made patterns including PID loops.
- Use **HMI Generator** for companion screen scripts and tag CSV files.
