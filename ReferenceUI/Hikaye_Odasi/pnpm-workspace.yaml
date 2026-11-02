# Copied Sites are standalone projects and cannot inherit the monorepo policy.
minimumReleaseAge: 10080
minimumReleaseAgeIgnoreMissingTime: false
trustLockfile: false
strictDepBuilds: true
allowBuilds:
  esbuild: true
  fsevents: true
  sharp: true
  unrs-resolver: true
  workerd: true
storeDir: ${SITES_PNPM_SHARED_STORE:-.sites-runtime/pnpm-store}
cacheDir: ${SITES_PNPM_SHARED_STORE:-.sites-runtime/pnpm-store}/policy-cache
enableGlobalVirtualStore: false
# Reuse store files with clones or hardlinks before falling back to copies.
packageImportMethod: auto
# The explicit installer owns dependency setup, including restored workspaces.
verifyDepsBeforeRun: false
optimisticRepeatInstall: false
overrides:
  miniflare>sharp: 0.35.4
