const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("fs");
const vm = require("vm");
const code = ts.transpileModule(
  fs.readFileSync("lib/serviceListings.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const context = { exports: {}, URL, Intl, Date };
vm.runInNewContext(code, context);
const { httpsUrl, validDate, intakeAvailability, serviceAction, londonToday } =
  context.exports;
for (const bad of [
  "javascript:alert(1)",
  "http://example.com",
  "https://user:password@example.com",
  "https://example.com/a b",
  "not a link",
])
  assert.equal(httpsUrl(bad), null);
assert.equal(
  httpsUrl(" https://donate.stripe.com/example "),
  "https://donate.stripe.com/example",
);
assert.equal(validDate("2026-02-30"), false);
assert.equal(validDate("2028-02-29"), true);
const intake = {
  state: "upcoming",
  enrolment: "open",
  start_date: "2026-09-26",
  end_date: null,
  enrolment_closes_on: null,
};
assert.equal(intakeAvailability(intake, "2026-09-27").state, "running");
assert.equal(intakeAvailability(intake, "2026-09-27").canApply, true);
assert.equal(
  intakeAvailability(
    { ...intake, enrolment_closes_on: "2026-09-25" },
    "2026-09-26",
  ).canApply,
  false,
);
assert.equal(
  intakeAvailability({ ...intake, state: "cancelled" }, "2026-09-16").canApply,
  false,
);
assert.equal(
  intakeAvailability({ ...intake, end_date: "2026-10-01" }, "2026-10-02").state,
  "completed",
);
assert.equal(
  serviceAction({ action_type: "whatsapp", action_value: "07817 364400" }).url,
  null,
);
assert.equal(
  serviceAction({ action_type: "whatsapp", action_value: "+447817364400" }).url,
  "https://wa.me/447817364400",
);
assert.equal(londonToday(new Date("2026-09-16T23:30:00Z")), "2026-09-17");
console.log(
  "Service rules passed: external URLs, calendar dates, London dates, intake lifecycle and contact methods.",
);
