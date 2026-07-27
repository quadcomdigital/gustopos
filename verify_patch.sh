set +e
echo '=== STEP 1: confirm patches ==='
grep -nE 'cross-tenant|@Throttle.{0,12}heartbeat|@Throttle.{0,12}claim' apps/api/src/repository/app.repository.ts apps/api/src/app.controller.ts 2>&1 | head -8
echo
echo '=== STEP 2: state defaults audit ==='
echo '--- onboardingSecrets: [] ---'
grep -n 'onboardingSecrets: \[\]' apps/web/src/store/app-store.ts
echo '--- onboardingSecretsLastFetchedAt: null ---'
grep -n 'onboardingSecretsLastFetchedAt: null' apps/web/src/store/app-store.ts
echo '--- all onboarding mentions ---'
grep -n 'onboardingSecrets' apps/web/src/store/app-store.ts | head -15
echo
echo '=== STEP 3: migration ==='
PGPASSWORD=gustopos_dev_password psql -h localhost -U postgres -d gustopos -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='print_bridge_onboarding_secrets')" 2>&1
echo '--- columns ---'
PGPASSWORD=gustopos_dev_password psql -h localhost -U postgres -d gustopos -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='print_bridge_onboarding_secrets' ORDER BY ordinal_position" 2>&1 | head -15
echo
echo '=== STEP 4: ConflictException mapping ==='
python3 << 'PYEOFINNER2'
import os
def apply(path, old, new, summary):
  with open(path, 'r', encoding='utf-8') as f: s = f.read()
  if old not in s:
    print(f'SKIP {path}: ({summary}) - anchor not found'); return
  with open(path, 'w', encoding='utf-8') as f: f.write(s.replace(old, new, 1))
  print(f'OK {path}: ({summary})')
apply('apps/api/src/app.controller.ts',
  '  async bridgeHeartbeat(@Body() raw: unknown, @Req() req: any): Promise<{ bridge: PrintBridge; serverTime: string }> {\n    const auth = await this.verifyBridgeOrOnboardingSecret(req);\n    const payload = printBridgeHeartbeatRequestSchema.parse(raw);\n    const bridge = await this.appRepository.upsertPrintBridge(payload, auth.tenantId);',
  '  async bridgeHeartbeat(@Body() raw: unknown, @Req() req: any): Promise<{ bridge: PrintBridge; serverTime: string }> {\n    const auth = await this.verifyBridgeOrOnboardingSecret(req);\n    const payload = printBridgeHeartbeatRequestSchema.parse(raw);\n    let bridge;\n    try {\n      bridge = await this.appRepository.upsertPrintBridge(payload, auth.tenantId);\n    } catch (e) {\n      if (e instanceof Error && e.message.includes("already used by another tenant")) {\n        throw new ConflictException(e.message);\n      }\n      throw e;\n    }',
  'heartbeat ConflictException mapping')
PYEOFINNER2
echo
echo '=== STEP 5: rebuild ==='
npm run build --workspace @gustopos/shared 2>&1 | tail -5
npm run build --workspace @gustopos/web 2>&1 | tail -8
echo
echo '=== STEP 6: pm2 ==='
pm2 delete all 2>&1 | tail -2
sleep 2
pm2 start ecosystem.hmr.config.cjs 2>&1 | tail -3
sleep 12
echo
echo '=== STEP 7: probe ==='
curl -s -o /dev/null -w 'GET /api/health -> %{http_code}\n' http://localhost:11901/api/health
curl -s -o /dev/null -w 'GET /api/print-bridge/onboarding-secret (no auth) -> %{http_code}\n' http://localhost:11901/api/print-bridge/onboarding-secret
curl -s -o /dev/null -w 'POST heartbeat (no auth) -> %{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"bridgeId":"smoke_x","areas":["kitchen"],"printers":[]}' http://localhost:11901/api/print-bridge/heartbeat
echo
echo '=== STEP 8: typecheck ==='
npm run lint --workspace @gustopos/api 2>&1 | tail -10
echo "api_tc=$?"
npm run lint --workspace @gustopos/print-bridge 2>&1 | tail -6
echo "bridge_tc=$?"
npm run lint --workspace @gustopos/web 2>&1 | tail -8
echo "web_tc=$?"
