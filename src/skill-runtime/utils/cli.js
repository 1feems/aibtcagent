export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function handleError(error) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}
