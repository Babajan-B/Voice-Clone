import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1080;
const H = 1080;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "outputs");
const IMAGE_PATH = path.join(HERE, "voice.png");

const COLORS = {
  bg: "#07101F",
  panel: "#101A33",
  panel2: "#0E1730",
  border: "#2A3C6B",
  text: "#F8FAFC",
  muted: "#A8B3CF",
  violet: "#8B5CF6",
  blue: "#3B82F6",
  cyan: "#38BDF8",
  line: "#7C93D0",
  white10: "#FFFFFF1A",
  white06: "#FFFFFF10",
};

const FONT = {
  title: "Poppins",
  body: "Lato",
  mono: "Aptos Mono",
};

async function readImageBlob(imagePath) {
  const bytes = await fs.readFile(imagePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function addShape(slide, geometry, left, top, width, height, fill, line = null, lineWidth = 0) {
  return slide.shapes.add({
    geometry,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: line || "#00000000", width: lineWidth },
  });
}

function addText(slide, text, left, top, width, height, options = {}) {
  const box = addShape(
    slide,
    "rect",
    left,
    top,
    width,
    height,
    options.fill || "#00000000",
    options.line || "#00000000",
    options.lineWidth || 0,
  );
  box.text = text;
  box.text.fontSize = options.fontSize || 24;
  box.text.color = options.color || COLORS.text;
  box.text.bold = Boolean(options.bold);
  box.text.typeface = options.typeface || FONT.body;
  box.text.alignment = options.alignment || "left";
  box.text.verticalAlignment = options.verticalAlignment || "top";
  box.text.insets = options.insets || { left: 0, right: 0, top: 0, bottom: 0 };
  return box;
}

async function addImage(slide, imagePath, left, top, width, height, fit = "cover") {
  const image = slide.images.add({
    blob: await readImageBlob(imagePath),
    fit,
    alt: "Voice Clone launch visual",
  });
  image.position = { left, top, width, height };
  return image;
}

function addBackground(slide) {
  slide.background.fill = COLORS.bg;
  addShape(slide, "rect", 0, 0, W, H, COLORS.bg);
  addShape(slide, "ellipse", -80, -40, 360, 360, "#8B5CF620");
  addShape(slide, "ellipse", 820, -120, 360, 360, "#2563EB20");
  addShape(slide, "ellipse", 760, 800, 280, 280, "#06B6D410");
}

function addTopLabel(slide, index, label) {
  addText(slide, `${index}`, 84, 72, 48, 30, {
    fontSize: 24,
    bold: true,
    typeface: FONT.mono,
    color: COLORS.cyan,
  });
  addText(slide, label.toUpperCase(), 140, 74, 360, 24, {
    fontSize: 16,
    bold: true,
    typeface: FONT.mono,
    color: COLORS.muted,
  });
}

function addFooter(slide, text = "Voice Clone • Local-first voice cloning studio") {
  addShape(slide, "rect", 84, 1000, 912, 1, COLORS.white10);
  addText(slide, text, 84, 1014, 912, 22, {
    fontSize: 15,
    color: COLORS.muted,
    typeface: FONT.body,
  });
}

function addBulletList(slide, items, left, top, width) {
  items.forEach((item, idx) => {
    addShape(slide, "ellipse", left, top + idx * 54 + 10, 10, 10, COLORS.cyan);
    addText(slide, item, left + 24, top + idx * 54, width - 24, 38, {
      fontSize: 28,
      color: COLORS.text,
      typeface: FONT.body,
    });
  });
}

async function slide1(presentation) {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTopLabel(slide, "01", "Launch");
  addText(slide, "Voice Clone", 84, 132, 520, 82, {
    fontSize: 56,
    bold: true,
    typeface: FONT.title,
  });
  addText(slide, "Local voice cloning studio for saving voices, transcribing media, generating new speech, and converting one voice into another.", 84, 226, 432, 186, {
    fontSize: 28,
    color: COLORS.muted,
    typeface: FONT.body,
  });
  addShape(slide, "roundRect", 84, 454, 278, 62, COLORS.panel, COLORS.border, 1.5);
  addText(slide, "100% local", 114, 475, 200, 24, {
    fontSize: 24,
    bold: true,
    typeface: FONT.title,
  });
  addShape(slide, "roundRect", 84, 534, 278, 62, COLORS.panel, COLORS.border, 1.5);
  addText(slide, "Private by design", 114, 555, 220, 24, {
    fontSize: 24,
    bold: true,
    typeface: FONT.title,
  });
  addShape(slide, "roundRect", 84, 614, 278, 62, COLORS.panel, COLORS.border, 1.5);
  addText(slide, "Qwen3-TTS + faster-whisper", 114, 635, 230, 24, {
    fontSize: 21,
    bold: true,
    typeface: FONT.title,
  });
  addShape(slide, "roundRect", 560, 120, 436, 760, COLORS.panel2, COLORS.border, 1.5);
  await addImage(slide, IMAGE_PATH, 578, 138, 400, 724, "cover");
  addFooter(slide);
}

async function slide2(presentation) {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTopLabel(slide, "02", "Problem");
  addText(slide, "Why I built it", 84, 136, 420, 62, {
    fontSize: 48,
    bold: true,
    typeface: FONT.title,
  });
  addText(slide, "Most voice tools are fragmented across scripts, cloud dashboards, and disconnected workflows.", 84, 214, 700, 80, {
    fontSize: 30,
    color: COLORS.muted,
  });
  addShape(slide, "roundRect", 84, 340, 912, 460, COLORS.panel2, COLORS.border, 1.5);
  addBulletList(slide, [
    "Saving a reusable reference voice is usually separate from transcription.",
    "Voice generation and voice conversion often live in different tools.",
    "Cloud-first tools raise privacy concerns for personal voice data.",
    "Local workflows are powerful, but the UX is usually rough.",
    "This project puts everything into one clean local studio.",
  ], 126, 392, 830);
  addFooter(slide);
}

async function slide3(presentation) {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTopLabel(slide, "03", "Workflow");
  addText(slide, "What the app does", 84, 136, 460, 62, {
    fontSize: 48,
    bold: true,
    typeface: FONT.title,
  });
  addShape(slide, "roundRect", 84, 256, 210, 520, COLORS.panel2, COLORS.border, 1.5);
  addShape(slide, "roundRect", 326, 256, 210, 520, COLORS.panel2, COLORS.border, 1.5);
  addShape(slide, "roundRect", 568, 256, 210, 520, COLORS.panel2, COLORS.border, 1.5);
  addShape(slide, "roundRect", 810, 256, 186, 520, COLORS.panel2, COLORS.border, 1.5);
  const titles = ["Voice Profiles", "Transcribe", "Synthesize", "Convert"];
  const bodies = [
    "Record or upload a reference clip and save a reusable voice profile.",
    "Turn audio or video into cleaned transcript text plus subtitle timing.",
    "Generate new speech from saved voice style and target text.",
    "Transcribe source media and re-speak it using another saved voice.",
  ];
  [84, 326, 568, 810].forEach((x, i) => {
    addText(slide, titles[i], x + 22, 288, 160, 56, {
      fontSize: 28,
      bold: true,
      typeface: FONT.title,
    });
    addText(slide, bodies[i], x + 22, 380, x === 810 ? 142 : 166, 180, {
      fontSize: 24,
      color: COLORS.muted,
    });
  });
  addText(slide, "1", 106, 344, 38, 38, { fontSize: 24, bold: true, typeface: FONT.mono, color: COLORS.cyan });
  addText(slide, "2", 348, 344, 38, 38, { fontSize: 24, bold: true, typeface: FONT.mono, color: COLORS.cyan });
  addText(slide, "3", 590, 344, 38, 38, { fontSize: 24, bold: true, typeface: FONT.mono, color: COLORS.cyan });
  addText(slide, "4", 832, 344, 38, 38, { fontSize: 24, bold: true, typeface: FONT.mono, color: COLORS.cyan });
  addFooter(slide);
}

async function slide4(presentation) {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTopLabel(slide, "04", "Architecture");
  addText(slide, "How it works under the hood", 84, 136, 700, 62, {
    fontSize: 48,
    bold: true,
    typeface: FONT.title,
  });
  addText(slide, "The project is intentionally local-first and split into a clear frontend/backend pipeline.", 84, 214, 760, 66, {
    fontSize: 28,
    color: COLORS.muted,
  });
  addShape(slide, "roundRect", 84, 336, 250, 360, COLORS.panel2, COLORS.border, 1.5);
  addShape(slide, "roundRect", 414, 336, 250, 360, COLORS.panel2, COLORS.border, 1.5);
  addShape(slide, "roundRect", 744, 336, 252, 360, COLORS.panel2, COLORS.border, 1.5);
  addText(slide, "Frontend", 110, 372, 180, 44, { fontSize: 34, bold: true, typeface: FONT.title });
  addText(slide, "Next.js 16\nReact 19\nTailwind 4\nSSE client + recorder", 110, 432, 180, 180, {
    fontSize: 26,
    color: COLORS.muted,
  });
  addText(slide, "Backend", 440, 372, 180, 44, { fontSize: 34, bold: true, typeface: FONT.title });
  addText(slide, "FastAPI\nAudio normalization\nModel manager lock\nStreaming endpoints", 440, 432, 190, 180, {
    fontSize: 26,
    color: COLORS.muted,
  });
  addText(slide, "Models + files", 770, 372, 190, 44, { fontSize: 34, bold: true, typeface: FONT.title });
  addText(slide, "Qwen3-TTS\nfaster-whisper\nsaved_voices/\ngenerated/", 770, 432, 190, 180, {
    fontSize: 26,
    color: COLORS.muted,
  });
  addText(slide, "User actions flow left → right and results stream back into the UI.", 84, 770, 760, 34, {
    fontSize: 24,
    color: COLORS.cyan,
    bold: true,
    typeface: FONT.body,
  });
  addFooter(slide);
}

async function slide5(presentation) {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTopLabel(slide, "05", "Why it matters");
  addText(slide, "What makes this useful", 84, 136, 560, 62, {
    fontSize: 48,
    bold: true,
    typeface: FONT.title,
  });
  addShape(slide, "roundRect", 84, 274, 430, 530, COLORS.panel2, COLORS.border, 1.5);
  addShape(slide, "roundRect", 566, 274, 430, 530, COLORS.panel2, COLORS.border, 1.5);
  addText(slide, "Practical benefits", 114, 314, 250, 44, {
    fontSize: 34,
    bold: true,
    typeface: FONT.title,
  });
  addBulletList(slide, [
    "One place to manage voice references and transcripts",
    "Subtitle-ready transcription with timed segments",
    "Editable review-first flow for conversion",
    "Private local processing instead of cloud upload",
  ], 116, 394, 360);
  addText(slide, "Technical choices", 596, 314, 250, 44, {
    fontSize: 34,
    bold: true,
    typeface: FONT.title,
  });
  addBulletList(slide, [
    "FastAPI backend with SSE progress events",
    "Audio normalization for browser upload formats",
    "Async-safe model mutual exclusion",
    "Simple file-based voice profile storage",
  ], 598, 394, 360);
  addFooter(slide);
}

async function slide6(presentation) {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTopLabel(slide, "06", "Launch");
  addText(slide, "Voice Clone is live", 84, 136, 440, 62, {
    fontSize: 52,
    bold: true,
    typeface: FONT.title,
  });
  addText(slide, "Built as a local-first voice studio for saving voices, transcribing media, generating speech, and converting recordings in one workflow.", 84, 224, 520, 154, {
    fontSize: 30,
    color: COLORS.muted,
  });
  addShape(slide, "roundRect", 84, 452, 380, 150, COLORS.panel2, COLORS.border, 1.5);
  addText(slide, "Best fit for:", 114, 484, 160, 30, {
    fontSize: 26,
    bold: true,
    typeface: FONT.title,
  });
  addText(slide, "builders\nindie hackers\nlocal AI tool fans\nvoice workflow experiments", 114, 530, 230, 120, {
    fontSize: 24,
    color: COLORS.muted,
  });
  addShape(slide, "roundRect", 560, 148, 436, 650, COLORS.panel2, COLORS.border, 1.5);
  await addImage(slide, IMAGE_PATH, 582, 170, 392, 606, "contain");
  addText(slide, "GitHub repo in comments / post copy", 84, 924, 460, 32, {
    fontSize: 24,
    bold: true,
    typeface: FONT.title,
    color: COLORS.cyan,
  });
  addFooter(slide, "Voice Clone • Launch carousel draft");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  await slide1(presentation);
  await slide2(presentation);
  await slide3(presentation);
  await slide4(presentation);
  await slide5(presentation);
  await slide6(presentation);
  const pptx = await PresentationFile.exportPptx(presentation);
  const outPath = path.join(OUT_DIR, "voice-clone-linkedin-carousel.pptx");
  await pptx.save(outPath);
  console.log(outPath);
}

await main();
