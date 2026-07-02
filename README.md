# 𖥂 ShiftPrint

**Turn your shift table into a beautiful, shareable image — no servers, no accounts, no hassle.**

ShiftPrint is a 100% browser-based web app that transforms the shift schedule you copy from your company portal (or a Markdown table) into a clean, customizable timetable, ready to export as a PNG image or share via QR code with your phone.

## ✨ Features

- 📋 **Smart parsing**: paste the table exactly as you copy it from your portal (tab-separated format) or paste a Markdown table directly — the input format is detected automatically.
- ⏱️ **Automatic calculation** of clock-in/clock-out times, total hours worked per day, and breaks between split shifts.
- 🌙 **Overnight shifts**: detects shifts that cross midnight and calculates their duration correctly.
- 📅 **Days off** automatically identified and marked.
- 🗓️ **Automatic month title detection**: if the table covers a full month, a title is generated automatically ("Shifts · June 2026").
- 🎨 **10 built-in visual themes** (Office Paper, Morning Coffee, Monochrome, Hospital Whiteboard, Night Ink, Night Terminal, Industrial Blueprint, Shadow Clay, Icy Gunmetal, Raspberry Space) plus a **custom mode** with free color pickers for card, text, accent, and header colors.
- 🔤 Swappable fonts for data and titles (Inter, JetBrains Mono, Source Serif 4, DM Mono/Sans, IBM Plex, Space Grotesk).
- 🎛️ Fine-grained controls for font size, corner radius, cell padding, border thickness, zebra rows, weekend highlighting, and card shadow.
- 📝 **Live-editable Markdown**: the schedule is also shown as Markdown, editable by hand, with the preview syncing automatically to your changes.
- 🖼️ **High-quality PNG export**, generated entirely in the browser.
- 📱 **Share via QR code**: generates a QR code with your entire schedule compactly encoded into the URL, so you can scan it with your phone and download the image directly — no data ever touches a server.
- ⚡ Fast, lightweight, and fully offline once loaded.

## 🧭 How it works

1. Copy your shift schedule from your company portal (or any table in Markdown format).
2. Paste it into the **Input data** box and click **Process table** (or try the built-in sample data).
3. Review the automatically generated timetable, with hours, breaks, and days off already calculated.
4. Customize the look: theme, colors, fonts, sizes, and visual options — all updated live on the preview.
5. Export as **PNG** or generate a **QR code** to continue from your phone.

## 🔒 Privacy

Everything runs in your browser. There's no backend, and no data is ever sent to a server. When sharing via QR, the schedule information is compressed and encoded directly into the URL.

## 🛠️ Tech stack

- HTML5 + CSS3
- JavaScript (Vanilla, no frameworks)
- [html-to-image](https://github.com/bubkoo/html-to-image) for PNG export
- [QRious](https://github.com/neocotic/qrious) for QR code generation
- [LZ-String](https://github.com/pieroxy/lz-string) for backward-compatible compressed links

## 📂 Project structure

```
shiftprint/
├── index.html          # Main UI (input, controls, preview, QR modal)
├── style.css            # Styles and visual themes
├── parser.js             # Table parsing (TSV/Markdown) and schedule calculations
├── render.js              # Theme presets and schedule card rendering
├── app.js                  # App logic: events, PNG export, QR, URL state
├── qrious.min.js             # QR code generation library (local)
└── lz-string.min.js           # Compression for legacy link compatibility
```

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/RCGAProds/shiftprint.git
```

Enter the project folder:

```bash
cd shiftprint
```

Open `index.html` directly in your browser, or serve it with a local web server, e.g.:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## 🗺️ Roadmap

- [ ] Additional export formats (PDF, JPG)
- [ ] More schedule templates
- [ ] Save and load style configurations
- [ ] Calendar integration (.ics export)
- [ ] Multi-language support

## 📄 License

This project is licensed under the MIT License.

---

Made with ❤️ by [Carlos (RCGA_Prods)](https://rcgaprods.github.io)
