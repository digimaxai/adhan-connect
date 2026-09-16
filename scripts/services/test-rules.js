const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync("lib/serviceListings.ts", "utf8").replace(/^import type .*$/m, "");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, URL, Intl, Date };
vm.runInNewContext(code, context);
const { httpsUrl, validDate, londonToday, classStatus, enrolmentChip, serviceAction, actionValueValid, formatDays, formatTime, formatTimeRange } = context.exports;

for (const bad of ["javascript:alert(1)", "http://example.com", "https://user:password@example.com", "https://example.com/a b", "not a link"]) assert.equal(httpsUrl(bad), null);
assert.equal(httpsUrl(" https://donate.stripe.com/example "), "https://donate.stripe.com/example");
assert.equal(validDate("2026-02-30"), false);
assert.equal(validDate("2028-02-29"), true);
assert.equal(londonToday(new Date("2026-09-16T23:30:00Z")), "2026-09-17");

const cls = { start_date: "2026-09-26", end_date: null, taking_enrolments: true };
assert.equal(classStatus(cls, "2026-09-20"), "upcoming");
assert.equal(classStatus(cls, "2026-09-27"), "running");
assert.equal(classStatus({ ...cls, end_date: "2026-10-01" }, "2026-10-02"), "finished");
assert.equal(classStatus({ start_date: null, end_date: null }, "2026-09-20"), "running");
assert.equal(enrolmentChip(cls, "2026-09-20").canApply, true);
assert.equal(enrolmentChip({ ...cls, taking_enrolments: false }, "2026-09-20").canApply, false);
assert.equal(enrolmentChip({ ...cls, end_date: "2026-10-01" }, "2026-10-02").label, "Finished");
assert.equal(enrolmentChip(cls, "2026-09-27").label, "Enrolling now");

assert.equal(formatDays(["sat"]), "Every Saturday");
assert.equal(formatDays(["sun", "sat"]), "Weekends");
assert.equal(formatDays(["mon", "tue", "wed", "thu", "fri"]), "Mon–Fri");
assert.equal(formatDays(["mon", "wed"]), "Mon & Wed");
assert.equal(formatDays(["tue", "wed", "thu"]), "Tue–Thu");
assert.equal(formatTime("09:00"), "9am");
assert.equal(formatTime("13:30"), "1:30pm");
assert.equal(formatTimeRange("09:00", "13:00"), "9am–1pm");

assert.equal(serviceAction({ action_type: "whatsapp", action_value: "07817 364400" }).url, null);
assert.equal(serviceAction({ action_type: "whatsapp", action_value: "+447817364400" }).url, "https://wa.me/447817364400");
assert.equal(serviceAction({ action_type: "phone", action_value: "07817 364400" }).url, "tel:07817364400");
assert.equal(actionValueValid("drop_in", ""), true);
assert.equal(actionValueValid("website", "http://x.org"), false);
console.log("Class rules passed: URLs, dates, derived status, enrolment chip, day/time formatting, contact methods.");
