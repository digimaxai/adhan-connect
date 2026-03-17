from pypdf import PdfReader

path = r"C:\Users\hmakh\Downloads\Feb2026.pdf"
reader = PdfReader(path)

for i, page in enumerate(reader.pages):
    print(f"--- PAGE {i+1} ---")
    print(page.extract_text() or "")
