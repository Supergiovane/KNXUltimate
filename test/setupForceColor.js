// Force colorized output for node --test runs even when CI is set
if (!process.env.FORCE_COLOR) {
  process.env.FORCE_COLOR = '1'
}
// Some tools also look at NO_COLOR; ensure it is cleared so colors stay enabled
if (process.env.NO_COLOR) {
  delete process.env.NO_COLOR
}
