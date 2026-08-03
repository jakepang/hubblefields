# Documentation

## Hubble Fields User Guide (Bilingual PDF)

- File: [`Hubble-Fields-User-Guide-Bilingual.pdf`](./Hubble-Fields-User-Guide-Bilingual.pdf)
- Contents: feature overview and usage instructions (**English first, Chinese underneath**)
- Includes Project Admin manual punch create/edit

### Regenerate

Requires system fonts (WenQuanYi Micro Hei, Liberation Sans) and `reportlab`:

```bash
python3 -m pip install reportlab
python3 scripts/generate-user-guide-pdf.py
```
