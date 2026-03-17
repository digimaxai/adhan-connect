from pypdf import PdfReader
import csv
import re

PDF_PATH = r"C:\Users\hmakh\Downloads\Feb2026.pdf"
OUTPUT_CSV = "prayer_times_Feb2026.csv"

reader = PdfReader(PDF_PATH)
text = "\n".join(page.extract_text() or "" for page in reader.pages)

lines = [line.strip() for line in text.splitlines() if line.strip()]

# Find table start by locating the header line containing FAJR and DHUHR
start_idx = 0
for i, line in enumerate(lines):
    if re.search(r"FAJR\s+DHUHR", line, flags=re.IGNORECASE):
        start_idx = i + 1
        break

rows = []
for line in lines[start_idx:]:
    # stop if we hit a footer section
    if line.upper().startswith("MAGHRIB") or line.upper().startswith("JUMU"):
        break

    parts = line.split()
    if len(parts) < 12:
        continue

    # Expect: day, date, weekday, fajr_start, fajr_jamaah, sunrise, dhuhr_start, dhuhr_jamaah,
    # asr_start, asr_jamaah, maghrib_start, maghrib_jamaah, isha_start, isha_jamaah
    # Some rows may include both month/day (e.g. 30/1) in date field.
    day = parts[0]
    date = parts[1]
    weekday = parts[2]
    times = parts[3:]

    # If we have exactly 11 time tokens, then treat as 5 prayers with sunrise included.
    # If 12 tokens, it includes both sunrise and maghrib/isha.
    if len(times) == 11:
        (fajr_start, fajr_jamaah, sunrise, dhuhr_start, dhuhr_jamaah,
         asr_start, asr_jamaah, maghrib_start, maghrib_jamaah, isha_start, isha_jamaah) = times
    elif len(times) == 10:
        # Some rows may miss sunrise; this shouldn't happen but fallback.
        (fajr_start, fajr_jamaah, dhuhr_start, dhuhr_jamaah,
         asr_start, asr_jamaah, maghrib_start, maghrib_jamaah, isha_start, isha_jamaah) = times
        sunrise = ""
    else:
        # If there are more tokens (e.g., line breaks), just take first 11.
        if len(times) >= 11:
            fajr_start, fajr_jamaah, sunrise, dhuhr_start, dhuhr_jamaah, asr_start, asr_jamaah, maghrib_start, maghrib_jamaah, isha_start, isha_jamaah = times[:11]
        else:
            continue

    rows.append({
        "day": day,
        "date": date,
        "weekday": weekday,
        "fajr_start": fajr_start,
        "fajr_jamaah": fajr_jamaah,
        "sunrise": sunrise,
        "dhuhr_start": dhuhr_start,
        "dhuhr_jamaah": dhuhr_jamaah,
        "asr_start": asr_start,
        "asr_jamaah": asr_jamaah,
        "maghrib_start": maghrib_start,
        "maghrib_jamaah": maghrib_jamaah,
        "isha_start": isha_start,
        "isha_jamaah": isha_jamaah,
    })

with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} rows to {OUTPUT_CSV}")
