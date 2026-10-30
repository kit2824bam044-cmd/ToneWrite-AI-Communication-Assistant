const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const app = express();

const PORT = 5000;
const OLLAMA_URL =
  "http://localhost:11434/api/generate";

const MODEL = "llama3.2";

app.use(cors());

app.use(
  express.json({
    limit: "10mb",
  })
);


/* =========================
   UPLOAD
========================= */

const uploadFolder =
  path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, {
    recursive: true,
  });
}

const upload = multer({
  dest: uploadFolder,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    message:
      "ToneWrite Backend is running",
  });
});


/* =========================
   OLLAMA FUNCTION
========================= */

async function askOllama(
  prompt,
  temperature = 0.4
) {
  const response = await fetch(
    OLLAMA_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,

        options: {
          temperature,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    console.error(
      "Ollama error:",
      errorText
    );

    throw new Error(
      "Ollama request failed"
    );
  }

  const data =
    await response.json();

  return data.response || "";
}


/* =========================
   GENERATE
========================= */

app.post(
  "/api/generate",
  async (req, res) => {

    try {

      const {
        message,
        senderName,
        recipientName,
        type,
        tone,
        length,
      } = req.body;

      if (
        !message ||
        !message.trim()
      ) {
        return res.status(400).json({
          error:
            "Message is required",
        });
      }


      let formatInstructions =
        "";


      /* LETTER */

      if (type === "Letter") {

        formatInstructions = `
Create a genuine professional
business/formal letter.

Use this structure:

Sender name
Sender department/organization
Location

Date

Recipient name
Recipient department/organization
Location

Subject: Clear subject

Dear Recipient,

Paragraph 1:
Clearly explain the purpose.

Paragraph 2:
Give the necessary details.

Paragraph 3:
Close professionally.

Sincerely,
Sender name

IMPORTANT:
Do not create fake information.
Do not invent dates.
Do not invent organizations.
Do not add random addresses.
Do not use markdown.
`;
      }


      /* EMAIL */

      if (type === "Email") {

        formatInstructions = `
Create a genuine professional
business email.

Use:

Subject: Clear subject

Dear Recipient,

Meaningful paragraph 1.

Meaningful paragraph 2.

Meaningful paragraph 3 if needed.

Kind regards,
Sender name

Do not use postal-address formatting.
Do not invent information.
Do not use markdown.
`;
      }


      /* MESSAGE */

      if (type === "Message") {

        formatInstructions = `
Create a professional chat/message.

Do not include:
- Subject
- Postal address
- From/To fields
- Formal letter structure

Use a natural professional
message suitable for WhatsApp,
Teams, Slack or workplace chat.

Keep it concise but complete.
`;
      }


      const prompt = `
You are ToneWrite,
a professional communication
assistant.

The user may write in:

- English
- Tamil
- Tanglish
- Mixed Tamil and English

Understand the user's meaning
correctly.

Communication type:
${type}

Tone:
${tone}

Length:
${length}

Sender:
${senderName || "Not provided"}

Recipient:
${recipientName || "Not provided"}

Original user message:

${message}


STRICT RULES:

1. Preserve the user's meaning.
2. Do not invent facts.
3. Do not invent dates.
4. Do not invent names.
5. Do not invent events.
6. Do not invent amounts.
7. Improve grammar.
8. Improve clarity.
9. Make it realistic.
10. Make it suitable for real-world professional use.
11. If the user writes Tamil or Tanglish,
    understand the meaning and produce
    natural professional English.
12. Do not mention that AI was used.
13. Do not explain your answer.
14. Return only the final communication.

${formatInstructions}
`;


      const result =
        await askOllama(
          prompt,
          0.4
        );


      res.json({
        result:
          result.trim(),
      });

    } catch (error) {

      console.error(
        "Generate error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to generate communication. Make sure Ollama is running and llama3.2 is installed.",
      });
    }
  }
);


/* =========================
   FILE EXTRACTION
========================= */

app.post(
  "/api/extract",
  upload.single("file"),
  async (req, res) => {

    let filePath = null;

    try {

      if (!req.file) {
        return res.status(400).json({
          error:
            "No file uploaded",
        });
      }

      filePath =
        req.file.path;

      const originalName =
        req.file.originalname;

      const extension =
        path
          .extname(originalName)
          .toLowerCase();

      let extractedText = "";


      /* TXT */

      if (extension === ".txt") {

        extractedText =
          fs.readFileSync(
            filePath,
            "utf8"
          );
      }


      /* PDF */

      else if (
        extension === ".pdf"
      ) {

        const buffer =
          fs.readFileSync(
            filePath
          );

        const pdfData =
          await pdfParse(
            buffer
          );

        extractedText =
          pdfData.text;
      }


      /* DOCX */

      else if (
        extension === ".docx"
      ) {

        const result =
          await mammoth.extractRawText(
            {
              path: filePath,
            }
          );

        extractedText =
          result.value;
      }


      /* OTHER */

      else {

        return res.status(400).json({
          error:
            "Only PDF, DOCX and TXT files are supported.",
        });
      }


      extractedText =
        extractedText
          .replace(
            /\r\n/g,
            "\n"
          )
          .replace(
            /\n{3,}/g,
            "\n\n"
          )
          .trim();


      if (!extractedText) {

        return res.status(400).json({
          error:
            "No readable text was found. Scanned or image-only PDFs require OCR.",
        });
      }


      res.json({
        filename:
          originalName,

        text:
          extractedText,
      });

    } catch (error) {

      console.error(
        "Extraction error:",
        error
      );

      res.status(500).json({
        error:
          "Could not extract text from the uploaded file.",
      });

    } finally {

      if (
        filePath &&
        fs.existsSync(filePath)
      ) {
        fs.unlinkSync(
          filePath
        );
      }
    }
  }
);


/* =========================
   REWRITE
========================= */

app.post(
  "/api/rewrite",
  async (req, res) => {

    try {

      const {
        text,
        senderName,
        recipientName,
        type,
        tone,
        length,
      } = req.body;


      if (
        !text ||
        !text.trim()
      ) {
        return res.status(400).json({
          error:
            "Text is required",
        });
      }


      const prompt = `
You are ToneWrite,
a professional business
communication editor.

The user has uploaded an
existing communication.

Your task is to rewrite it
professionally while preserving
its original facts and meaning.

Communication type:
${type}

Requested tone:
${tone}

Requested length:
${length}

Sender:
${senderName || "Not provided"}

Recipient:
${recipientName || "Not provided"}


ORIGINAL DOCUMENT:

${text}


STRICT RULES:

1. Preserve all important facts.
2. Do not invent names.
3. Do not invent dates.
4. Do not invent organizations.
5. Do not invent reasons.
6. Do not invent amounts.
7. Do not invent events.
8. Do not remove important facts.
9. Improve grammar.
10. Improve clarity.
11. Improve structure.
12. Apply the requested tone.
13. Make it realistic and professional.
14. Understand Tamil, Tanglish,
    English and mixed language.
15. Output natural professional English
    unless another language is clearly required.
16. Do not explain what you changed.
17. Return ONLY the rewritten communication.


LETTER FORMAT:

Sender name
Department/Organization
Location

Date

Recipient name
Department/Organization
Location

Subject: Clear subject

Dear Recipient,

Professional paragraphs.

Sincerely,
Sender name


EMAIL FORMAT:

Subject: Clear subject

Dear Recipient,

Professional paragraphs.

Kind regards,
Sender name


MESSAGE FORMAT:

Recipient

Professional chat-style message.

Do not add:
- Subject
- Postal address
- From/To fields
- Letter formatting
`;


      const result =
        await askOllama(
          prompt,
          0.3
        );


      res.json({
        result:
          result.trim(),
      });

    } catch (error) {

      console.error(
        "Rewrite error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to rewrite communication. Make sure Ollama is running.",
      });
    }
  }
);


/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      `ToneWrite backend running at http://localhost:${PORT}`
    );

    console.log(
      `Using Ollama model: ${MODEL}`
    );

  }
);